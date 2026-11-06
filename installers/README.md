# Windows installer

Current build: PLASMATIO 1.1.1. Company metadata: Virgil.

Download `PLASMATIO-Installer.exe` using GitHub’s **Download raw file** action, save it to Windows, then run it. This installer embeds the app runtime and folder launcher; no ZIP extraction or relative shortcuts are required. SHA256SUMS records its checksum.

The installer creates the branded App, Installer, and Folder items. This is an unsigned, Linux-cross-compiled build. Actual Windows installation, updates, Explorer icons, and the user's reported loading failure remain unverified.

After a successful future Windows build, replace this file from `releases/windows/.executables/Setup.exe` and update the checksum. Do not overwrite the last installer with a failed or incomplete build.
