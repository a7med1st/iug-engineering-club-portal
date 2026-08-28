import { createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { BlobNotFoundError } from "@vercel/blob";

import {
  deletePublicBlobs,
  headPrivateBlob,
  isVercelBlobUrl,
  putPrivateBlob,
  requirePrivateBlobAuth,
  requirePublicBlobAuth,
} from "../lib/blob-storage";
import { prisma } from "../lib/prisma";

const apply = process.argv.includes("--apply");
const deleteLocalSource = process.argv.includes("--delete-local-source");
const deletePublicSource = process.argv.includes("--delete-public-source");

if ((deleteLocalSource || deletePublicSource) && !apply) {
  throw new Error("Source deletion options require --apply.");
}

if (apply) requirePrivateBlobAuth();
if (apply && deletePublicSource) requirePublicBlobAuth();

const totals = {
  userMedia: 0,
  collaboration: 0,
  localChat: 0,
  publicChat: 0,
  skippedMissing: 0,
};

function deterministicSuffix(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 24);
}

function imageExtension(mime: string | null) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return null;
}

async function localBuffer(folder: string, storedName: string) {
  const safeName = path.basename(storedName);
  try {
    return await readFile(path.join(process.cwd(), "storage", folder, safeName));
  } catch {
    totals.skippedMissing += 1;
    return null;
  }
}

async function uploadPrivate(pathname: string, body: Buffer, contentType: string) {
  if (!apply) return;
  await putPrivateBlob(pathname, body, contentType, { allowOverwrite: true });
}

async function migrateUserMedia() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { avatarStoredName: { not: null } },
        { profileCoverStoredName: { not: null } },
      ],
    },
    select: {
      id: true,
      avatarStoredName: true,
      avatarMime: true,
      profileCoverStoredName: true,
      profileCoverMime: true,
    },
  });

  for (const user of users) {
    const candidates = [
      {
        field: "avatarStoredName" as const,
        storedName: user.avatarStoredName,
        mime: user.avatarMime,
        legacyFolder: "avatars",
        kind: "avatar",
      },
      {
        field: "profileCoverStoredName" as const,
        storedName: user.profileCoverStoredName,
        mime: user.profileCoverMime,
        legacyFolder: "member-covers",
        kind: "member-cover",
      },
    ];

    for (const candidate of candidates) {
      if (!candidate.storedName || candidate.storedName.startsWith("user-media/")) continue;
      const extension = imageExtension(candidate.mime);
      if (!extension) continue;
      const body = await localBuffer(candidate.legacyFolder, candidate.storedName);
      if (!body) continue;

      const pathname =
        `user-media/${user.id}/${candidate.kind}/migrated-` +
        `${deterministicSuffix(user.id, candidate.field, candidate.storedName)}${extension}`;
      totals.userMedia += 1;
      await uploadPrivate(pathname, body, candidate.mime ?? "application/octet-stream");

      if (apply) {
        await prisma.user.update({
          where: { id: user.id },
          data: { [candidate.field]: pathname },
        });
        if (deleteLocalSource) {
          await unlink(
            path.join(process.cwd(), "storage", candidate.legacyFolder, path.basename(candidate.storedName)),
          ).catch(() => undefined);
        }
      }
    }
  }
}

async function migrateCollaborationFiles() {
  const requests = await prisma.collaborationRequest.findMany({
    where: { attachmentStoredName: { not: null } },
    select: { id: true, attachmentStoredName: true, attachmentMime: true },
  });

  for (const request of requests) {
    const storedName = request.attachmentStoredName;
    if (!storedName || storedName.startsWith("collaboration/")) continue;
    const body = await localBuffer("collaboration", storedName);
    if (!body) continue;

    const extension = path.extname(path.basename(storedName)).toLowerCase();
    const pathname =
      `collaboration/migrated-${deterministicSuffix(request.id, storedName)}${extension}`;
    totals.collaboration += 1;
    await uploadPrivate(pathname, body, request.attachmentMime ?? "application/octet-stream");

    if (apply) {
      await prisma.collaborationRequest.update({
        where: { id: request.id },
        data: { attachmentStoredName: pathname },
      });
      if (deleteLocalSource) {
        await unlink(
          path.join(process.cwd(), "storage", "collaboration", path.basename(storedName)),
        ).catch(() => undefined);
      }
    }
  }
}

async function migrateChatAttachments() {
  const attachments = await prisma.chatAttachment.findMany({
    select: { id: true, url: true, pathname: true, mime: true },
  });

  for (const attachment of attachments) {
    if (!attachment.pathname.startsWith("chat-attachments/")) continue;
    let body: Buffer | null = null;
    const publicSource = Boolean(attachment.url);

    if (attachment.url) {
      if (!isVercelBlobUrl(attachment.url)) continue;
      const response = await fetch(attachment.url, { cache: "no-store" });
      if (!response.ok) {
        totals.skippedMissing += 1;
        continue;
      }
      body = Buffer.from(await response.arrayBuffer());
      totals.publicChat += 1;
    } else {
      try {
        await headPrivateBlob(attachment.pathname);
        continue;
      } catch (error) {
        if (!(error instanceof BlobNotFoundError)) throw error;
      }

      const storageRoot = path.resolve(process.cwd(), "storage");
      const sourcePath = path.resolve(storageRoot, attachment.pathname);
      if (!sourcePath.startsWith(`${storageRoot}${path.sep}`)) continue;
      try {
        body = await readFile(sourcePath);
        totals.localChat += 1;
      } catch {
        // It may already be a private Blob created by the new architecture.
        continue;
      }
    }

    await uploadPrivate(attachment.pathname, body, attachment.mime);

    if (apply && publicSource) {
      await prisma.chatAttachment.update({
        where: { id: attachment.id },
        data: { url: null },
      });
      if (deletePublicSource) {
        await deletePublicBlobs([attachment.pathname]);
      }
    }

    if (apply && !publicSource && deleteLocalSource) {
      const storageRoot = path.resolve(process.cwd(), "storage");
      const sourcePath = path.resolve(storageRoot, attachment.pathname);
      if (sourcePath.startsWith(`${storageRoot}${path.sep}`)) {
        await unlink(sourcePath).catch(() => undefined);
      }
    }
  }
}

async function main() {
  await migrateUserMedia();
  await migrateCollaborationFiles();
  await migrateChatAttachments();

  console.log(apply ? "Private Blob migration completed." : "Private Blob migration dry-run completed.");
  console.table(totals);
  if (!apply) console.log("No files or database records were changed. Re-run with --apply after review.");
}

main()
  .catch((error) => {
    console.error("Private Blob migration failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
