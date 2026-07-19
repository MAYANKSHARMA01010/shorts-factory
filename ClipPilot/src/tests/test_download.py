"""Tests for yt-dlp source download (OpenMontage technique). The real-network
download is opt-in (CLIPPILOT_RUN_NET=1) so the default suite stays offline."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import download


class TestDownloadGuards(unittest.TestCase):
    def test_valid_url(self):
        self.assertTrue(download._valid_url("https://x/y.mp4"))
        self.assertTrue(download._valid_url("http://x/y"))
        self.assertFalse(download._valid_url("ftp://x/y"))
        self.assertFalse(download._valid_url(""))
        self.assertFalse(download._valid_url(None))

    def test_bad_url_returns_clean_reason(self):
        res = download.download_source("not a url", tempfile.mkdtemp())
        self.assertFalse(res["available"])
        self.assertIn("http", res["reason"])

    def test_ytdlp_available_is_bool(self):
        self.assertIsInstance(download.ytdlp_available(), bool)

    def test_format_caps_height(self):
        self.assertIn("height<=720", download._fmt(720))


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_NET") == "1",
                     "network download test — set CLIPPILOT_RUN_NET=1")
class TestRealDownload(unittest.TestCase):
    def test_downloads_small_clip(self):
        d = tempfile.mkdtemp(prefix="dltest_")
        res = download.download_source("https://www.w3schools.com/html/mov_bbb.mp4", d, max_height=720)
        self.assertTrue(res["available"], res.get("reason"))
        self.assertTrue(os.path.exists(res["path"]))
        self.assertGreater(os.path.getsize(res["path"]), 10000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
