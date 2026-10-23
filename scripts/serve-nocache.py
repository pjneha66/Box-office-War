#!/usr/bin/env python3
"""Static server for local QA with caching disabled.

Service workers in this project are aggressive: a cached index.html can keep
serving an older build long after a version bump. This server sends
Cache-Control: no-store for every response so a hard refresh always shows the
current files.

Browsers abort asset requests constantly (image preloads, tab switches, a
reload mid-download). The stock handler dumps a full BrokenPipeError traceback
for every one of those and the preview log becomes unreadable, so connection
resets are handled quietly here while real 4xx/5xx responses are still logged.

    python3 scripts/serve-nocache.py [port] [--bind 0.0.0.0]
"""
import argparse
import functools
import http.server
import os
import socketserver
import sys

# Sockets closing mid-write are normal client behaviour, not server faults.
CLIENT_GONE = (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "BOWNoCache/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console readable
        try:
            code = int(str(args[1])[:1]) if len(args) > 1 else 0
        except (ValueError, IndexError):
            code = 0
        if code >= 4:
            super().log_message(fmt, *args)

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except CLIENT_GONE:
            pass  # the browser hung up; nothing to report

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except CLIENT_GONE:
            self.close_connection = True

    def handle(self):
        try:
            super().handle()
        except CLIENT_GONE:
            pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    block_on_close = False

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, CLIENT_GONE):
            return  # aborted downloads are routine
        super().handle_error(request, client_address)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("port", nargs="?", type=int, default=3000)
    ap.add_argument("--bind", default="0.0.0.0", help="interface to bind (default 0.0.0.0)")
    args = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    with Server((args.bind, args.port), handler) as httpd:
        print(
            f"Box Office War — no-store server on http://{args.bind}:{args.port} "
            f"(root: {root}, pid {os.getpid()})",
            flush=True,
        )
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server.", flush=True)


if __name__ == "__main__":
    main()
