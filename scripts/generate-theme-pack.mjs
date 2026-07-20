import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(await readFile(resolve(repoRoot, "palette/codex-themes.json"), "utf8"));
const workspaceManifest = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
const vscodeRoot = resolve(repoRoot, "vscode");
const vscodeThemesRoot = resolve(vscodeRoot, "themes");
const intellijResourcesRoot = resolve(repoRoot, "intellij/src/main/resources");
const intellijThemesRoot = resolve(intellijResourcesRoot, "themes");

const hexPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function parseHex(value) {
  if (typeof value !== "string" || !hexPattern.test(value)) return null;
  let hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((character) => character.repeat(2)).join("");
  }
  if (hex.length === 6) hex += "ff";
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
    alpha: Number.parseInt(hex.slice(6, 8), 16) / 255
  };
}

function toHex({ red, green, blue }) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function solid(value, background = "#000000") {
  const foreground = parseHex(value) ?? parseHex(background);
  const backdrop = parseHex(background) ?? parseHex("#000000");
  return toHex({
    red: foreground.red * foreground.alpha + backdrop.red * (1 - foreground.alpha),
    green: foreground.green * foreground.alpha + backdrop.green * (1 - foreground.alpha),
    blue: foreground.blue * foreground.alpha + backdrop.blue * (1 - foreground.alpha)
  });
}

function mix(first, second, firstWeight) {
  const left = parseHex(solid(first));
  const right = parseHex(solid(second));
  return toHex({
    red: left.red * firstWeight + right.red * (1 - firstWeight),
    green: left.green * firstWeight + right.green * (1 - firstWeight),
    blue: left.blue * firstWeight + right.blue * (1 - firstWeight)
  });
}

function withAlpha(value, alpha) {
  return `${solid(value)}${alpha}`;
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

function readableForeground(background) {
  return contrast(background, "#ffffff") >= contrast(background, "#000000")
    ? "#ffffff"
    : "#000000";
}

function scopeText(rule) {
  const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope ?? ""];
  return scopes.join(" ").toLowerCase();
}

function findRule(theme, needles, fallback) {
  const rule = theme.tokenColors.find((candidate) => {
    const scopes = scopeText(candidate);
    return needles.some((needle) => scopes.includes(needle));
  });
  const foreground = rule?.settings?.foreground;
  return {
    color: solid(foreground ?? fallback, theme.background),
    fontStyle: rule?.settings?.fontStyle ?? ""
  };
}

function firstColor(theme, keys, fallback) {
  for (const key of keys) {
    const value = theme.colors[key];
    if (parseHex(value) != null) return solid(value, theme.background);
  }
  return solid(fallback, theme.background);
}

function frameColor(theme, editor, surface) {
  const preferred = firstColor(
    theme,
    ["activityBar.background", "statusBar.background", "titleBar.activeBackground"],
    surface
  );
  const target = theme.type === "dark" ? "#ffffff" : "#000000";
  const shouldBeBrighter = theme.type === "dark";
  for (let amount = 0; amount <= 0.7; amount += 0.02) {
    const candidate = mix(target, preferred, amount);
    const directionIsCorrect = shouldBeBrighter
      ? luminance(candidate) > Math.max(luminance(editor), luminance(surface))
      : luminance(candidate) < Math.min(luminance(editor), luminance(surface));
    if (
      directionIsCorrect &&
      contrast(candidate, editor) >= 1.2 &&
      contrast(candidate, surface) >= 1.2
    ) {
      return candidate;
    }
  }
  return mix(target, preferred, 0.7);
}

