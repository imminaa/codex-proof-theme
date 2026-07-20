import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const workspaceManifest = await readJson("package.json");
const source = await readJson("palette/codex-themes.json");
const vscodeManifest = await readJson("vscode/package.json");
const pluginXml = await readFile(resolve(root, "intellij/src/main/resources/META-INF/plugin.xml"), "utf8");
const themeList = await readFile(resolve(root, "THEMES.md"), "utf8");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function parseHex(value) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)) return null;
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
    alpha: value.length === 9 ? Number.parseInt(value.slice(7, 9), 16) / 255 : 1
  };
}

function solid(value, background = "#000000") {
  const foreground = parseHex(value) ?? parseHex(background);
  const backdrop = parseHex(background) ?? parseHex("#000000");
  return `#${[
    foreground.red * foreground.alpha + backdrop.red * (1 - foreground.alpha),
    foreground.green * foreground.alpha + backdrop.green * (1 - foreground.alpha),
    foreground.blue * foreground.alpha + backdrop.blue * (1 - foreground.alpha)
  ].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(value) {
  const color = parseHex(solid(value));
  const channels = [color.red, color.green, color.blue]
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left, right) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

check(source.name === "Codex Theme Pack", "Shared source must be the Codex Theme Pack registry.");
check(source.themes.length === 43, `Expected 43 Codex themes, found ${source.themes.length}.`);
check(source.source.registryVariantCount === 43, "Source registry count must be 43.");
check(source.themes.filter(({ type }) => type === "light").length === 16, "Expected 16 light themes.");
check(source.themes.filter(({ type }) => type === "dark").length === 27, "Expected 27 dark themes.");
check(new Set(source.themes.map(({ family }) => family)).size === 28, "Expected 28 Codex theme families.");
check(new Set(source.themes.map(({ id }) => id)).size === source.themes.length, "Theme IDs must be unique.");
check(new Set(source.themes.map(({ asset }) => asset)).size === source.themes.length, "Source assets must be unique.");

check(workspaceManifest.version === vscodeManifest.version, "Workspace and VS Code versions must match.");
check(workspaceManifest.scripts?.generate === "node scripts/generate-theme-pack.mjs", "Generate script is not configured.");
check(workspaceManifest.scripts?.["package:vscode"] === "node scripts/package-vscode.mjs", "VS Code packaging must use its cross-platform Node wrapper.");
check(workspaceManifest.scripts?.["package:intellij"] === "node scripts/package-intellij.mjs", "IntelliJ packaging must use its cross-platform Node packager.");
check(vscodeManifest.name === "codex-theme-pack", "VS Code package name is incorrect.");
check(vscodeManifest.displayName === "Codex Theme Pack", "VS Code display name is incorrect.");
check(vscodeManifest.contributes?.themes?.length === source.themes.length, "VS Code manifest coverage is incomplete.");

const vscodeFiles = await readdir(resolve(root, "vscode/themes"));
const intellijFiles = await readdir(resolve(root, "intellij/src/main/resources/themes"));
check(vscodeFiles.length === source.themes.length, "VS Code theme directory must contain exactly one file per theme.");
check(intellijFiles.filter((name) => name.endsWith(".theme.json")).length === source.themes.length, "IntelliJ UI theme coverage is incomplete.");
check(intellijFiles.filter((name) => name.endsWith(".xml")).length === source.themes.length, "IntelliJ editor scheme coverage is incomplete.");

for (const theme of source.themes) {
  const prefix = `[${theme.id}]`;
  const contribution = vscodeManifest.contributes.themes.find(({ path }) =>
    path === `./themes/${theme.id}-color-theme.json`
  );
  check(contribution != null, `${prefix} missing VS Code contribution.`);
  check(contribution?.label === `Codex — ${theme.displayName}`, `${prefix} VS Code label is incorrect.`);
  check(contribution?.uiTheme === (theme.type === "dark" ? "vs-dark" : "vs"), `${prefix} VS Code base theme is incorrect.`);

  const vscodeTheme = await readJson(`vscode/themes/${theme.id}-color-theme.json`);
  check(vscodeTheme.name === `Codex — ${theme.displayName}`, `${prefix} VS Code theme name is incorrect.`);
  check(vscodeTheme.type === theme.type, `${prefix} VS Code theme type is incorrect.`);
  check(vscodeTheme.semanticHighlighting === true, `${prefix} semantic highlighting must be enabled.`);
  check(vscodeTheme.tokenColors.length === theme.tokenColors.length, `${prefix} TextMate rule count drifted.`);
  check(
    JSON.stringify(vscodeTheme.tokenColors) === JSON.stringify(theme.tokenColors),
    `${prefix} TextMate rules drifted from the Codex source.`
  );
  for (const [key, value] of Object.entries(theme.colors)) {
    if (typeof value === "string") {
      check(vscodeTheme.colors[key] === value, `${prefix} workbench color ${key} drifted.`);
    } else if (Array.isArray(value)) {
      check(
        vscodeTheme.colors[key] === value.find((candidate) => typeof candidate === "string"),
        `${prefix} workbench color ${key} was not normalized to a usable color.`,
      );
    }
  }
  check(
    Object.values(vscodeTheme.colors).every((value) => typeof value === "string"),
    `${prefix} contains a non-string VS Code workbench color.`,
  );

  const intellijTheme = await readJson(`intellij/src/main/resources/themes/${theme.id}.theme.json`);
  const editorScheme = await readFile(resolve(root, `intellij/src/main/resources/themes/${theme.id}.xml`), "utf8");
  const expectedParent = theme.type === "dark" ? "Islands Dark" : "Islands Light";
  check(intellijTheme.name === `Codex — ${theme.displayName}`, `${prefix} IntelliJ theme name is incorrect.`);
  check(intellijTheme.dark === (theme.type === "dark"), `${prefix} IntelliJ dark flag is incorrect.`);
  check(intellijTheme.parentTheme === expectedParent, `${prefix} IntelliJ Islands parent is incorrect.`);
  check(intellijTheme.editorScheme === `/themes/${theme.id}.xml`, `${prefix} editor scheme path is incorrect.`);
  check(intellijTheme.ui.Islands === 1, `${prefix} Islands rendering is not enabled.`);
  check(intellijTheme.ui["Island.borderColor"] === "packSurface", `${prefix} island border must match the surface.`);
  check(intellijTheme.ui["ToolWindow.background"] === "packSurface", `${prefix} tool-window surface is incorrect.`);
  check(intellijTheme.ui["EditorTabs.background"] === "packEditor", `${prefix} editor tab bar must match the editor.`);
  check(intellijTheme.ui["StatusBar.borderColor"] === "packTransparent", `${prefix} status bar border must be transparent.`);
  check(intellijTheme.ui["ToolWindow.Stripe.borderColor"] === "packTransparent", `${prefix} stripe border must be transparent.`);
  check(intellijTheme.ui["MainToolbar.borderColor"] === "packTransparent", `${prefix} toolbar border must be transparent.`);

  const editor = intellijTheme.colors.packEditor;
  const surface = intellijTheme.colors.packSurface;
  const frame = intellijTheme.colors.packFrame;
  check(contrast(frame, editor) >= 1.2, `${prefix} frame/editor contrast is below 1.20:1.`);
  check(contrast(frame, surface) >= 1.2, `${prefix} frame/surface contrast is below 1.20:1.`);
  check(
    theme.type === "dark"
      ? luminance(frame) > Math.max(luminance(editor), luminance(surface))
      : luminance(frame) < Math.min(luminance(editor), luminance(surface)),
    `${prefix} Islands frame is adjusted in the wrong direction.`
  );
  check(editorScheme.includes(`name="Codex — ${theme.displayName}"`), `${prefix} editor scheme name is incorrect.`);
  check(editorScheme.includes(`BACKGROUND" value="${solid(theme.background).slice(1).toUpperCase()}"`), `${prefix} editor background drifted.`);
  check(pluginXml.includes(`path="/themes/${theme.id}.theme.json"`), `${prefix} themeProvider is missing.`);
}

const providerIds = [...pluginXml.matchAll(/<themeProvider id="([^"]+)"/g)].map((match) => match[1]);
check(providerIds.length === source.themes.length, "IntelliJ plugin must register one provider per theme.");
check(new Set(providerIds).size === providerIds.length, "IntelliJ themeProvider IDs must be unique.");
check(pluginXml.includes("<id>dev.leon.codex-theme-pack</id>"), "IntelliJ plugin ID is incorrect.");
check(pluginXml.includes(`<version>${workspaceManifest.version}</version>`), "IntelliJ plugin version is out of sync.");
check(pluginXml.includes('<idea-version since-build="253"'), "IntelliJ plugin must require build 253 for Islands themes.");
check(themeList.includes(`Total: **${source.themes.length} themes**`), "Generated theme list is out of sync.");

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${source.themes.length} Codex themes: source fidelity, VS Code contributions, ` +
    "IntelliJ Islands UI themes, editor schemes, provider IDs, and cross-platform packagers."
  );
}
