import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { SignJWT } from "jose";
import ExcelJS from "exceljs";
import { formatActivityTimestamp } from "../lib/activities";

const source = ts.createSourceFile("verify-registration-time.ts", readFileSync(new URL("./verify-registration-time.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const main = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "main");
assert.ok(main);
const code = ts.transpileModule(main.getText(source) + "\nmain;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

async function verify({ empty = false, pageStatus = 200, exportStatus = 200, correctPageTime = true, correctExportTime = true } = {}) {
  const timestamp = new Date("2026-10-27T09:15:00Z");
  const expected = formatActivityTimestamp(timestamp);
  const requests: string[] = [];
  const logs: string[] = [];
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Registrations").addRow([correctExportTime ? expected : "Incorrect time"]);
  const exported = await workbook.xlsx.writeBuffer();
  const run = vm.runInNewContext(code, {
    assert, SignJWT, ExcelJS, TextEncoder, AbortSignal, formatActivityTimestamp,
    process: { env: { SESSION_SECRET: "registration-verification-test-secret" } },
    console: { log: (message: string) => logs.push(message) },
    prisma: {
      $queryRaw: async () => [{ timezone: "Etc/UTC", clock: new Date() }],
      activityFormSubmission: { findFirst: async ({ where }: any) => {
        if (empty) return null;
        const activityId = where?.form?.activity?.deletedAt === null ? "visible-activity" : "deleted-activity";
        return { submittedAt: timestamp, form: { activityId } };
      } },
      user: { findFirst: async () => ({ id: "admin", name: "Admin", email: "admin@example.com", sessionVersion: 0 }) },
    },
    fetch: async (url: string) => {
      requests.push(url);
      if (url.includes("deleted-activity")) return new Response(null, { status: 307 });
      return url.endsWith("/export")
        ? new Response(Buffer.from(exported), { status: exportStatus })
        : new Response(correctPageTime ? expected : "Incorrect time", { status: pageStatus });
    },
  }) as () => Promise<void>;
  await run();
  return { requests, logs };
}

async function test() {
  const checked = await verify();
  assert.equal(checked.requests.length, 2);
  assert.ok(checked.requests.every(url => url.includes("visible-activity")), "verification must skip registrations belonging to deleted activities");
  const empty = await verify({ empty: true });
  assert.equal(empty.requests.length, 0);
  assert.ok(empty.logs.some(message => message.includes("No registration timestamps")));
  await assert.rejects(verify({ pageStatus: 307 }), /Registration page returned HTTP 307/);
  await assert.rejects(verify({ exportStatus: 500 }), /Registration export returned HTTP 500/);
  await assert.rejects(verify({ correctPageTime: false }), /Registration page does not show Palestinian local time/);
  await assert.rejects(verify({ correctExportTime: false }), /Registration export does not show the same Palestinian local time/);
  console.log("Registration timestamp verification tests passed: deleted activities excluded, empty data handled, HTTP failures explained, page and Excel timestamps checked.");
}

void test();
