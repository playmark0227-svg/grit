#!/usr/bin/env python3
# ============================================================
# ローカル確認用の簡易サーバー(キャッシュ無効版)
#   python3 serve.py  →  http://localhost:5178
# CSS/JSを編集したときに、リロードだけで必ず最新が反映されます。
# (本番のFirebase Hostingはキャッシュ制御を自動で行うため不要)
# ============================================================
import http.server
import functools

PORT = 5178
DIR = "public"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=DIR)
    with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
        print(f"GRIT local preview: http://localhost:{PORT} (Ctrl+C で停止)")
        httpd.serve_forever()
