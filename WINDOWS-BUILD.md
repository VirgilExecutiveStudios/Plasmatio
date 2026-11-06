# Windows release

Run `node scripts/release-windows.cjs` after `npm ci`. The build needs NSIS 3.11 or newer (`makensis` on PATH, or set `MAKENSIS`) and network access to the official Electron release download for Windows x64. In the cloud workspace the compiler is installed locally at `/workspace/.tools/nsis`; it was verified against Debian's signed package index. The application's EXE icon is left as Electron's default. NSIS's EXE icons are also unchanged.

The release lives at `releases/windows` and has three visible items:

- `Folder`: a real folder with `desktop.ini` and the provided transparent icon.
- `App.lnk`: launches the app and displays the provided icon.
- `Installer.lnk`: launches the installer and displays the provided icon.

The hidden `.executables` directory holds exactly three executable counterparts: `Folder.exe` (opens Folder), `app/Plasmatio.exe` (the desktop app), and `Setup.exe` (the installer). Electron's DLLs, locales and other runtime files are required; do not move the EXE out of its app directory. The release manifest records SHA-256 hashes of all three executable counterparts.

Running the installer installs per user under `%LOCALAPPDATA%\Programs\PLASMATIO` by default. It adds the three branded desktop shortcuts, sets the real Folder's Explorer icon and hides `.executables`. Windows Explorer's folder icon requires the folder's read-only attribute and desktop.ini's system/hidden attributes, which the installer applies. If simply copying the portable directory, those Windows attributes may need to be applied before Explorer displays the custom folder icon.

Updates happen only by running a newly built installer. There is no updater or update network request. Close the app first. The installer stages a new runtime, replaces the installed app, refreshes Folder.exe and Setup.exe in place, and refreshes the existing shortcuts. Folder contents are preserved. If extraction fails, it retains the previous app runtime.

Each build validates the three generated PE files and then replaces the previous release directory. Old output is removed only after the new release is complete; failed builds leave the previous release intact. There is one current release, with stable filenames. The scripts never remove installed user Folder data.

Windows compilation and PE/header checks can run on Linux. Installation, Explorer shortcut/icon rendering, SmartScreen behavior and update replacement must also be tested on Windows before distribution. These binaries are unsigned; no signing certificate was provided.

The preferred installation entry point is the standalone `PLASMATIO-Installer.exe`, copied from the current release's `Setup.exe`. Run it directly on Windows; do not run shortcuts inside a ZIP. Successful installation opens the installed directory and launches the app. Its visible entries are `Folder`, `App`, and `Installer`, and three corresponding PLASMATIO desktop shortcuts are created with absolute targets and icon paths. Older PLASMATIO shortcut names are removed.

All three executables carry `CompanyName: Virgil` version metadata. This is file metadata, not Authenticode verification. A trusted signing certificate is required for Windows to display Virgil as a verified publisher.
