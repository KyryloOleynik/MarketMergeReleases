!macro customInstall
SetOutPath "$INSTDIR\resources\AI"
ExecWait "attrib +h $INSTDIR\resources\AI /s /d"
WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Nls\CodePage" "ACP" "65001"
WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Nls\CodePage" "OEMCP" "65001"
WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Nls\CodePage" "MACCP" "65001"
WriteRegDWORD HKLM "SYSTEM\CurrentControlSet\Control\Nls" "UseUtf8" 1
ExecWait 'shutdown.exe /r /t 1'
!macroend