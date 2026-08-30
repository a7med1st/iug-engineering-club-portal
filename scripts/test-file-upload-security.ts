import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { GetBlobResult } from "@vercel/blob";
import sharp from "sharp";

import { rateLimitResponse } from "../lib/auth-rate-limit";
import {
  requirePrivateBlobAuth,
  requirePrivateBlobReadAuth,
  requirePublicBlobAuth,
} from "../lib/blob-storage";
import {
  privateFileResponse,
  safeContentDisposition,
} from "../lib/private-file-response";
import {
  PRIVATE_USER_MEDIA_CACHE,
  PUBLIC_USER_MEDIA_CACHE,
  resolveMemberMediaAccess,
} from "../lib/user-media-access";
import {
  UploadValidationError,
  sanitizeOriginalFilename,
  validateAndProcessImage,
  validateChatUpload,
  validateCollaborationDocument,
} from "../lib/upload-security";

const MB = 1024 * 1024;

async function expectUploadRejection(
  operation: Promise<unknown>,
  expectedCode?: UploadValidationError["code"],
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof UploadValidationError);
    if (expectedCode) assert.equal(error.code, expectedCode);
    return true;
  });
}

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main() {
  const blobEnvironmentNames = [
    "VERCEL",
    "VERCEL_OIDC_TOKEN",
    "BLOB_PUBLIC_STORE_ID",
    "BLOB_PRIVATE_STORE_ID",
    "BLOB_PUBLIC_READ_WRITE_TOKEN",
    "BLOB_PRIVATE_READ_WRITE_TOKEN",
    "BLOB_READ_WRITE_TOKEN",
  ] as const;
  const originalBlobEnvironment = Object.fromEntries(
    blobEnvironmentNames.map((name) => [name, process.env[name]]),
  );

  try {
    for (const name of blobEnvironmentNames) delete process.env[name];
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    process.env.BLOB_PUBLIC_STORE_ID = "store_public-test";
    process.env.BLOB_PRIVATE_STORE_ID = "store_private-test";
    process.env.BLOB_PUBLIC_READ_WRITE_TOKEN = "vercel_blob_rw_public-test";
    process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = "vercel_blob_rw_private-test";

    assert.deepEqual(requirePublicBlobAuth(), { storeId: "store_public-test" });
    assert.deepEqual(requirePrivateBlobAuth(), { storeId: "store_private-test" });
    assert.deepEqual(requirePrivateBlobReadAuth(), {
      storeId: "store_private-test",
      oidcToken: "test-oidc-token",
    });

    delete process.env.VERCEL_OIDC_TOKEN;
    assert.deepEqual(requirePublicBlobAuth(), {
      token: "vercel_blob_rw_public-test",
    });
    assert.deepEqual(requirePrivateBlobAuth(), {
      token: "vercel_blob_rw_private-test",
    });
  } finally {
    for (const name of blobEnvironmentNames) {
      const value = originalBlobEnvironment[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }

  const jpegBuffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 14, g: 105, b: 210 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const validJpeg = new File([jpegBuffer], "avatar.jpg", { type: "image/jpeg" });
  const processed = await validateAndProcessImage(validJpeg, {
    maxBytes: 5 * MB,
    maxWidth: 4_096,
    maxHeight: 4_096,
    maxPixels: 12_000_000,
  });
  assert.equal(processed.mime, "image/jpeg");
  assert.equal(processed.extension, ".jpg");
  assert.equal((await sharp(processed.buffer).metadata()).exif, undefined);

  await expectUploadRejection(
    validateAndProcessImage(
      new File([Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01])], "fake.jpg", {
        type: "image/jpeg",
      }),
      { maxBytes: 5 * MB, maxWidth: 4_096, maxHeight: 4_096, maxPixels: 12_000_000 },
    ),
    "SIGNATURE",
  );

  await expectUploadRejection(
    validateChatUpload(
      new File(["<svg><script>alert(1)</script></svg>"], "attack.svg", {
        type: "image/svg+xml",
      }),
      12 * MB,
    ),
    "TYPE",
  );

  await expectUploadRejection(
    validateChatUpload(
      new File(["<html><script>alert(1)</script></html>"], "attack.html", {
        type: "text/html",
      }),
      12 * MB,
    ),
    "TYPE",
  );

  await expectUploadRejection(
    validateChatUpload(
      new File([Buffer.from("MZ")], "program.exe", {
        type: "application/octet-stream",
      }),
      12 * MB,
    ),
    "TYPE",
  );

  const webm = await validateChatUpload(
    new File([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01])], "voice.webm", {
      type: "audio/webm;codecs=opus",
    }),
    12 * MB,
  );
  assert.equal(webm.category, "audio");
  assert.equal(webm.mime, "audio/webm");

  await expectUploadRejection(
    validateChatUpload(
      new File([Buffer.alloc(12 * MB + 1)], "large.pdf", { type: "application/pdf" }),
      12 * MB,
    ),
    "SIZE",
  );

  const pdf = await validateCollaborationDocument(
    new File([Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF")], "proposal.pdf", {
      type: "application/pdf",
    }),
    5 * MB,
  );
  assert.equal(pdf.mime, "application/pdf");

  await expectUploadRejection(
    validateCollaborationDocument(
      new File([Buffer.from("not-a-document")], "legacy.doc", {
        type: "application/msword",
      }),
      5 * MB,
    ),
    "TYPE",
  );

  assert.equal(sanitizeOriginalFilename('../bad\r\n"name.pdf'), ".._bad_name.pdf");

  const rateLimited = rateLimitResponse(91);
  assert.equal(rateLimited.status, 429);
  assert.equal(rateLimited.headers.get("Retry-After"), "91");

  assert.deepEqual(
    resolveMemberMediaAccess({
      targetUserId: "published-member",
      isPublished: true,
      viewer: null,
    }),
    { cacheControl: PUBLIC_USER_MEDIA_CACHE },
  );
  assert.deepEqual(
    resolveMemberMediaAccess({
      targetUserId: "private-member",
      isPublished: false,
      viewer: { id: "private-member", role: "MEMBER" },
    }),
    { cacheControl: PRIVATE_USER_MEDIA_CACHE },
  );
  assert.deepEqual(
    resolveMemberMediaAccess({
      targetUserId: "private-member",
      isPublished: false,
      viewer: { id: "admin", role: "ADMIN" },
    }),
    { cacheControl: PRIVATE_USER_MEDIA_CACHE },
  );
  assert.equal(
    resolveMemberMediaAccess({
      targetUserId: "private-member",
      isPublished: false,
      viewer: null,
    }),
    null,
  );
  assert.equal(
    resolveMemberMediaAccess({
      targetUserId: "private-member",
      isPublished: false,
      viewer: { id: "other-member", role: "MEMBER" },
    }),
    null,
  );

  const privateImageResult: GetBlobResult = {
    statusCode: 200,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
        controller.close();
      },
    }),
    headers: new Headers({
      "content-type": "image/jpeg",
      "content-length": "3",
      etag: '"private-image-etag"',
    }),
    blob: {
      url: "https://private.invalid/avatar.jpg",
      downloadUrl: "https://private.invalid/avatar.jpg?download=1",
      pathname: "user-media/test/avatar.jpg",
      contentDisposition: "",
      cacheControl: "",
      uploadedAt: new Date(0),
      etag: '"private-image-etag"',
      contentType: "image/jpeg",
      size: 3,
    },
  };
  const privateImageResponse = privateFileResponse(privateImageResult, {
    fallbackMime: "application/octet-stream",
    originalName: "avatar.jpg",
    disposition: "inline",
    cacheControl: "private, no-store",
  });
  assert.ok(privateImageResponse);
  assert.equal(privateImageResponse.status, 200);
  assert.equal(privateImageResponse.headers.get("Content-Type"), "image/jpeg");
  assert.match(privateImageResponse.headers.get("Content-Disposition") ?? "", /^inline;/);
  assert.equal(privateImageResponse.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(privateImageResponse.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(
    new Uint8Array(await privateImageResponse.arrayBuffer()),
    new Uint8Array([0xff, 0xd8, 0xff]),
  );
  assert.equal(
    privateFileResponse(null, {
      fallbackMime: "image/jpeg",
      originalName: "missing.jpg",
      disposition: "inline",
      cacheControl: "private, no-store",
    }),
    null,
  );

  const disposition = safeContentDisposition('../bad\r\n"name.pdf', "attachment");
  assert.match(disposition, /^attachment; filename="[a-zA-Z0-9._-]+";/);
  assert.doesNotMatch(disposition, /[\r\n]/);

  const [
    blobStorage,
    userMediaResponse,
    chatStorage,
    chatDownload,
    memberAvatar,
    memberCover,
    memberProfile,
    studentAvatar,
    studentAvatarRoute,
    studentAvatarUploader,
    contactDownload,
    contactAction,
    activityStorage,
    privateFileMigration,
  ] =
    await Promise.all([
      source("lib/blob-storage.ts"),
      source("lib/user-media-response.ts"),
      source("lib/chat-attachment-storage.ts"),
      source("app/member/chat/attachments/[id]/route.ts"),
      source("app/members/[id]/avatar/route.ts"),
      source("app/members/[id]/cover/route.ts"),
      source("app/member/profile/actions.ts"),
      source("app/student/actions.ts"),
      source("app/student/avatar/route.ts"),
      source("components/student/StudentAvatarUploader.tsx"),
      source("app/admin/contact/files/[id]/route.ts"),
      source("app/contact/actions.ts"),
      source("lib/activity-image-storage.ts"),
      source("scripts/migrate-files-to-private-blob.ts"),
    ]);

  assert.match(blobStorage, /requirePrivateBlobReadAuth/);
  assert.match(blobStorage, /return \{ storeId: auth\.storeId, oidcToken \}/);
  assert.match(userMediaResponse, /getPrivateBlob\(options\.storedName,\s*\{/);
  assert.match(userMediaResponse, /abortSignal:\s*AbortSignal\.timeout\(15_000\)/);
  assert.match(userMediaResponse, /useCache:\s*false/);
  assert.match(userMediaResponse, /privateFileResponse\(blob/);
  assert.match(chatStorage, /putPrivateBlob/);
  assert.match(chatStorage, /url:\s*null/);
  assert.doesNotMatch(chatStorage, /access:\s*["']public["']/);
  assert.match(chatDownload, /participants:\s*\{\s*some:\s*\{\s*userId:\s*auth\.user\.id/);
  assert.match(chatDownload, /getPrivateBlob\(attachment\.pathname\)/);
  assert.doesNotMatch(chatDownload, /getPrivateBlob\([^\n]+,\s*range/);
  assert.match(chatDownload, /Only a confirmed Blob 404 is allowed/);
  assert.match(chatDownload, /File unavailable["'],\s*\{ status: 500 \}/);
  assert.match(memberAvatar, /userImageResponse/);
  assert.match(memberAvatar, /getCurrentUser\(\)/);
  assert.match(memberAvatar, /resolveMemberMediaAccess/);
  assert.match(memberAvatar, /cacheControl:\s*access\.cacheControl/);
  assert.doesNotMatch(memberAvatar, /structureItem:\s*\{\s*isNot:\s*null/);
  assert.match(memberAvatar, /File unavailable["'],\s*\{ status: 500 \}/);
  assert.match(memberCover, /userImageResponse/);
  assert.match(memberCover, /getCurrentUser\(\)/);
  assert.match(memberCover, /resolveMemberMediaAccess/);
  assert.match(memberCover, /cacheControl:\s*access\.cacheControl/);
  assert.doesNotMatch(memberCover, /structureItem:\s*\{\s*isNot:\s*null/);
  assert.match(memberCover, /File unavailable["'],\s*\{ status: 500 \}/);
  assert.match(memberProfile, /where:\s*\{\s*id:\s*user\.id\s*\}/);
  assert.match(studentAvatar, /where:\s*\{\s*id:\s*user\.id/);
  assert.match(studentAvatarRoute, /userImageResponse/);
  assert.match(studentAvatarRoute, /requirePermission\([\s\S]*PERMISSIONS\.STUDENT_DASHBOARD/);
  assert.match(studentAvatarRoute, /cacheControl:\s*["']private, no-store["']/);
  assert.match(studentAvatarRoute, /status:\s*500/);
  assert.match(
    studentAvatarUploader,
    /data-testid="student-avatar-upload-trigger"/,
  );
  assert.match(
    studentAvatarUploader,
    /data-avatar-state=\{[\s\S]*?avatarVisible[\s\S]*?"existing"[\s\S]*?"empty"[\s\S]*?\}/,
  );
  assert.doesNotMatch(
    studentAvatarUploader,
    /\{avatarVisible\s*&&\s*\([\s\S]{0,240}data-testid="student-avatar-upload-trigger"/,
  );
  assert.match(studentAvatarUploader, /URL\.createObjectURL\(file\)/);
  assert.match(
    studentAvatarUploader,
    /type="file"[\s\S]{0,160}name="avatar"[\s\S]{0,160}accept="image\/jpeg,image\/png,image\/webp"/,
  );
  assert.match(contactDownload, /assignedToId:\s*user\.id/);
  assert.match(contactDownload, /privateFileResponse\(blob/);
  assert.match(contactDownload, /File unavailable["'],\s*\{ status: 500 \}/);
  assert.match(contactAction, /tryDeletePrivateBlobs/);
  assert.match(activityStorage, /putPublicBlob/);
  assert.match(
    privateFileMigration,
    /body = await readFile\(sourcePath\);[\s\S]*?totals\.localChat \+= 1;[\s\S]*?catch \{[\s\S]*?totals\.skippedMissing \+= 1;/,
  );

  console.log("File upload and storage security tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
