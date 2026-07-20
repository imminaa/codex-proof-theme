import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceManifest = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const output = resolve(
  repoRoot,
  "dist",
  `codex-theme-pack-vscode-${workspaceManifest.version}.vsix`
);
const result = spawnSync(
  executable,
  [
    "--yes",
    "@vscode/vsce",
    "package",
    "--no-dependencies",
    "--allow-missing-repository",
    "--out",
    output
  ],
  {
    cwd: resolve(repoRoot, "vscode"),
    stdio: "inherit"
  }
);

if (result.error != null) {
  throw result.error;
}
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
