import os from "node:os";
import { fileURLToPath } from "node:url";

// tsx uses os.userInfo() only to name its temporary directory. Some
// restricted Windows environments cannot expose it, so provide a stable
// local fallback before importing tsx.
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: "codex",
    homedir: process.cwd(),
    shell: null,
  });
}

if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}

const { tsImport } = await import("tsx/esm/api");

await tsImport(
  "./test-contact-submit-routing.ts",
  {
    parentURL: import.meta.url,
    tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
  },
);
