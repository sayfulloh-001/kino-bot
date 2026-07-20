Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d ""C:\Users\user\Desktop\kino bot"" && python main.py", 0, False
