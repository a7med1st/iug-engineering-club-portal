import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { getPrivateBlob } from "../lib/blob-storage";

async function main() {
  const keys = ["NODE_ENV", "FILE_STORAGE_DRIVER", "VERCEL", "VERCEL_OIDC_TOKEN", "BLOB_PRIVATE_STORE_ID", "BLOB_PRIVATE_READ_WRITE_TOKEN"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const dispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  try {
    delete process.env.FILE_STORAGE_DRIVER;
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.VERCEL = "1";
    process.env.VERCEL_OIDC_TOKEN = "expired-oidc-token";
    process.env.BLOB_PRIVATE_STORE_ID = "store_downloadtest";
    process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = "vercel_blob_rw_downloadtest_testtoken";
    const pool = agent.get("https://downloadtest.private.blob.vercel-storage.com");
    const bytes = Buffer.from("%PDF-1.4\n" + "Download test\n".repeat(100) + "%%EOF");
    const zipped = gzipSync(bytes);
    pool.intercept({ path: "/library/file.pdf?cache=0", method: "GET", headers: { authorization: "Bearer expired-oidc-token" } })
      .reply(403, "Forbidden");
    pool.intercept({ path: "/library/file.pdf?cache=0", method: "GET", headers: { authorization: "Bearer vercel_blob_rw_downloadtest_testtoken" } })
      .reply(200, zipped, { headers: { "content-type": "application/pdf", "content-encoding": "gzip", "content-length": String(zipped.length) } });
    const result = await getPrivateBlob("library/file.pdf", { useCache: false });
    assert.equal(result?.statusCode, 200);
    assert.deepEqual(Buffer.from(await new Response(result!.stream).arrayBuffer()), bytes);
    assert.equal(result!.headers.get("content-encoding"), "gzip", "SDK retains encoded headers after decoding the body");
    agent.assertNoPendingInterceptors();
    console.log("Private Blob download integration tests passed.");
  } finally {
    setGlobalDispatcher(dispatcher);
    await agent.close();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
