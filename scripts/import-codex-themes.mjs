import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  options.set(process.argv[index], process.argv[index + 1]);
}

const assetsDir = options.get("--assets-dir");
const appVersion = options.get("--app-version") ?? "unknown";
const outputPath = resolve(
  repoRoot,
  options.get("--output") ?? "palette/codex-themes.json"
);

if (assetsDir == null) {
  throw new Error(
    "Usage: node scripts/import-codex-themes.mjs --assets-dir <directory> " +
    "[--app-version <version>] [--output <path>]"
  );
}

const registry = [
  ["ayu-dark", "Ayu", "Ayu Dark", "dark", "ayu-dark-D4crUA5F.js", "ayu-dark"],
  ["catppuccin-dark", "Catppuccin", "Catppuccin Dark", "dark", "catppuccin-mocha-Cjutq3dD.js", "catppuccin-mocha"],
  ["catppuccin-light", "Catppuccin", "Catppuccin Light", "light", "catppuccin-latte-zOcFwNaN.js", "catppuccin-latte"],
  ["absolutely-dark", "Absolutely", "Absolutely Dark", "dark", "absolutely-dark-B54BBN-X.js", "absolutely-dark"],
  ["absolutely-light", "Absolutely", "Absolutely Light", "light", "absolutely-light-CP_4VWV1.js", "absolutely-light"],
  ["codex-dark", "Codex", "Codex Dark", "dark", "codex-dark-DgyInWLc.js", "codex-dark"],
  ["codex-light", "Codex", "Codex Light", "light", "codex-light-CVyGr2nP.js", "codex-light"],
  ["dracula-dark", "Dracula", "Dracula Dark", "dark", "dracula-CkmxuQCA.js", "dracula"],
  ["everforest-dark", "Everforest", "Everforest Dark", "dark", "everforest-dark-DNwyXI-O.js", "everforest-dark"],
  ["everforest-light", "Everforest", "Everforest Light", "light", "everforest-light-BgZujp1P.js", "everforest-light"],
  ["github-dark", "GitHub", "GitHub Dark", "dark", "github-dark-default-B3U1wxKH.js", "github-dark-default"],
  ["github-light", "GitHub", "GitHub Light", "light", "github-light-default-xyCLROFf.js", "github-light-default"],
  ["gruvbox-dark", "Gruvbox", "Gruvbox Dark", "dark", "gruvbox-dark-medium-DzojUsna.js", "gruvbox-dark-medium"],
  ["gruvbox-light", "Gruvbox", "Gruvbox Light", "light", "gruvbox-light-medium-DLCqPW_M.js", "gruvbox-light-medium"],
  ["linear-dark", "Linear", "Linear Dark", "dark", "linear-dark-B6ksvH-w.js", "linear-dark"],
  ["linear-light", "Linear", "Linear Light", "light", "linear-light-B89a5hM8.js", "linear-light"],
  ["lobster-dark", "Lobster", "Lobster Dark", "dark", "lobster-dark-C4twhOT5.js", "lobster-dark"],
  ["material-dark", "Material", "Material Dark", "dark", "material-theme-darker-CPmP8lV-.js", "material-theme-darker"],
  ["matrix-dark", "Matrix", "Matrix Dark", "dark", "matrix-dark-Duu_8jmb.js", "matrix-dark"],
  ["monokai-dark", "Monokai", "Monokai Dark", "dark", "monokai-DpEr2NbN.js", "monokai"],
  ["night-owl-dark", "Night Owl", "Night Owl Dark", "dark", "night-owl-BcTDS1K4.js", "night-owl"],
  ["nord-dark", "Nord", "Nord Dark", "dark", "nord-C0MzpZym.js", "nord"],
  ["notion-dark", "Notion", "Notion Dark", "dark", "notion-dark-oh-FVaYU.js", "notion-dark"],
  ["notion-light", "Notion", "Notion Light", "light", "notion-light-Dyidta1Z.js", "notion-light"],
  ["oscurange-dark", "Oscurange", "Oscurange Dark", "dark", "oscurange-Bbr-xYpZ.js", "oscurange"],
  ["one-dark", "One", "One Dark", "dark", "one-dark-pro-FzVQBXsn.js", "one-dark-pro"],
  ["one-light", "One", "One Light", "light", "one-light-DHYBffPd.js", "one-light"],
  ["proof-light", "Proof", "Proof Light", "light", "proof-light-C-6lYh5j.js", "proof-light"],
  ["raycast-dark", "Raycast", "Raycast Dark", "dark", "raycast-dark-CV9ttB_S.js", "raycast-dark"],
  ["raycast-light", "Raycast", "Raycast Light", "light", "raycast-light-uOF9veQj.js", "raycast-light"],
  ["rose-pine-dark", "Rose Pine", "Rose Pine Dark", "dark", "rose-pine-moon-CUQmuvpy.js", "rose-pine-moon"],
  ["rose-pine-light", "Rose Pine", "Rose Pine Light", "light", "rose-pine-dawn-B9YdL2fA.js", "rose-pine-dawn"],
  ["sentry-dark", "Sentry", "Sentry Dark", "dark", "sentry-dark-D9jNDc5T.js", "sentry-dark"],
  ["solarized-dark", "Solarized", "Solarized Dark", "dark", "solarized-dark-C1VH3Rq7.js", "solarized-dark"],
  ["solarized-light", "Solarized", "Solarized Light", "light", "solarized-light-Ccw5Eg4G.js", "solarized-light"],
  ["tokyo-night-dark", "Tokyo Night", "Tokyo Night Dark", "dark", "tokyo-night-BQQ8aTW5.js", "tokyo-night"],
  ["temple-dark", "Temple", "Temple Dark", "dark", "temple-dark-CPV4J_lA.js", "temple-dark"],
  ["vercel-dark", "Vercel", "Vercel Dark", "dark", "vercel-dark-DqypS-8A.js", "vercel-dark"],
  ["vercel-light", "Vercel", "Vercel Light", "light", "vercel-light-BkOrl59b.js", "vercel-light"],
  ["vscode-plus-dark", "VS Code Plus", "VS Code Plus Dark", "dark", "dark-plus-BcK_Lxq4.js", "dark-plus"],
  ["vscode-plus-light", "VS Code Plus", "VS Code Plus Light", "light", "light-plus-HJjakdiH.js", "light-plus"],
  ["xcode-dark", "Xcode", "Xcode Dark", "dark", "xcode-dark-Df4KCYjm.js", "xcode-dark"],
  ["xcode-light", "Xcode", "Xcode Light", "light", "xcode-light-DoItkfXh.js", "xcode-light"]
].map(([id, family, displayName, type, asset, codexVariant]) => ({
  asset,
  codexVariant,
  displayName,
  family,
  id,
  type
}));

