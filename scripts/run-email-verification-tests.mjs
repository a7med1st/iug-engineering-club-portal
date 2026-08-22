// Some restricted Windows environments cannot resolve os.userInfo(), which
// tsx only uses to name its temporary directory. A stable numeric identifier
// keeps the test runner portable without changing application behavior.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}

const { tsImport } = await import("tsx/esm/api");

await tsImport(
  "./test-email-verification.ts",
  import.meta.url,
);
