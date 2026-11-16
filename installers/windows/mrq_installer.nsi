; NSIS Custom Installer Script for MRQ Estudo Musical (Windows x64)
; Generates standalone setup EXE with Desktop Shortcut, Start Menu Shortcut,
; Visual C++ Runtime verification, and Clean Uninstaller.

!include "MUI2.nsh"
!include "x64.nsh"

Name "MRQ Estudo Musical 1.0.0"
OutFile "..\..\release\MRQ-Estudo-Musical-NSIS-1.0.0-x64.exe"
InstallDir "$PROGRAMFILES64\MRQ Estudo Musical"
InstallDirRegKey HKLM "Software\MRQEstudoMusical" "InstallDir"
RequestExecutionLevel admin
Unicode True

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "Instalar MRQ Estudo Musical" SecMain
  SetOutPath "$INSTDIR"

  ; Check 64-bit Windows requirement
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "O MRQ Estudo Musical requer Windows 64-bit (x64)."
    Abort
  ${EndIf}

  ; Check VC++ 2015-2022 Runtime presence (non-blocking warning)
  ReadRegDword $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != 1
    DetailPrint "Aviso: Visual C++ Redistributable x64 não detectado no registro. Continuando com DLLs empacotadas."
  ${EndIf}

  ; Copy packaged application files
  File /r "..\..\apps\desktop\release\win-unpacked\*.*"

  ; Create Start Menu & Desktop Shortcuts
  CreateDirectory "$SMPROGRAMS\MRQ Estudo Musical"
  CreateShortcut "$SMPROGRAMS\MRQ Estudo Musical\MRQ Estudo Musical.lnk" "$INSTDIR\MRQ Estudo Musical.exe"
  CreateShortcut "$SMPROGRAMS\MRQ Estudo Musical\Desinstalar MRQ Estudo Musical.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\MRQ Estudo Musical.lnk" "$INSTDIR\MRQ Estudo Musical.exe"

  ; Write Uninstaller & Add/Remove Programs metadata
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\MRQEstudoMusical" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MRQEstudoMusical" "DisplayName" "MRQ Estudo Musical"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MRQEstudoMusical" "DisplayVersion" "1.0.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MRQEstudoMusical" "Publisher" "MRQ Audio Engineering"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MRQEstudoMusical" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MRQEstudoMusical" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MRQEstudoMusical" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\MRQ Estudo Musical.lnk"
  Delete "$SMPROGRAMS\MRQ Estudo Musical\MRQ Estudo Musical.lnk"
  Delete "$SMPROGRAMS\MRQ Estudo Musical\Desinstalar MRQ Estudo Musical.lnk"
  RMDir "$SMPROGRAMS\MRQ Estudo Musical"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MRQEstudoMusical"
  DeleteRegKey HKLM "Software\MRQEstudoMusical"
SectionEnd