function normalizeTheme(theme) {
  const editor = solid(theme.background, theme.type === "dark" ? "#111111" : "#ffffff");
  const foreground = solid(theme.foreground, editor);
  const chrome = theme.chromeTheme ?? {};
  const surface = solid(
    chrome.surface ?? firstColor(
      theme,
      ["sideBar.background", "panel.background", "editorGroupHeader.tabsBackground"],
      editor
    ),
    editor
  );
  const accent = solid(
    chrome.accent ?? firstColor(
      theme,
      [
        "activityBarBadge.background",
        "textLink.foreground",
        "editorCursor.foreground",
        "focusBorder",
        "button.background",
        "activityBar.activeBorder"
      ],
      theme.type === "dark" ? "#7aa2f7" : "#375a9e"
    ),
    editor
  );
  const comment = findRule(theme, ["comment"], mix(foreground, editor, 0.58));
  const string = findRule(theme, ["string.quoted", "string"], accent);
  const constant = findRule(theme, ["constant.numeric", "constant.language.boolean", "constant.language"], accent);
  const keyword = findRule(theme, ["keyword.control", "keyword", "storage.type"], accent);
  const type = findRule(theme, ["entity.name.type", "support.type", "support.class"], keyword.color);
  const functionName = findRule(theme, ["entity.name.function", "support.function", "variable.function"], accent);
  const punctuation = findRule(theme, ["punctuation", "keyword.operator"], mix(foreground, editor, 0.72));
  const variable = findRule(theme, ["variable", "meta.property-name"], foreground);
  const error = solid(
    chrome.semanticColors?.diffRemoved ?? firstColor(
      theme,
      ["editorError.foreground", "gitDecoration.deletedResourceForeground", "terminal.ansiRed"],
      theme.type === "dark" ? "#ff6b6b" : "#b84a45"
    ),
    editor
  );
  const added = solid(
    chrome.semanticColors?.diffAdded ?? firstColor(
      theme,
      ["gitDecoration.addedResourceForeground", "terminal.ansiGreen"],
      string.color
    ),
    editor
  );
  const frame = frameColor(theme, editor, surface);
  return {
    accent,
    added,
    comment,
    constant,
    editor,
    error,
    foreground: solid(chrome.ink ?? foreground, editor),
    frame,
    frameSoft: mix(frame, surface, 0.48),
    functionName,
    keyword,
    onAccent: readableForeground(accent),
    punctuation,
    selected: mix(accent, editor, theme.type === "dark" ? 0.3 : 0.16),
    string,
    surface,
    type,
    variable
  };
}

function semanticTokenColors(palette) {
  return {
    comment: palette.comment.color,
    string: palette.string.color,
    number: palette.constant.color,
    regexp: palette.constant.color,
    keyword: palette.keyword.color,
    modifier: palette.keyword.color,
    type: palette.type.color,
    class: palette.type.color,
    enum: palette.type.color,
    interface: palette.type.color,
    struct: palette.type.color,
    typeParameter: palette.type.color,
    function: palette.functionName.color,
    method: palette.functionName.color,
    variable: palette.variable.color,
    parameter: palette.variable.color,
    property: palette.variable.color,
    enumMember: palette.constant.color,
    operator: palette.punctuation.color,
    namespace: palette.type.color,
    macro: palette.keyword.color,
    decorator: palette.keyword.color
  };
}

