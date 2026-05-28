"""
One-time Swiggy OAuth setup script.

Run from WINDOWS Python (not WSL) so port 80 is accessible without sudo:
    python backend/swiggy_auth_setup.py [--save-to-backend]

Requires SWIGGY_CLIENT_ID and SWIGGY_CLIENT_SECRET in backend/.env

What it does:
1. Opens the Swiggy login page in your browser
2. Catches the OAuth callback on http://localhost/callback  (whitelisted by Swiggy)
3. Exchanges the code for a Bearer token
4. Optionally POSTs the token to your running HomeOS backend

After running, the token is saved in MongoDB and real Swiggy Instamart
orders will work from the HomeOS cart.
"""

import os
import sys
import http.server
import threading
import webbrowser
import urllib.parse
import secrets
import argparse

import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

CLIENT_ID = os.environ.get("SWIGGY_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("SWIGGY_CLIENT_SECRET", "")
REDIRECT_URI = "http://localhost/callback"
AUTH_URL = "https://www.swiggy.com/auth/oauth/authorize"
TOKEN_URL = "https://www.swiggy.com/auth/oauth/token"
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000")

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: Set SWIGGY_CLIENT_ID and SWIGGY_CLIENT_SECRET in backend/.env first.")
    sys.exit(1)

_result: dict = {}
_done = threading.Event()


class _Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/callback":
            params = urllib.parse.parse_qs(parsed.query)
            _result["code"] = (params.get("code") or [None])[0]
            _result["state"] = (params.get("state") or [None])[0]
            _result["error"] = (params.get("error") or [None])[0]
            body = (
                b"<h2 style='font-family:sans-serif'>Swiggy connected! You can close this tab.</h2>"
                if _result.get("code")
                else b"<h2 style='font-family:sans-serif'>Auth failed. Check the terminal.</h2>"
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(body)
            _done.set()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--save-to-backend",
        action="store_true",
        help="POST the token to the running HomeOS backend (requires a valid JWT in HOMEOS_JWT env var)",
    )
    args = parser.parse_args()

    state = secrets.token_urlsafe(16)
    auth_url = AUTH_URL + "?" + urllib.parse.urlencode({
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "instamart:read instamart:write",
        "state": state,
    })

    try:
        server = http.server.HTTPServer(("", 80), _Handler)
    except PermissionError:
        print("ERROR: Cannot bind to port 80.")
        print("Run this script from Windows Python (not WSL), or run as Administrator.")
        sys.exit(1)

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    print("Opening Swiggy login in your browser...")
    webbrowser.open(auth_url)
    print("Waiting for OAuth callback on http://localhost/callback (timeout 3 min)...")

    if not _done.wait(timeout=180):
        print("Timed out. Try again.")
        sys.exit(1)

    server.shutdown()

    if _result.get("error"):
        print(f"Auth error from Swiggy: {_result['error']}")
        sys.exit(1)

    code = _result["code"]
    print("Got auth code, exchanging for token...")

    resp = httpx.post(TOKEN_URL, data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    access_token = data.get("access_token", "")
    refresh_token = data.get("refresh_token", "")
    expires_in = data.get("expires_in", "?")

    print(f"\n=== Swiggy OAuth complete (expires in {expires_in}s) ===")

    if args.save_to_backend:
        jwt = os.environ.get("HOMEOS_JWT", "")
        if not jwt:
            print("\nERROR: Set HOMEOS_JWT env var to your HomeOS login token to auto-save.")
            print("You can get it from the browser: DevTools → Application → Local Storage → homeos_token")
        else:
            r = httpx.post(
                f"{BACKEND_URL}/api/swiggy/set-token",
                json={"token": access_token, "token_type": "oauth"},
                headers={"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
                timeout=10,
            )
            if r.status_code == 200:
                print("Token saved to HomeOS backend. Your household is now connected to Swiggy.")
            else:
                print(f"Failed to save to backend: {r.status_code} {r.text}")
    else:
        print("\nTo save to HomeOS backend, re-run with --save-to-backend and set HOMEOS_JWT env var.")
        print("Or add manually to backend/.env:")
        print(f"SWIGGY_ACCESS_TOKEN={access_token}")

    print(f"\nAccess Token:\n{access_token}")
    if refresh_token:
        print(f"\nRefresh Token:\n{refresh_token}")


if __name__ == "__main__":
    main()
