import os from "node:os";
import { fileURLToPath } from "node:url";

// Some restricted Windows environments cannot resolve os.userInfo(), which
// tsx only uses to name its temporary directory. Keep both fallbacks because
// recent tsx releases call userInfo() directly when geteuid is unavailable.
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
  "./test-email-verification.ts",
  {
    parentURL: import.meta.url,
    tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
  },
);