function vscodeTheme(theme, palette) {
  const sourceColors = Object.fromEntries(
    Object.entries(theme.colors).flatMap(([key, value]) => {
      if (typeof value === "string") return [[key, value]];
      if (Array.isArray(value)) {
        const firstColor = value.find((candidate) => typeof candidate === "string");
        return firstColor == null ? [] : [[key, firstColor]];
      }
      return [];
    }),
  );
  const derived = {
    foreground: palette.foreground,
    focusBorder: palette.accent,
    descriptionForeground: palette.comment.color,
    errorForeground: palette.error,
    "titleBar.activeBackground": palette.frame,
    "titleBar.activeForeground": readableForeground(palette.frame),
    "titleBar.inactiveBackground": palette.frameSoft,
    "activityBar.background": palette.frame,
    "activityBar.foreground": readableForeground(palette.frame),
    "activityBar.activeBorder": palette.accent,
    "activityBarBadge.background": palette.accent,
    "activityBarBadge.foreground": palette.onAccent,
    "sideBar.background": palette.surface,
    "sideBar.foreground": palette.foreground,
    "sideBarTitle.foreground": palette.foreground,
    "sideBarSectionHeader.background": palette.frameSoft,
    "list.activeSelectionBackground": palette.selected,
    "list.activeSelectionForeground": palette.foreground,
    "list.inactiveSelectionBackground": palette.frameSoft,
    "list.hoverBackground": palette.frameSoft,
    "editorGroupHeader.tabsBackground": palette.surface,
    "tab.activeBackground": palette.editor,
    "tab.activeForeground": palette.foreground,
    "tab.activeBorderTop": palette.accent,
    "tab.inactiveBackground": palette.surface,
    "tab.inactiveForeground": palette.comment.color,
    "editor.background": palette.editor,
    "editor.foreground": palette.foreground,
    "editorCursor.foreground": palette.accent,
    "editorLineNumber.foreground": palette.comment.color,
    "editorLineNumber.activeForeground": palette.accent,
    "editor.selectionBackground": palette.selected,
    "editor.inactiveSelectionBackground": palette.frameSoft,
    "editor.lineHighlightBackground": withAlpha(palette.surface, "80"),
    "editor.findMatchBackground": withAlpha(palette.constant.color, "70"),
    "editorWhitespace.foreground": palette.frameSoft,
    "editorIndentGuide.background1": palette.frameSoft,
    "editorIndentGuide.activeBackground1": palette.comment.color,
    "editorError.foreground": palette.error,
    "editorWarning.foreground": palette.constant.color,
    "editorInfo.foreground": palette.keyword.color,
    "editorHint.foreground": palette.accent,
    "diffEditor.insertedTextBackground": withAlpha(palette.added, "24"),
    "diffEditor.removedTextBackground": withAlpha(palette.error, "24"),
    "panel.background": palette.surface,
    "panel.border": palette.frame,
    "statusBar.background": palette.frame,
    "statusBar.foreground": readableForeground(palette.frame),
    "button.background": palette.accent,
    "button.foreground": palette.onAccent,
    "button.hoverBackground": mix(readableForeground(palette.accent), palette.accent, 0.12),
    "input.background": palette.editor,
    "input.foreground": palette.foreground,
    "input.border": palette.frameSoft,
    "input.placeholderForeground": palette.comment.color,
    "badge.background": palette.accent,
    "badge.foreground": palette.onAccent,
    "progressBar.background": palette.accent,
    "textLink.foreground": palette.accent,
    "editorWidget.background": palette.surface,
    "editorWidget.foreground": palette.foreground,
    "editorWidget.border": palette.frame,
    "menu.background": palette.surface,
    "menu.foreground": palette.foreground,
    "menu.selectionBackground": palette.selected,
    "quickInput.background": palette.surface,
    "quickInput.foreground": palette.foreground,
    "quickInputList.focusBackground": palette.selected,
    "terminal.background": palette.editor,
    "terminal.foreground": palette.foreground,
    "terminalCursor.foreground": palette.accent,
    "gitDecoration.addedResourceForeground": palette.added,
    "gitDecoration.deletedResourceForeground": palette.error,
    "gitDecoration.modifiedResourceForeground": palette.keyword.color
  };
  return {
    $schema: "vscode://schemas/color-theme",
    name: `Codex — ${theme.displayName}`,
    type: theme.type,
    semanticHighlighting: true,
    colors: { ...derived, ...sourceColors },
    tokenColors: theme.tokenColors,
    semanticTokenColors: {
      ...semanticTokenColors(palette),
      ...(theme.semanticTokenColors ?? {})
    }
  };
}

