import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import ExcelJS from "exceljs";
import { formatActivityTimestamp } from "../lib/activities";

const source = ts.createSourceFile("route.ts", readFileSync(new URL("../app/admin/activities/[id]/registrations/export/route.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(source.statements.filter(statement => !ts.isImportDeclaration(statement)).map(statement => statement.getText(source)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

async function main() {
  for (const attendanceEnabled of [false, true]) {
    let filter: any;
    const questions = Array.from({ length: 100 }, (_, index) => ({ id: `q${index}`, label: `Question ${index + 1}` }));
    const context = {
      exports: {} as { GET: (request: Request, context: unknown) => Promise<Response> },
      ExcelJS, Response, Buffer, URL, formatActivityTimestamp,
      requireActivityPermission: async () => {}, PERMISSIONS: { REGISTRATION_EXPORT: "export" },
      prisma: { activity: { findUnique: async (args: any) => {
        if (args.select) return { attendanceEnabled };
        filter = args.include.registrationForm.include.submissions.where;
        return { title: "Committee", registrationForm: { questions, submissions: [{
          id: "registration", status: "APPROVED", studentName: "Student", studentEmail: "student@example.com", studentDepartment: "Engineering",
          submittedAt: new Date("2026-10-27T09:00:00Z"), checkedInAt: new Date("2026-10-27T10:00:00Z"), answers: [{ questionId: "q99", value: "Answer 100" }],
        }] } };
      } } },
    };
    vm.runInNewContext(code, context);
    const response = await context.exports.GET(new Request("https://test.local/export?attendance=ABSENT"), { params: Promise.resolve({ id: "activity" }) });
    assert.equal(response.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
    const sheet = workbook.getWorksheet("المسجلون")!;
    const headers = sheet.getRow(1).values as string[];
    assert.equal(headers.includes("حالة الحضور"), attendanceEnabled);
    assert.equal(headers.includes("وقت الحضور"), attendanceEnabled);
    assert.equal(sheet.columnCount, attendanceEnabled ? 108 : 106);
    assert.equal(sheet.getRow(2).getCell(sheet.columnCount).value, "Answer 100", "all 100 answer columns must survive export");
    assert.equal(filter.checkedInAt, attendanceEnabled ? null : undefined, "attendance filters do not hide registration-only applications");
  }
  console.log("Registration export passed: 100 answers, no attendance columns or filters for registration-only activities; event exports retained.");
}

void main();
