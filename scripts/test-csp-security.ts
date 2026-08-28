import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { NextRequest } from "next/server";

import {
  buildCspReportOnly,
  createCspNonce,
  CSP_REPORT_ONLY_HEADER,
  PUBLIC_ACTIVITY_BLOB_ORIGIN,
} from "../lib/csp";
import { config, middleware } from "../middleware";

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

  const previewPolicy = buildCspReportOnly(firstNonce, {
    development: false,
  });
  const previewScript = directive(previewPolicy, "script-src");

  assert.equal(CSP_REPORT_ONLY_HEADER, "Content-Security-Policy-Report-Only");
  assert.ok(previewScript?.includes(`'nonce-${firstNonce}'`));
  assert.ok(previewScript?.includes("'strict-dynamic'"));
  assert.ok(!previewScript?.includes("'unsafe-inline'"));
  assert.ok(!previewScript?.includes("'unsafe-eval'"));
  assert.ok(previewPolicy.includes(PUBLIC_ACTIVITY_BLOB_ORIGIN));
  assert.ok(!previewPolicy.includes("*.vercel.app"));
  assert.ok(!previewPolicy.includes("*.blob.vercel-storage.com"));
  assert.ok(previewPolicy.includes("frame-ancestors 'none'"));
  assert.ok(previewPolicy.includes("object-src 'none'"));
  assert.ok(previewPolicy.includes("base-uri 'none'"));

  const developmentPolicy = buildCspReportOnly(secondNonce, {
    development: true,
  });
  assert.ok(directive(developmentPolicy, "script-src")?.includes("'unsafe-eval'"));
  assert.ok(developmentPolicy.includes("ws://localhost:*"));
  assert.ok(developmentPolicy.includes("ws://127.0.0.1:*"));

  const previousVercelEnvironment = process.env.VERCEL_ENV;
  const previousNodeEnvironment = process.env.NODE_ENV;
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.VERCEL_ENV = "preview";

  try {
    const firstResponse = middleware(new NextRequest("https://preview.example/"));
    const secondResponse = middleware(new NextRequest("https://preview.example/"));
    const firstHeader = firstResponse.headers.get(CSP_REPORT_ONLY_HEADER);
    const secondHeader = secondResponse.headers.get(CSP_REPORT_ONLY_HEADER);

    assert.ok(firstHeader);
    assert.ok(secondHeader);
    assert.notEqual(firstHeader, secondHeader);
    assert.equal(firstResponse.headers.get("content-security-policy"), null);
    assert.ok(firstResponse.headers.get("x-middleware-request-x-nonce"));
    assert.ok(
      firstResponse.headers.get(
        "x-middleware-request-content-security-policy-report-only",
      ),
    );

    process.env.VERCEL_ENV = "production";
    const productionResponse = middleware(
      new NextRequest("https://production.example/"),
    );
    assert.equal(productionResponse.headers.get(CSP_REPORT_ONLY_HEADER), null);
    assert.equal(
      productionResponse.headers.get("content-security-policy"),
      null,
    );

    Reflect.set(process.env, "NODE_ENV", "development");
    const localDevelopmentResponse = middleware(
      new NextRequest("http://localhost:3000/"),
    );
    const localDevelopmentPolicy = localDevelopmentResponse.headers.get(
      CSP_REPORT_ONLY_HEADER,
    );
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
  assert.match(layout, /headers\(\)/);
  assert.match(layout, /<script nonce=\{nonce\}/);

  console.log("CSP Report-Only security tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