function intellijUiTheme(theme, palette) {
  return {
    name: `Codex — ${theme.displayName}`,
    dark: theme.type === "dark",
    author: "Leon",
    editorScheme: `/themes/${theme.id}.xml`,
    parentTheme: theme.type === "dark" ? "Islands Dark" : "Islands Light",
    colors: {
      packEditor: palette.editor.toUpperCase(),
      packSurface: palette.surface.toUpperCase(),
      packFrame: palette.frame.toUpperCase(),
      packFrameSoft: palette.frameSoft.toUpperCase(),
      packForeground: palette.foreground.toUpperCase(),
      packSecondary: palette.comment.color.toUpperCase(),
      packAccent: palette.accent.toUpperCase(),
      packAccentMuted: palette.selected.toUpperCase(),
      packKeyword: palette.keyword.color.toUpperCase(),
      packConstant: palette.constant.color.toUpperCase(),
      packError: palette.error.toUpperCase(),
      packOnAccent: palette.onAccent.toUpperCase(),
      packTransparent: withAlpha(palette.frame, "00").toUpperCase()
    },
    ui: {
      Islands: 1,
      "Island.arc": 20,
      "Island.arc.compact": 16,
      "Island.borderWidth": 5,
      "Island.borderWidth.compact": 4,
      "Island.borderColor": "packSurface",
      "Island.inactiveAlpha": 0.44,
      "MainWindow.background": "packFrame",
      "MainToolbar.background": "packFrame",
      "MainToolbar.borderColor": "packTransparent",
      "StatusBar.background": "packFrame",
      "StatusBar.borderColor": "packTransparent",
      "ToolWindow.Stripe.background": "packFrame",
      "ToolWindow.Stripe.borderColor": "packTransparent",
      "ToolWindow.background": "packSurface",
      "ToolWindow.Header.background": "packSurface",
      "ToolWindow.Header.inactiveBackground": "packSurface",
      "ToolWindow.HeaderTab.selectedBackground": "packAccentMuted",
      "ToolWindow.HeaderTab.selectedForeground": "packForeground",
      "ToolWindow.HeaderTab.hoverBackground": "packFrameSoft",
      "EditorTabs.background": "packEditor",
      "EditorTabs.underlinedBorderColor": "packAccent",
      "EditorTabs.inactiveUnderlinedTabBorderColor": "packSecondary",
      "EditorTabs.underlinedTabBackground": "packSurface",
      "EditorTabs.inactiveUnderlinedTabBackground": "packFrameSoft",
      "EditorTabs.selectedForeground": "packForeground",
      "EditorTabs.inactiveForeground": "packSecondary",
      "EditorTabs.hoverBackground": "packSurface",
      "EditorTabs.inactiveHoverBackground": "packFrameSoft",
      "Panel.background": "packEditor",
      "Viewport.background": "packEditor",
      "SplitPane.background": "packFrame",
      "Separator.separatorColor": "packFrame",
      "Borders.color": "packFrame",
      "Label.foreground": "packForeground",
      "Label.disabledForeground": "packSecondary",
      "Label.infoForeground": "packSecondary",
      "Label.errorForeground": "packError",
      "Link.activeForeground": "packAccent",
      "Link.hoverForeground": "packAccent",
      "List.background": "packEditor",
      "List.foreground": "packForeground",
      "List.selectionBackground": "packAccentMuted",
      "List.selectionForeground": "packForeground",
      "List.inactiveSelectionBackground": "packFrameSoft",
      "Tree.background": "packSurface",
      "Tree.foreground": "packForeground",
      "Tree.selectionBackground": "packAccentMuted",
      "Tree.selectionForeground": "packForeground",
      "Tree.inactiveSelectionBackground": "packFrameSoft",
      "Tree.hoverBackground": "packFrameSoft",
      "Table.background": "packEditor",
      "Table.foreground": "packForeground",
      "Table.selectionBackground": "packAccentMuted",
      "Table.selectionForeground": "packForeground",
      "Table.gridColor": "packFrame",
      "TextField.background": "packEditor",
      "TextField.foreground": "packForeground",
      "TextField.inactiveForeground": "packSecondary",
      "TextArea.background": "packEditor",
      "TextArea.foreground": "packForeground",
      "Component.focusColor": "packAccent",
      "Component.borderColor": "packFrame",
      "Component.errorFocusColor": "packError",
      "Focus.color": "packAccent",
      "Button.startBackground": "packSurface",
      "Button.endBackground": "packSurface",
      "Button.foreground": "packForeground",
      "Button.default.startBackground": "packAccent",
      "Button.default.endBackground": "packAccent",
      "Button.default.foreground": "packOnAccent",
      "ActionButton.hoverBackground": "packFrameSoft",
      "ActionButton.pressedBackground": "packAccentMuted",
      "ComboBox.background": "packEditor",
      "ComboBox.nonEditableBackground": "packEditor",
      "ComboBox.selectionBackground": "packAccentMuted",
      "ComboBox.selectionForeground": "packForeground",
      "Popup.background": "packSurface",
      "Popup.borderColor": "packFrame",
      "Popup.Header.background": "packFrameSoft",
      "Popup.Header.foreground": "packForeground",
      "Menu.background": "packSurface",
      "Menu.foreground": "packForeground",
      "Menu.selectionBackground": "packAccentMuted",
      "Menu.selectionForeground": "packForeground",
      "PopupMenu.background": "packSurface",
      "PopupMenu.foreground": "packForeground",
      "PopupMenu.selectionBackground": "packAccentMuted",
      "PopupMenu.selectionForeground": "packForeground",
      "SearchEverywhere.Header.background": "packFrameSoft",
      "SearchEverywhere.SearchField.background": "packEditor",
      "SearchEverywhere.SearchField.foreground": "packForeground",
      "SearchEverywhere.List.background": "packSurface",
      "SearchEverywhere.List.selectionBackground": "packAccentMuted",
      "CompletionPopup.background": "packSurface",
      "CompletionPopup.foreground": "packForeground",
      "CompletionPopup.selectionBackground": "packAccentMuted",
      "CompletionPopup.matchForeground": "packAccent",
      "Notification.background": "packSurface",
      "Notification.foreground": "packForeground",
      "Notification.borderColor": "packFrame",
      "ProgressBar.trackColor": "packFrameSoft",
      "ProgressBar.progressColor": "packAccent",
      "ProgressBar.failedColor": "packError",
      "ProgressBar.passedColor": "packAccent",
      "ScrollBar.background": "packTransparent",
      "ScrollBar.trackColor": "packTransparent",
      "ScrollBar.thumbColor": withAlpha(palette.comment.color, "55").toUpperCase(),
      "ScrollBar.hoverThumbColor": withAlpha(palette.comment.color, "88").toUpperCase(),
      "Badge.background": "packAccent",
      "Badge.foreground": "packOnAccent",
      "Counter.background": "packAccent",
      "Counter.foreground": "packOnAccent"
    }
  };
}

