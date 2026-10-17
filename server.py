#!/usr/bin/env python3
"""Optional local web server for Ludo Royale. Python 3 standard library only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

HOST = "127.0.0.1"
PORT = 8000

if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    print(f"Ludo Royale is ready at http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop the server.")
    ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler).serve_forever()