function evaluateThemeModule(source, filename) {
  const exportsMatch = source.match(/export\{([^}]+)\}/);
  if (exportsMatch == null) {
    throw new Error(`${filename}: could not find exports.`);
  }

  const defaultExport = exportsMatch[1]
    .split(",")
    .map((value) => value.trim())
    .find((value) => value.endsWith(" as default"));
  if (defaultExport == null) {
    throw new Error(`${filename}: could not find the default export.`);
  }

  const binding = defaultExport.split(/\s+as\s+/)[0];
  const transformed = source
    .replace(/^import[^;]+;/, "const e = (initializer) => initializer;")
    .replace(/export\{[^}]+\};?/, `globalThis.__codexTheme = ${binding};`)
    .replace(/\/\/# sourceMappingURL=.*$/m, "");
  const context = {};
  vm.runInNewContext(transformed, context, {
    filename,
    timeout: 2_000
  });
  return context.__codexTheme;
}

const themes = [];
for (const entry of registry) {
  const source = await readFile(resolve(assetsDir, entry.asset), "utf8");
  const imported = evaluateThemeModule(source, entry.asset);
  const colors = imported.colors ?? {};
  const tokenColors = imported.tokenColors ?? imported.settings ?? [];
  const importedType = imported.type ?? entry.type;

  if (importedType !== entry.type) {
    throw new Error(`${entry.asset}: expected ${entry.type}, received ${importedType}.`);
  }
  if (colors["editor.background"] == null && imported.bg == null) {
    throw new Error(`${entry.asset}: missing editor background.`);
  }
  if (tokenColors.length === 0) {
    throw new Error(`${entry.asset}: missing token colors.`);
  }

  themes.push({
    ...entry,
    sourceName: imported.name ?? entry.displayName,
    background: imported.bg ?? colors["editor.background"],
    foreground: imported.fg ?? colors["editor.foreground"] ?? colors.foreground,
    colors,
    tokenColors,
    ...(imported.semanticTokenColors == null
      ? {}
      : { semanticTokenColors: imported.semanticTokenColors }),
    ...(imported.chromeTheme == null ? {} : { chromeTheme: imported.chromeTheme })
  });
}

const output = {
  $schema: "../schemas/codex-theme-pack.schema.json",
  name: "Codex Theme Pack",
  source: {
    application: "Codex desktop app",
    applicationVersion: appVersion,
    registryVariantCount: registry.length
  },
  themes
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `Imported ${themes.length} themes (${themes.filter(({ type }) => type === "light").length} light, ` +
  `${themes.filter(({ type }) => type === "dark").length} dark) to ${outputPath}`
);