function xmlHex(value) {
  return solid(value).slice(1).toUpperCase();
}

function fontType(fontStyle) {
  const bold = fontStyle.includes("bold");
  const italic = fontStyle.includes("italic");
  return bold && italic ? 3 : bold ? 1 : italic ? 2 : 0;
}

function xmlAttribute(name, rule, options = {}) {
  const values = [];
  if (rule?.color != null) values.push(["FOREGROUND", rule.color]);
  if (options.background != null) values.push(["BACKGROUND", options.background]);
  const style = fontType(rule?.fontStyle ?? "");
  if (style !== 0) values.push(["FONT_TYPE", `${style}`]);
  if (options.effectColor != null) values.push(["EFFECT_COLOR", options.effectColor]);
  if (options.effectType != null) values.push(["EFFECT_TYPE", `${options.effectType}`]);
  return [
    `        <option name="${name}">`,
    "            <value>",
    ...values.map(([key, value]) =>
      `                <option name="${key}" value="${key === "FONT_TYPE" || key === "EFFECT_TYPE" ? value : xmlHex(value)}"/>`
    ),
    "            </value>",
    "        </option>"
  ].join("\n");
}

function intellijEditorScheme(theme, palette) {
  const rules = [
    xmlAttribute("TEXT", { color: palette.foreground }, { background: palette.editor }),
    xmlAttribute("DEFAULT_IDENTIFIER", palette.variable),
    xmlAttribute("DEFAULT_KEYWORD", palette.keyword),
    xmlAttribute("DEFAULT_STRING", palette.string),
    xmlAttribute("DEFAULT_VALID_STRING_ESCAPE", palette.string),
    xmlAttribute("DEFAULT_NUMBER", palette.constant),
    xmlAttribute("DEFAULT_CONSTANT", palette.constant),
    xmlAttribute("DEFAULT_LINE_COMMENT", palette.comment),
    xmlAttribute("DEFAULT_BLOCK_COMMENT", palette.comment),
    xmlAttribute("DEFAULT_DOC_COMMENT", palette.comment),
    xmlAttribute("DEFAULT_DOC_COMMENT_TAG", palette.keyword),
    xmlAttribute("DEFAULT_DOC_MARKUP", palette.punctuation),
    xmlAttribute("DEFAULT_CLASS_NAME", palette.type),
    xmlAttribute("DEFAULT_INTERFACE_NAME", palette.type),
    xmlAttribute("DEFAULT_ENUM_NAME", palette.type),
    xmlAttribute("DEFAULT_TYPE_PARAMETER_NAME", palette.type),
    xmlAttribute("DEFAULT_FUNCTION_DECLARATION", palette.functionName),
    xmlAttribute("DEFAULT_FUNCTION_CALL", palette.functionName),
    xmlAttribute("DEFAULT_INSTANCE_METHOD", palette.functionName),
    xmlAttribute("DEFAULT_STATIC_METHOD", palette.functionName),
    xmlAttribute("DEFAULT_OPERATION_SIGN", palette.punctuation),
    xmlAttribute("DEFAULT_BRACES", palette.punctuation),
    xmlAttribute("DEFAULT_BRACKETS", palette.punctuation),
    xmlAttribute("DEFAULT_PARENTHS", palette.punctuation),
    xmlAttribute("DEFAULT_COMMA", palette.punctuation),
    xmlAttribute("DEFAULT_DOT", palette.punctuation),
    xmlAttribute("DEFAULT_SEMICOLON", palette.punctuation),
    xmlAttribute("DEFAULT_LOCAL_VARIABLE", palette.variable),
    xmlAttribute("DEFAULT_PARAMETER", palette.variable),
    xmlAttribute("DEFAULT_INSTANCE_FIELD", palette.variable),
    xmlAttribute("DEFAULT_STATIC_FIELD", palette.variable),
    xmlAttribute("DEFAULT_METADATA", palette.keyword),
    xmlAttribute("DEFAULT_PREDEFINED_SYMBOL", palette.constant),
    xmlAttribute("ERRORS_ATTRIBUTES", null, { effectColor: palette.error, effectType: 2 }),
    xmlAttribute("WARNING_ATTRIBUTES", null, { effectColor: palette.constant.color, effectType: 2 }),
    xmlAttribute("INFO_ATTRIBUTES", null, { effectColor: palette.keyword.color, effectType: 1 }),
    xmlAttribute("HYPERLINK_ATTRIBUTES", { color: palette.accent }, { effectColor: palette.accent, effectType: 1 }),
    xmlAttribute("SEARCH_RESULT_ATTRIBUTES", null, { background: mix(palette.constant.color, palette.editor, 0.3) }),
    xmlAttribute("WRITE_SEARCH_RESULT_ATTRIBUTES", null, { background: palette.selected }),
    xmlAttribute("FOLDED_TEXT_ATTRIBUTES", { color: palette.comment.color }, { background: palette.surface }),
    xmlAttribute("INJECTED_LANGUAGE_FRAGMENT", null, { background: palette.surface }),
    xmlAttribute("MATCHED_BRACE_ATTRIBUTES", { color: palette.accent }, { background: palette.selected, effectColor: palette.accent, effectType: 1 }),
    xmlAttribute("UNMATCHED_BRACE_ATTRIBUTES", { color: palette.error }, { effectColor: palette.error, effectType: 2 })
  ];
  const colors = {
    CARET_COLOR: palette.accent,
    CARET_ROW_COLOR: palette.surface,
    CONSOLE_BACKGROUND_KEY: palette.editor,
    GUTTER_BACKGROUND: palette.editor,
    LINE_NUMBERS_COLOR: palette.comment.color,
    LINE_NUMBER_ON_CARET_ROW_COLOR: palette.accent,
    SELECTION_BACKGROUND: palette.selected,
    SELECTION_FOREGROUND: palette.foreground,
    INACTIVE_SELECTION_BACKGROUND: palette.frameSoft,
    WHITESPACES: palette.frameSoft,
    INDENT_GUIDE: palette.frameSoft,
    SELECTED_INDENT_GUIDE: palette.comment.color,
    RIGHT_MARGIN_COLOR: palette.frameSoft,
    METHOD_SEPARATORS_COLOR: palette.frame,
    TEARLINE_COLOR: palette.frame,
    VISUAL_INDENT_GUIDE: palette.frameSoft,
    ADDED_LINES_COLOR: mix(palette.added, palette.editor, 0.24),
    MODIFIED_LINES_COLOR: mix(palette.keyword.color, palette.editor, 0.22),
    DELETED_LINES_COLOR: mix(palette.error, palette.editor, 0.22)
  };
  return [
    `<scheme name="Codex — ${theme.displayName}" version="142" parent_scheme="${theme.type === "dark" ? "Darcula" : "Default"}">`,
    "    <metaInfo>",
    `        <property name="created">2026-07-20T00:00:00</property>`,
    `        <property name="ide">idea</property>`,
    `        <property name="ideVersion">2025.3</property>`,
    `        <property name="originalScheme">Codex — ${theme.displayName}</property>`,
    "    </metaInfo>",
    "    <option name=\"LINE_SPACING\" value=\"1.15\"/>",
    "    <colors>",
    ...Object.entries(colors).map(([name, value]) =>
      `        <option name="${name}" value="${xmlHex(value)}"/>`
    ),
    "    </colors>",
    "    <attributes>",
    ...rules,
    "    </attributes>",
    "</scheme>",
    ""
  ].join("\n");
}

