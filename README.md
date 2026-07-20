# Proof Light themes

An unofficial, faithful port of the Codex desktop app's **Proof Light** theme to:

- Visual Studio Code
- IntelliJ Platform IDEs using the 2025.3+ Islands UI

The original editor, surface, foreground, accent, and syntax colors are preserved exactly. A few documented derived colors fill gaps that the source theme does not define, such as diagnostics and the darker frame required by IntelliJ's Islands contrast guidance.

## Install

Prebuilt packages are written to `dist/`:

- `proof-light-vscode-0.1.0.vsix`
- `proof-light-intellij-0.1.0.zip`

### VS Code

Open the Command Palette, run **Extensions: Install from VSIX...**, select the `.vsix`, then choose **Proof Light** with **Preferences: Color Theme**.

### IntelliJ IDEA and other JetBrains IDEs

This build requires a 2025.3-or-newer IDE because it inherits from `Islands Light`.

Open **Settings > Plugins**, use the gear menu, choose **Install Plugin from Disk...**, and select the IntelliJ `.zip`. Restart when prompted, then select **Proof Light (Islands)** under **Settings > Appearance & Behavior > Appearance**.

## Build

Requirements:

- Node.js 18 or newer

The IntelliJ packager is dependency-free and creates both the plugin JAR and
install ZIP in Node.js. It does not require Bash, `jar`, or `zip`, so the same
command works in PowerShell, Command Prompt, and Unix shells.

```console
npm run validate
npm run package
```

The IntelliJ source also includes a current Gradle IntelliJ Platform 2.x build for development and Marketplace verification:

```console
cd intellij
gradle buildPlugin
```

## Source palette

The shared palette is in [`palette/proof-light.json`](palette/proof-light.json). The source was extracted from Codex desktop app version `26.715.31925`, where it was packaged inside `app.asar` as `webview/assets/proof-light-C-6lYh5j.js`.

This project is not affiliated with or endorsed by OpenAI or JetBrains. The theme is marked unlicensed and intended for personal/local use unless the relevant rights and names are cleared before publication.
