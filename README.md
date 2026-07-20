# Codex Theme Pack

An unofficial port of every appearance theme bundled with the Codex desktop app to:

- Visual Studio Code
- IntelliJ Platform IDEs using the 2025.3+ Islands UI

The pack contains **43 themes across 28 families**: 16 light and 27 dark. See the complete [theme list](THEMES.md).

The original editor colors and TextMate syntax rules are preserved. VS Code receives additional derived workbench and semantic-token colors where the source does not define them. IntelliJ receives a matching editor scheme plus an Islands-aware UI theme for every variant.

## Install

Prebuilt packages are written to `dist/`:

- `codex-theme-pack-vscode-0.2.0.vsix`
- `codex-theme-pack-intellij-0.2.0.zip`

### Visual Studio Code

Open the Command Palette, run **Extensions: Install from VSIX...**, and select the `.vsix`. Then run **Preferences: Color Theme** and choose any theme beginning with **Codex —**.

### IntelliJ IDEA and other JetBrains IDEs

This build requires a 2025.3-or-newer IDE because every variant inherits from either `Islands Light` or `Islands Dark`.

Open **Settings > Plugins**, use the gear menu, choose **Install Plugin from Disk...**, and select the IntelliJ `.zip`. Restart when prompted, then choose a **Codex —** theme under **Settings > Appearance & Behavior > Appearance**.

## Build

Node.js 18 or newer is the only packaging requirement. The IntelliJ packager creates both the plugin JAR and install ZIP directly in Node.js; it does not require Bash, a JDK `jar` command, or a system `zip` command. This works from PowerShell, Command Prompt, and Unix shells.

```console
npm run generate
npm run validate
npm run package
```

The IntelliJ source also has an IntelliJ Platform Gradle Plugin 2.x build for IDE development and Marketplace verification:

```console
cd intellij
gradle buildPlugin
```

## Source data

The normalized source data is in [`palette/codex-themes.json`](palette/codex-themes.json). It was extracted from the exact appearance registry and referenced theme modules bundled with Codex desktop app version `26.715.31925`. [`scripts/import-codex-themes.mjs`](scripts/import-codex-themes.mjs) records the source module mapping, and [`scripts/generate-theme-pack.mjs`](scripts/generate-theme-pack.mjs) deterministically creates both editor integrations.

This project is not affiliated with or endorsed by OpenAI, Microsoft, JetBrains, or the authors of the bundled themes. It is marked unlicensed and intended for personal/local use unless all relevant rights and names are cleared before publication.