function providerId(themeId) {
  const hash = createHash("sha256").update(`dev.leon.codex-theme-pack:${themeId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function pluginXml(themes) {
  const providers = themes.map((theme) =>
    `        <themeProvider id="${providerId(theme.id)}" path="/themes/${theme.id}.theme.json"/>`
  );
  return [
    "<idea-plugin>",
    "    <id>dev.leon.codex-theme-pack</id>",
    "    <name>Codex Theme Pack</name>",
    `    <version>${workspaceManifest.version}</version>`,
    "    <vendor>Leon</vendor>",
    "    <description><![CDATA[",
    `        An unofficial pack of all ${themes.length} light and dark appearance themes bundled with the Codex desktop app,`,
    "        adapted for the IntelliJ Platform 2025.3+ Islands UI.",
    "    ]]></description>",
    "    <change-notes><![CDATA[",
    `        <h3>${workspaceManifest.version}</h3>`,
    `        <p>Expanded to ${themes.length} Codex appearance themes with matching editor schemes and Islands UI support.</p>`,
    "    ]]></change-notes>",
    "    <idea-version since-build=\"253\"/>",
    "    <depends>com.intellij.modules.platform</depends>",
    "    <extensions defaultExtensionNs=\"com.intellij\">",
    ...providers,
    "    </extensions>",
    "</idea-plugin>",
    ""
  ].join("\n");
}

await rm(vscodeThemesRoot, { force: true, recursive: true });
await rm(intellijThemesRoot, { force: true, recursive: true });
await mkdir(vscodeThemesRoot, { recursive: true });
await mkdir(intellijThemesRoot, { recursive: true });

for (const theme of source.themes) {
  const palette = normalizeTheme(theme);
  await writeFile(
    resolve(vscodeThemesRoot, `${theme.id}-color-theme.json`),
    `${JSON.stringify(vscodeTheme(theme, palette), null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    resolve(intellijThemesRoot, `${theme.id}.theme.json`),
    `${JSON.stringify(intellijUiTheme(theme, palette), null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    resolve(intellijThemesRoot, `${theme.id}.xml`),
    intellijEditorScheme(theme, palette),
    "utf8"
  );
}

const vscodeManifest = JSON.parse(await readFile(resolve(vscodeRoot, "package.json"), "utf8"));
Object.assign(vscodeManifest, {
  name: "codex-theme-pack",
  displayName: "Codex Theme Pack",
  description: `All ${source.themes.length} light and dark appearance themes bundled with Codex.`,
  version: workspaceManifest.version,
  galleryBanner: { color: "#111111", theme: "dark" }
});
vscodeManifest.contributes = {
  themes: source.themes.map((theme) => ({
    label: `Codex — ${theme.displayName}`,
    uiTheme: theme.type === "dark" ? "vs-dark" : "vs",
    path: `./themes/${theme.id}-color-theme.json`
  }))
};
await writeFile(resolve(vscodeRoot, "package.json"), `${JSON.stringify(vscodeManifest, null, 2)}\n`, "utf8");
await writeFile(resolve(intellijResourcesRoot, "META-INF/plugin.xml"), pluginXml(source.themes), "utf8");

const families = new Map();
for (const theme of source.themes) {
  const modes = families.get(theme.family) ?? [];
  modes.push(theme.type === "dark" ? "Dark" : "Light");
  families.set(theme.family, modes);
}
const themeTable = [
  "# Included Codex themes",
  "",
  `Extracted from Codex desktop app ${source.source.applicationVersion}.`,
  "",
  "| Family | Variants |",
  "|---|---|",
  ...[...families.entries()].map(([family, modes]) => `| ${family} | ${modes.join(", ")} |`),
  "",
  `Total: **${source.themes.length} themes** — ` +
    `**${source.themes.filter(({ type }) => type === "light").length} light**, ` +
    `**${source.themes.filter(({ type }) => type === "dark").length} dark**.`,
  ""
].join("\n");
await writeFile(resolve(repoRoot, "THEMES.md"), themeTable, "utf8");

console.log(
  `Generated ${source.themes.length} VS Code themes, ${source.themes.length} IntelliJ UI themes, ` +
  `and ${source.themes.length} IntelliJ editor schemes.`
);
