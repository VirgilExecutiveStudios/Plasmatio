"""Archive the current Windows release, preserving DOS Explorer attributes.

Usage: python3 scripts/windows-archive.py /absolute/output/PLASMATIO-Windows.zip
"""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1] / "releases" / "windows"
destination = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / "PLASMATIO-Windows.zip"
if not root.is_dir():
    raise SystemExit("Build the Windows release before archiving it.")
destination.parent.mkdir(parents=True, exist_ok=True)
temporary = destination.with_suffix(".zip.next")

with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(root.rglob("*")):
        relative = file.relative_to(root)
        info = zipfile.ZipInfo.from_file(file, "PLASMATIO/" + relative.as_posix())
        info.create_system = 0  # MS-DOS attributes, including hidden/system.
        attributes = 0x10 if file.is_dir() else 0x20
        if relative.parts[0] == ".executables":
            attributes |= 0x02
        if file.name == "desktop.ini":
            attributes |= 0x02 | 0x04
        if relative.as_posix() == "Folder/plasmatio.ico":
            attributes |= 0x02
        if relative.as_posix() == "Folder":
            attributes |= 0x01
        info.external_attr = attributes
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, b"" if file.is_dir() else file.read_bytes())

temporary.replace(destination)
print(destination)
