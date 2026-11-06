Unicode true
Name "PLASMATIO"
Caption "PLASMATIO — Virgil"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "CompanyName" "Virgil"
VIAddVersionKey "ProductName" "PLASMATIO"
VIAddVersionKey "FileDescription" "PLASMATIO Installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Virgil"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\PLASMATIO"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
Page directory
Page instfiles

Section "PLASMATIO"
  SetShellVarContext current

  ; A running Windows image cannot be opened for writing. Stop before changing
  ; anything if the installed app is still running.
  IfFileExists "$INSTDIR\.executables\app\Plasmatio.exe" 0 app_closed
  ClearErrors
  FileOpen $0 "$INSTDIR\.executables\app\Plasmatio.exe" a
  IfErrors app_running
  FileClose $0
  Goto app_closed
app_running:
  MessageBox MB_OK|MB_ICONEXCLAMATION "Close PLASMATIO before installing this update. Your current version has not been changed."
  Abort
app_closed:
  ; Preserve the previous runtime until all new runtime files have extracted.
  RMDir /r "$INSTDIR\.executables\app.next"
  SetOutPath "$INSTDIR\.executables\app.next"
  ClearErrors
  File /r "${APP_DIR}\*"
  IfErrors extraction_failed
  RMDir /r "$INSTDIR\.executables\app.previous"
  IfFileExists "$INSTDIR\.executables\app\Plasmatio.exe" 0 promote
  ClearErrors
  Rename "$INSTDIR\.executables\app" "$INSTDIR\.executables\app.previous"
  IfErrors extraction_failed
promote:
  ClearErrors
  Rename "$INSTDIR\.executables\app.next" "$INSTDIR\.executables\app"
  IfErrors rollback
  RMDir /r "$INSTDIR\.executables\app.previous"

  SetOutPath "$INSTDIR\.executables"
  ClearErrors
  File /oname=Folder.exe "${FOLDER_EXE}"
  File /oname=plasmatio.ico "${BRAND_ICON}"
  IfErrors maintenance_failed
  StrCmp "$EXEPATH" "$INSTDIR\.executables\Setup.exe" setup_already_here
  ClearErrors
  CopyFiles /SILENT "$EXEPATH" "$INSTDIR\.executables\Setup.exe"
  IfErrors maintenance_failed
setup_already_here:
  SetFileAttributes "$INSTDIR\.executables" HIDDEN

  ; Folder data survives updates. Only its branding files are refreshed.
  SetOutPath "$INSTDIR\Folder"
  File /oname=plasmatio.ico "${BRAND_ICON}"
  WriteINIStr "$INSTDIR\Folder\desktop.ini" ".ShellClassInfo" "IconResource" "plasmatio.ico,0"
  SetFileAttributes "$INSTDIR\Folder\desktop.ini" HIDDEN|SYSTEM
  SetFileAttributes "$INSTDIR\Folder\plasmatio.ico" HIDDEN
  SetFileAttributes "$INSTDIR\Folder" READONLY

  ; Remove only shortcuts created by earlier PLASMATIO releases.
  Delete "$INSTDIR\Desktop App.lnk"
  Delete "$INSTDIR\Desktop Installer.lnk"
  Delete "$DESKTOP\PLASMATIO Desktop App.lnk"
  Delete "$DESKTOP\PLASMATIO Desktop Installer.lnk"
  SetOutPath "$INSTDIR\.executables\app"
  CreateShortCut "$INSTDIR\App.lnk" "$INSTDIR\.executables\app\Plasmatio.exe" "" "$INSTDIR\.executables\plasmatio.ico" 0
  CreateShortCut "$DESKTOP\PLASMATIO App.lnk" "$INSTDIR\.executables\app\Plasmatio.exe" "" "$INSTDIR\.executables\plasmatio.ico" 0
  SetOutPath "$INSTDIR\.executables"
  CreateShortCut "$INSTDIR\Installer.lnk" "$INSTDIR\.executables\Setup.exe" "" "$INSTDIR\.executables\plasmatio.ico" 0
  CreateShortCut "$DESKTOP\PLASMATIO Folder.lnk" "$INSTDIR\.executables\Folder.exe" "" "$INSTDIR\.executables\plasmatio.ico" 0
  CreateShortCut "$DESKTOP\PLASMATIO Installer.lnk" "$INSTDIR\.executables\Setup.exe" "" "$INSTDIR\.executables\plasmatio.ico" 0
  WriteRegStr HKCU "Software\Virgil\PLASMATIO" "Publisher" "Virgil"
  WriteRegStr HKCU "Software\Virgil\PLASMATIO" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\Virgil\PLASMATIO" "InstallLocation" "$INSTDIR"
  ; Tell Explorer that the folder icon and shortcut associations changed.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  Goto complete

rollback:
  Rename "$INSTDIR\.executables\app.previous" "$INSTDIR\.executables\app"
extraction_failed:
  RMDir /r "$INSTDIR\.executables\app.next"
  MessageBox MB_OK|MB_ICONSTOP "PLASMATIO could not be installed. The previous runtime has been kept. Check available disk space and folder permissions, then try again."
  Abort
maintenance_failed:
  MessageBox MB_OK|MB_ICONSTOP "The app runtime was installed, but its folder launcher or installer could not be refreshed. Close other PLASMATIO installers, check folder permissions, and run this installer again."
  Abort
complete:
  ; Open the installed three-item directory and the app after successful setup.
  IfSilent done
  ExecShell "open" "$INSTDIR"
  SetOutPath "$INSTDIR\.executables\app"
  ExecShell "open" "$INSTDIR\.executables\app\Plasmatio.exe"
done:
SectionEnd
