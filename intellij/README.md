# Codex Theme Pack for IntelliJ Platform

An unofficial collection of 43 Codex-inspired UI themes and matching editor color schemes for IntelliJ IDEA and other IntelliJ Platform IDEs.

## Islands support

The plugin requires IDE build `253` (2025.3) or newer. Each light theme inherits from `Islands Light`; each dark theme inherits from `Islands Dark`. Every variant also applies the current Islands integration guidance:

- Tool windows sit on a directionally contrast-safe main frame.
- Main-toolbar, tool-window-stripe, and status-bar borders are transparent.
- Island borders match the tool-window surface.
- The editor tab bar matches the editor canvas.
- Active and inactive selected tabs have separate backgrounds and borders.
- Island geometry remains inherited from JetBrains.

## Install a local build

1. Run `npm run package:intellij` from the repository root.
2. Open **Settings > Plugins** in your JetBrains IDE.
3. Use the gear menu and choose **Install Plugin from Disk...**.
4. Select `dist/codex-theme-pack-intellij-0.2.0.zip` and restart.
5. Choose any **Codex —** theme under **Settings > Appearance & Behavior > Appearance**.

The packager only requires Node.js 18 or newer. It writes the plugin JAR and outer ZIP directly, with no Bash, JDK `jar`, or system `zip` dependency.

## Development build

The resource-only plugin can also be built with Gradle and the IntelliJ Platform Gradle Plugin 2.x:

```console
gradle buildPlugin
```

This is an unofficial personal-use port and is not affiliated with or endorsed by OpenAI, JetBrains, or the authors of the bundled themes.
