import { fileURLToPath } from "node:url";

if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}

const { tsImport } = await import("tsx/esm/api");

await tsImport("./final-programming-check.ts", {
  parentURL: import.meta.url,
  tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
});
