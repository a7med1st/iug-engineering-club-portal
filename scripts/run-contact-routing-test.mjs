// tsx uses os.userInfo() only to name its temporary directory. Some
// restricted Windows environments cannot expose it, so use a stable id.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}

const { tsImport } = await import("tsx/esm/api");

await tsImport(
  "./test-contact-submit-routing.ts",
  import.meta.url,
);
