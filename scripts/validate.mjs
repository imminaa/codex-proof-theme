import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));

const palette = await readJson("palette/proof-light.json");
const workspaceManifest = await readJson("package.json");
const vscodeManifest = await readJson("vscode/package.json");
const vscodeTheme = await readJson("vscode/themes/proof-light-color-theme.json");
const intellijTheme = await readJson("intellij/src/main/resources/themes/Proof.theme.json");
const pluginXml = await readFile(resolve(root, "intellij/src/main/resources/META-INF/plugin.xml"), "utf8");
const editorScheme = await readFile(resolve(root, "intellij/src/main/resources/themes/Proof.xml"), "utf8");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const expectedOriginals = new Set([
  "#f5f3ed",
  "#efede6",
  "#2f312d",
  "#4b4d48",
  "#3d755d",
  "#5f6ac2",
  "#d3b45b",
  "#8b877c",
  "#7a766d"
]);

for (const color of palette.notes.originalColors) {
  check(expectedOriginals.has(color.toLowerCase()), `Unexpected original palette color: ${color}`);
}
check(
  palette.notes.originalColors.length === expectedOriginals.size,
  "The original Proof palette must contain exactly nine colors."
);

check(vscodeManifest.contributes?.themes?.[0]?.path === "./themes/proof-light-color-theme.json", "VS Code manifest theme path is incorrect.");
check(vscodeManifest.contributes?.themes?.[0]?.uiTheme === "vs", "Proof Light must use the VS Code light UI base.");
check(vscodeTheme.type === "light", "VS Code theme must be light.");
check(vscodeTheme.colors["editor.background"] === palette.colors.editorBackground, "VS Code editor background drifted from the source palette.");
check(vscodeTheme.colors["editor.foreground"] === palette.colors.foreground, "VS Code editor foreground drifted from the source palette.");
check(vscodeTheme.colors["focusBorder"] === palette.colors.accent, "VS Code accent drifted from the source palette.");
check(
  workspaceManifest.scripts?.["package:intellij"] === "node scripts/package-intellij.mjs",
  "IntelliJ packaging must use the cross-platform Node packager."
);

check(intellijTheme.parentTheme === "Islands Light", "IntelliJ theme must inherit Islands Light.");
check(intellijTheme.ui.Islands === 1, "IntelliJ theme must opt into Islands rendering.");
check(intellijTheme.ui["Island.borderColor"] === "proofSurface", "Island border must match the tool-window surface.");
check(intellijTheme.ui["ToolWindow.background"] === "proofSurface", "Tool-window background must use the Proof surface.");
check(intellijTheme.ui["EditorTabs.background"] === "proofEditor", "Editor tab bar must match the editor background.");
check(intellijTheme.ui["StatusBar.borderColor"].endsWith("00"), "Status bar border must be transparent.");
check(intellijTheme.ui["ToolWindow.Stripe.borderColor"].endsWith("00"), "Tool-window stripe border must be transparent.");
check(intellijTheme.ui["MainToolbar.borderColor"].endsWith("00"), "Main toolbar border must be transparent.");

const luminance = (hex) => {
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (left, right) => {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

check(
  contrast(palette.colors.editorBackground, palette.colors.frameBackground) >= 1.2,
  "IntelliJ editor/frame contrast must satisfy the Islands 1.20:1 recommendation."
);
check(
  contrast(palette.colors.surfaceBackground, palette.colors.frameBackground) >= 1.2,
  "IntelliJ tool-window/frame contrast must satisfy the Islands 1.20:1 recommendation."
);

check(pluginXml.includes('<idea-version since-build="253"'), "IntelliJ plugin must require build 253 for Islands Light.");
check(pluginXml.includes('path="/themes/Proof.theme.json"'), "IntelliJ theme provider path is incorrect.");
check(editorScheme.includes('name="Proof Light"'), "IntelliJ editor scheme name is incorrect.");
check(editorScheme.includes('BACKGROUND" value="F5F3ED"'), "IntelliJ editor scheme background drifted from the source palette.");

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Validated Proof palette, VS Code theme, IntelliJ Islands theme, editor scheme, and cross-platform packager.");
}
