# Proof Light for IntelliJ Platform

An unofficial Proof Light UI theme and editor color scheme for IntelliJ IDEA and other IntelliJ Platform IDEs.

## Islands support

The theme requires IDE build `253` (2025.3) or newer and inherits from `Islands Light`. It explicitly applies JetBrains' Islands recommendations:

- Proof tool windows sit on a darker, contrast-safe main frame.
- The main toolbar, tool-window stripe, and status-bar borders are transparent.
- Island borders match the tool-window surface.
- The editor tab bar matches the editor canvas.
- Active and inactive selected-tab backgrounds and borders are defined separately.
- Island geometry remains inherited from JetBrains, with the documented defaults recorded explicitly.

## Install a local build

1. Run `npm run package:intellij` from the repository root.
2. Open **Settings > Plugins** in your JetBrains IDE.
3. Use the gear menu and choose **Install Plugin from Disk...**.
4. Select `dist/proof-light-intellij-0.1.0.zip` and restart.
5. Select **Proof Light (Islands)** in **Settings > Appearance & Behavior > Appearance**.

The packager only requires Node.js 18 or newer. It creates the plugin JAR and
outer ZIP directly, with no Bash, JDK `jar`, or system `zip` dependency.

## Development build

The resource-only plugin can also be built with Gradle and the IntelliJ Platform Gradle Plugin 2.x:

```console
gradle buildPlugin
```

This is an unofficial personal-use port and is not affiliated with or endorsed by OpenAI or JetBrains.
