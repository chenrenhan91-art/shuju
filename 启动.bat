@echo off
cd /d "%~dp0"
python -c "import http.server,socketserver,webbrowser,threading,os; os.chdir(r'%~dp0'); PORT=8765
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,f,*a): pass
try:
    httpd=socketserver.TCPServer(('127.0.0.1',PORT),H)
except OSError:
    PORT=8766; httpd=socketserver.TCPServer(('127.0.0.1',PORT),H)
url=f'http://127.0.0.1:{PORT}/'; print('TX DESK',url); threading.Timer(0.4,lambda: webbrowser.open(url)).start(); httpd.serve_forever()"
pause
