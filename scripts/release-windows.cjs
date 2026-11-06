'use strict';

// Build into a new directory, validate all three PE files, then replace the
// previous release. Old executables are never deleted before the build succeeds.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const packager = require('@electron/packager');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const releaseRoot = path.join(root, 'releases');
const output = path.join(releaseRoot, 'windows');
const icon = path.join(root, 'assets/branding/plasmatio.ico');

function run(command, args, options = {}) {
  const child = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`${command} exited with ${child.status}`);
}

// MS-SHLLINK: relative UTF-16 paths keep the portable directory relocatable.
function shortcut(target, workingDirectory, iconPath) {
  const header = Buffer.alloc(0x4c);
  header.writeUInt32LE(0x4c, 0);
  Buffer.from('0114020000000000c000000000000046', 'hex').copy(header, 4);
  header.writeUInt32LE(0xd8, 20); // RelativePath, WorkingDir, IconLocation, Unicode
  header.writeUInt32LE(0x20, 24); // FILE_ATTRIBUTE_ARCHIVE
  header.writeUInt32LE(1, 60); // SW_SHOWNORMAL
  const stringData = value => {
    const count = Buffer.alloc(2);
    count.writeUInt16LE(value.length);
    return Buffer.concat([count, Buffer.from(value, 'utf16le')]);
  };
  return Buffer.concat([header, stringData(target), stringData(workingDirectory), stringData(iconPath), Buffer.alloc(4)]);
}

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }

async function main() {
  await fs.access(icon);
  await fs.mkdir(releaseRoot, { recursive: true });
  const staging = await fs.mkdtemp(path.join(releaseRoot, '.windows-build-'));
  try {
  const source = path.join(staging, 'source');
  const result = path.join(staging, 'result');
  const hidden = path.join(result, '.executables');
  await fs.mkdir(source);
  await fs.mkdir(hidden, { recursive: true });

  const original = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(source, 'package.json'), JSON.stringify({
    name: original.name, version: original.version, description: original.description,
    main: original.main, author: 'Virgil', private: true,
  }, null, 2));
  for (const item of await fs.readdir(root, { withFileTypes: true })) {
    if (item.isFile() && /\.(?:html|css|js)$/.test(item.name)) await fs.copyFile(path.join(root, item.name), path.join(source, item.name));
  }
  for (const directory of ['assets', 'desktop', 'pages', 'src']) {
    if (await exists(path.join(root, directory))) await fs.cp(path.join(root, directory), path.join(source, directory), { recursive: true });
  }

  // Leave Electron's executable icon unchanged; branding belongs to .lnk and
  // desktop.ini. Packager edits version metadata without replacing the EXE icon.
  const [appDir] = await packager({
    dir: source, out: path.join(staging, 'packaged'), name: 'Plasmatio',
    platform: 'win32', arch: 'x64', electronVersion: original.devDependencies.electron,
    overwrite: true, prune: false,
    win32metadata: { CompanyName: 'Virgil', ProductName: 'PLASMATIO', FileDescription: 'PLASMATIO App' },
    windowsSign: undefined, download: { cacheRoot: process.env.ELECTRON_CACHE },
  });
  await fs.rename(appDir, path.join(hidden, 'app'));

  const compiler = process.env.MAKENSIS || (os.platform() === 'linux' && await exists('/workspace/.tools/nsis/usr/bin/makensis')
    ? '/workspace/.tools/nsis/usr/bin/makensis' : 'makensis');
  const compilerEnvironment = { ...process.env };
  if (compiler.startsWith('/workspace/.tools/nsis/')) compilerEnvironment.NSISDIR = '/workspace/.tools/nsis/usr/share/nsis';
  run(compiler, ['-V2', `-DVERSION=${original.version}`, `-DOUTPUT=${path.join(hidden, 'Folder.exe')}`, path.join(root, 'build/launchers/folder.nsi')], { env: compilerEnvironment });
  await fs.copyFile(icon, path.join(hidden, 'plasmatio.ico'));
  run(compiler, ['-V2', `-DVERSION=${original.version}`, `-DOUTPUT=${path.join(hidden, 'Setup.exe')}`, `-DAPP_DIR=${path.join(hidden, 'app')}`,
    `-DFOLDER_EXE=${path.join(hidden, 'Folder.exe')}`, `-DBRAND_ICON=${icon}`, path.join(root, 'build/installer.nsi')], { env: compilerEnvironment });

  const folder = path.join(result, 'Folder');
  await fs.mkdir(folder);
  await fs.copyFile(icon, path.join(folder, 'plasmatio.ico'));
  await fs.writeFile(path.join(folder, 'desktop.ini'), '\ufeff[.ShellClassInfo]\r\nIconResource=plasmatio.ico,0\r\n', 'utf16le');
  await fs.writeFile(path.join(result, 'App.lnk'), shortcut('.executables\\app\\Plasmatio.exe', '.executables\\app', '.executables\\plasmatio.ico'));
  await fs.writeFile(path.join(result, 'Installer.lnk'), shortcut('.executables\\Setup.exe', '.executables', '.executables\\plasmatio.ico'));

  const expected = ['Folder.exe', 'Setup.exe', 'app/Plasmatio.exe'];
  const actual = [];
  async function findExecutables(directory, prefix = '') {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix + item.name;
      if (item.isDirectory()) await findExecutables(path.join(directory, item.name), relative + '/');
      else if (/\.exe$/i.test(item.name)) actual.push(relative);
    }
  }
  await findExecutables(hidden);
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected].sort())) throw new Error(`Unexpected executable list: ${actual.join(', ')}`);
  const hashes = {};
  for (const name of expected) {
    const bytes = await fs.readFile(path.join(hidden, name));
    if (bytes.toString('ascii', 0, 2) !== 'MZ' || bytes.toString('ascii', bytes.readUInt32LE(0x3c), bytes.readUInt32LE(0x3c) + 4) !== 'PE\0\0') throw new Error(`Invalid Windows executable: ${name}`);
    hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  await fs.writeFile(path.join(hidden, 'release.json'), JSON.stringify({ version: original.version, publisher: 'Virgil', platform: 'win32-x64', builtAt: new Date().toISOString(), executables: hashes }, null, 2));

  // Roll back the directory swap if publishing the new directory fails.
  const previous = path.join(releaseRoot, '.windows-previous');
  await fs.rm(previous, { recursive: true, force: true });
  if (await exists(output)) await fs.rename(output, previous);
  try { await fs.rename(result, output); }
  catch (error) { if (await exists(previous)) await fs.rename(previous, output); throw error; }
  await fs.rm(previous, { recursive: true, force: true });
  console.log(`Windows release replaced: ${output}`);
  console.log('Visible items: Folder, App.lnk, Installer.lnk');
  console.log('Executable counterparts: .executables/Folder.exe, .executables/app/Plasmatio.exe, .executables/Setup.exe');
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
