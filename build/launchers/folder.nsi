Unicode true
Name "PLASMATIO Folder"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "CompanyName" "Virgil"
VIAddVersionKey "ProductName" "PLASMATIO"
VIAddVersionKey "FileDescription" "PLASMATIO Folder"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Virgil"
OutFile "${OUTPUT}"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true

Section
  ExecShell "open" "$EXEDIR\..\Folder"
SectionEnd
