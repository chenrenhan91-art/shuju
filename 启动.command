#!/bin/bash
cd "$(dirname "$0")"
python3 - <<'PY'
import http.server, socketserver, webbrowser, os, threading
os.chdir(os.getcwd())
socketserver.TCPServer.allow_reuse_address = True
PORT = 8765
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass
try:
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
except OSError:
    PORT = 8766
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), H)
url = f"http://127.0.0.1:{PORT}/"
print(f"TX DESK  {url}")
print("关掉本窗口即停止。数据不会离开这台电脑。")
threading.Timer(0.4, lambda: webbrowser.open(url)).start()
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
PY
