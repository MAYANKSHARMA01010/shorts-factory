"""Tests for the one-time YouTube OAuth helper (pure parts: auth URL, redirect
code parsing, .env writer, CLI credential guard). The live loopback flow needs a
browser/network and isn't exercised here."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from clippilot.publish import youtube_auth as ya


class TestAuthUrl(unittest.TestCase):
    def test_build_auth_url_params(self):
        url = ya.build_auth_url("CID.apps", "http://localhost:8765/")
        q = parse_qs(urlparse(url).query)
        self.assertEqual(q["client_id"], ["CID.apps"])
        self.assertEqual(q["redirect_uri"], ["http://localhost:8765/"])
        self.assertEqual(q["response_type"], ["code"])
        self.assertEqual(q["access_type"], ["offline"])   # required for a refresh token
        self.assertEqual(q["prompt"], ["consent"])
        self.assertIn("youtube.upload", q["scope"][0])


class TestParseCode(unittest.TestCase):
    def test_code(self):
        code, err = ya.parse_code("/?code=ABC123&scope=...&state=clippilot")
        self.assertEqual(code, "ABC123")
        self.assertIsNone(err)

    def test_error(self):
        code, err = ya.parse_code("/?error=access_denied")
        self.assertIsNone(code)
        self.assertEqual(err, "access_denied")

    def test_empty(self):
        self.assertEqual(ya.parse_code("/"), (None, None))


class TestAppendEnv(unittest.TestCase):
    def test_creates_and_appends(self):
        with tempfile.TemporaryDirectory() as d:
            env = os.path.join(d, ".env")
            ya.append_env("YOUTUBE_REFRESH_TOKEN", "R1", env)
            self.assertIn("YOUTUBE_REFRESH_TOKEN=R1", Path(env).read_text(encoding="utf-8"))

    def test_replaces_existing_and_commented(self):
        with tempfile.TemporaryDirectory() as d:
            env = os.path.join(d, ".env")
            Path(env).write_text("FOO=1\n# YOUTUBE_REFRESH_TOKEN=...\nBAR=2\n", encoding="utf-8")
            ya.append_env("YOUTUBE_REFRESH_TOKEN", "R2", env)
            text = Path(env).read_text(encoding="utf-8")
            self.assertIn("YOUTUBE_REFRESH_TOKEN=R2", text)
            self.assertNotIn("# YOUTUBE_REFRESH_TOKEN=...", text)  # commented line replaced
            self.assertEqual(text.count("YOUTUBE_REFRESH_TOKEN="), 1)
            self.assertIn("FOO=1", text)
            self.assertIn("BAR=2", text)


class TestCliGuard(unittest.TestCase):
    def test_main_requires_credentials(self):
        from clippilot.brain import env as benv
        keys = ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET")
        saved = {k: os.environ.pop(k, None) for k in keys}
        orig = benv.load_dotenv
        try:
            benv.load_dotenv = lambda *a, **k: None  # don't let a real .env inject creds
            self.assertEqual(ya.main([]), 2)  # no creds → exit 2, never opens a browser
        finally:
            benv.load_dotenv = orig
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v


if __name__ == "__main__":
    unittest.main(verbosity=2)
