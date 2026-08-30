import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { NextRequest } from "next/server";

import {
  buildCspPolicy,
  configuredPublicBlobOrigin,
  createCspNonce,
  CSP_HEADER,
  CSP_REPORT_ONLY_HEADER,
  normalizePublicBlobOrigin,
} from "../lib/csp";
import { config, middleware } from "../middleware";

const VERIFIED_PUBLIC_BLOB_ORIGIN =
  "https://rdgeyzdnespzowze.public.blob.vercel-storage.com";

const nonceStyleFiles = [
  "app/admin/activities/page.tsx",
  "app/admin/contact/page.tsx",
  "app/admin/contact/print/[type]/[id]/page.tsx",
  "app/admin/guides/page.tsx",
  "app/admin/members/page.tsx",
  "app/admin/reports/print/page.tsx",
  "app/admin/structure/page.tsx",
];

const directStyleFiles = [
  "components/admin/ActivityFormBuilder.tsx",
  "components/admin/DepartmentGuideEditor.tsx",
  "components/admin/DepartmentSelect.tsx",
  "components/admin/StructureSelect.tsx",
];

function directive(policy: string, name: string) {
  return policy
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name} `));
}

async function main() {
  const firstNonce = createCspNonce();
  const secondNonce = createCspNonce();

  assert.match(firstNonce, /^[0-9a-f-]{36}$/i);
  assert.notEqual(firstNonce, secondNonce);

  const previewPolicy = buildCspPolicy(firstNonce, {
    development: false,
    publicBlobOrigin: VERIFIED_PUBLIC_BLOB_ORIGIN,
  });
  const previewScript = directive(previewPolicy, "script-src");
  const previewImages = directive(previewPolicy, "img-src");
  const previewMedia = directive(previewPolicy, "media-src");
  const previewStyleAttributes = directive(previewPolicy, "style-src-attr");

  assert.equal(CSP_REPORT_ONLY_HEADER, "Content-Security-Policy-Report-Only");
  assert.equal(CSP_HEADER, "Content-Security-Policy");
  assert.ok(previewScript?.includes(`'nonce-${firstNonce}'`));
  assert.ok(previewScript?.includes("'strict-dynamic'"));
  assert.ok(!previewScript?.includes("'unsafe-inline'"));
  assert.ok(!previewScript?.includes("'unsafe-eval'"));
  assert.equal(
    previewImages,
    `img-src 'self' data: blob: ${VERIFIED_PUBLIC_BLOB_ORIGIN}`,
  );
  assert.equal(previewMedia, "media-src 'self' blob:");
  assert.ok(!new URL(VERIFIED_PUBLIC_BLOB_ORIGIN).hostname.includes("_"));
  assert.match(
    new URL(VERIFIED_PUBLIC_BLOB_ORIGIN).hostname,
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.public\.blob\.vercel-storage\.com$/,
  );
  assert.ok(!previewPolicy.includes("*.vercel.app"));
  assert.ok(!previewPolicy.includes("*.blob.vercel-storage.com"));
  assert.ok(!previewMedia?.includes("*.blob.vercel-storage.com"));
  assert.ok(!previewPolicy.includes("store_"));
  assert.equal(previewStyleAttributes, "style-src-attr 'unsafe-inline'");
  assert.equal(previewPolicy.match(/'unsafe-inline'/g)?.length, 1);
  assert.ok(previewPolicy.includes("frame-ancestors 'none'"));
  assert.ok(previewPolicy.includes("object-src 'none'"));
  assert.ok(previewPolicy.includes("base-uri 'none'"));

  const developmentPolicy = buildCspPolicy(secondNonce, {
    development: true,
    publicBlobOrigin: VERIFIED_PUBLIC_BLOB_ORIGIN,
  });
  assert.ok(directive(developmentPolicy, "script-src")?.includes("'unsafe-eval'"));
  assert.ok(developmentPolicy.includes("ws://localhost:*"));
  assert.ok(developmentPolicy.includes("ws://127.0.0.1:*"));

  assert.equal(
    normalizePublicBlobOrigin(VERIFIED_PUBLIC_BLOB_ORIGIN),
    VERIFIED_PUBLIC_BLOB_ORIGIN,
  );
  for (const invalidOrigin of [
    "https://store_RdgeYZDnESPZowZe.public.blob.vercel-storage.com",
    "https://*.blob.vercel-storage.com",
    "http://safe-id.public.blob.vercel-storage.com",
    "https://safe-id.public.blob.vercel-storage.com/path",
    "https://safe-id.public.blob.vercel-storage.com:444",
  ]) {
    assert.equal(normalizePublicBlobOrigin(invalidOrigin), null);
  }

  const failClosedPolicy = buildCspPolicy(firstNonce, {
    development: false,
    publicBlobOrigin:
      "https://store_invalid.public.blob.vercel-storage.com",
  });
  assert.equal(directive(failClosedPolicy, "img-src"), "img-src 'self' data: blob:");

  const previousVercelEnvironment = process.env.VERCEL_ENV;
  const previousNodeEnvironment = process.env.NODE_ENV;
  const previousPublicBlobOrigin = process.env.BLOB_PUBLIC_ORIGIN;
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.VERCEL_ENV = "preview";
  process.env.BLOB_PUBLIC_ORIGIN = VERIFIED_PUBLIC_BLOB_ORIGIN;

  try {
    const firstResponse = middleware(new NextRequest("https://preview.example/"));
    const secondResponse = middleware(new NextRequest("https://preview.example/"));
    const firstHeader = firstResponse.headers.get(CSP_HEADER);
    const secondHeader = secondResponse.headers.get(CSP_HEADER);

    assert.equal(configuredPublicBlobOrigin(), VERIFIED_PUBLIC_BLOB_ORIGIN);
    assert.ok(firstHeader);
    assert.ok(secondHeader);
    assert.notEqual(firstHeader, secondHeader);
    assert.equal(firstResponse.headers.get(CSP_REPORT_ONLY_HEADER), null);
    assert.ok(firstResponse.headers.get("x-middleware-request-x-nonce"));
    assert.ok(
      firstResponse.headers.get(
        "x-middleware-request-content-security-policy",
      ),
    );

    process.env.VERCEL_ENV = "production";
    const productionResponse = middleware(
      new NextRequest("https://production.example/"),
    );
    const productionPolicy = productionResponse.headers.get(CSP_HEADER);
    assert.equal(productionResponse.headers.get(CSP_REPORT_ONLY_HEADER), null);
    assert.ok(productionPolicy);
    assert.equal(
      directive(productionPolicy, "img-src"),
      `img-src 'self' data: blob: ${VERIFIED_PUBLIC_BLOB_ORIGIN}`,
    );
    assert.equal(
      directive(productionPolicy, "media-src"),
      "media-src 'self' blob:",
    );
    assert.ok(
      !directive(productionPolicy, "script-src")?.includes("'unsafe-inline'"),
    );
    assert.ok(
      !directive(productionPolicy, "script-src")?.includes("'unsafe-eval'"),
    );
    assert.ok(!productionPolicy.includes("*.blob.vercel-storage.com"));
    assert.ok(!productionPolicy.includes("store_"));
    assert.ok(
      productionResponse.headers.get(
        "x-middleware-request-content-security-policy",
      ),
    );

    Reflect.set(process.env, "NODE_ENV", "development");
    const localDevelopmentResponse = middleware(
      new NextRequest("http://localhost:3000/"),
    );
    const localDevelopmentPolicy = localDevelopmentResponse.headers.get(
      CSP_REPORT_ONLY_HEADER,
    );
    assert.equal(localDevelopmentResponse.headers.get(CSP_HEADER), null);
    assert.ok(localDevelopmentPolicy?.includes("'unsafe-eval'"));
    assert.ok(localDevelopmentPolicy?.includes("ws://localhost:*"));
  } finally {
    if (previousVercelEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnvironment;
    }
    if (previousNodeEnvironment === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Reflect.set(process.env, "NODE_ENV", previousNodeEnvironment);
    }
    if (previousPublicBlobOrigin === undefined) {
      delete process.env.BLOB_PUBLIC_ORIGIN;
    } else {
      process.env.BLOB_PUBLIC_ORIGIN = previousPublicBlobOrigin;
    }
  }

  const matcher = config.matcher.join(" ");
  for (const excluded of [
    "api",
    "_next/static",
    "_next/image",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
  ]) {
    assert.ok(matcher.includes(excluded));
  }

  const layout = await readFile("app/layout.tsx", "utf8");
  assert.match(layout, /getCspNonce\(\)/);
  assert.match(layout, /<CspNonceProvider nonce=\{nonce\}>/);
  assert.match(layout, /<script nonce=\{nonce\}/);

  const nonceHelper = await readFile("lib/csp-nonce.ts", "utf8");
  assert.match(nonceHelper, /headers\(\)/);

  let knownInlineStyleBlocks = 0;

  for (const file of nonceStyleFiles) {
    const source = await readFile(file, "utf8");
    const blocks = source.match(/<NonceStyle>/g) ?? [];
    assert.equal(blocks.length, 1, `${file} must use one NonceStyle block`);
    assert.ok(!/<style\b/i.test(source), `${file} has a raw style element`);
    knownInlineStyleBlocks += blocks.length;
  }

  for (const file of directStyleFiles) {
    const source = await readFile(file, "utf8");
    const styleTags = [...source.matchAll(/<style\b([^>]*)>/gi)];
    assert.equal(styleTags.length, 1, `${file} must keep one style block`);
    assert.match(styleTags[0][1], /nonce=\{nonce\}/);
    assert.match(source, /useCspNonce\(\)/);
    knownInlineStyleBlocks += styleTags.length;
  }

  assert.equal(knownInlineStyleBlocks, 11);

  const adminFeedback = await readFile(
    "components/admin/AdminFeedback.tsx",
    "utf8",
  );
  assert.match(adminFeedback, /import styles from "\.\/AdminFeedback\.module\.css"/);
  assert.ok(!/<style\b/i.test(adminFeedback));
  assert.ok(!/styled-jsx|useCspNonce/.test(adminFeedback));

  const adminFeedbackStyles = await readFile(
    "components/admin/AdminFeedback.module.css",
    "utf8",
  );
  assert.match(adminFeedbackStyles, /\.feedback\s*\{/);
  assert.match(adminFeedbackStyles, /@keyframes feedbackCountdown/);

  const nonceComponent = await readFile(
    "components/security/CspNonce.tsx",
    "utf8",
  );
  assert.match(nonceComponent, /return <style nonce=\{nonce\}>/);

  console.log("CSP preview enforcement security tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
