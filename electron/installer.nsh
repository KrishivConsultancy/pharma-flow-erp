; Radha Drugs ERP - Custom NSIS Installation Script
; Guarantees that any running previous versions are terminated,
; stray files and corrupted binaries from previous versions are cleaned,
; and a 100% fresh copy is installed without file locking conflicts.

!macro customInit
  ; Terminate any running instances of the app before file lock checks
  nsExec::Exec 'cmd.exe /c taskkill /F /IM "Radha Drugs ERP.exe" /T'
  nsExec::Exec 'cmd.exe /c taskkill /F /IM "pharma-flow-erp.exe" /T'
  nsExec::Exec 'cmd.exe /c taskkill /F /IM "electron.exe" /T'
  Sleep 1000
!macroend

!macro preInstall
  DetailPrint "Radha Drugs ERP: Cleaning up previous installation files and stray binaries..."
  ; Secondary process kill to release any residual locks
  nsExec::Exec 'cmd.exe /c taskkill /F /IM "Radha Drugs ERP.exe" /T'
  nsExec::Exec 'cmd.exe /c taskkill /F /IM "pharma-flow-erp.exe" /T'
  Sleep 500

  ; Clean out previous executable and application binaries to ensure 100% clean installation
  Delete "$INSTDIR\Radha Drugs ERP.exe"
  Delete "$INSTDIR\pharma-flow-erp.exe"
  RMDir /r "$INSTDIR\resources\app"
  RMDir /r "$INSTDIR\resources\app.asar.unpacked"
  Delete "$INSTDIR\resources\app.asar"
  Delete "$INSTDIR\resources\*.asar"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.dat"
!macroend
