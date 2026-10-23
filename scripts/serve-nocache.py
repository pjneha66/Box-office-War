#!/usr/bin/env python3
"""Static server for local QA with caching disabled.

Service workers in this project are aggressive: a cached index.html can keep
serving an older build long after a version bump. This server sends
Cache-Control: no-store for every response so a hard refresh always shows the
current files.

    python3 scripts/serve-nocache.py [port] [--bind 0.0.0.0]
"""
import argparse
import functools
import http.server
import os
import socketserver


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console readable
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("port", nargs="?", type=int, default=3000)
    ap.add_argument("--bind", default="0.0.0.0", help="interface to bind (default 0.0.0.0)")
    args = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer((args.bind, args.port), handler) as httpd:
        print(f"Box Office War — no-store server on http://{args.bind}:{args.port} (root: {root})", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
