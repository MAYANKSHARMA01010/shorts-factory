"""Tests for b-roll image SOURCING reliability: Openverse parser + the source
preference order (Pexels key → Openverse → Bing last-resort)."""
from __future__ import annotations

import os
import unittest

from clippilot.generate import broll


class TestOpenverseParser(unittest.TestCase):
    def test_parse_results(self):
        data = {"results": [{"url": "http://a/1.jpg"}, {"url": "http://a/2.jpg"}, {"url": None}]}
        self.assertEqual(broll._parse_openverse(data, 4), ["http://a/1.jpg", "http://a/2.jpg"])

    def test_parse_empty(self):
        self.assertEqual(broll._parse_openverse({}, 4), [])

    def test_parse_respects_limit(self):
        data = {"results": [{"url": f"http://a/{i}.jpg"} for i in range(10)]}
        self.assertEqual(len(broll._parse_openverse(data, 3)), 3)


class TestSourceOrder(unittest.TestCase):
    def setUp(self):
        self._key = os.environ.pop("PEXELS_API_KEY", None)
        self._ov, self._bing = broll.openverse_image_urls, broll.bing_image_urls

    def tearDown(self):
        broll.openverse_image_urls, broll.bing_image_urls = self._ov, self._bing
        if self._key is not None:
            os.environ["PEXELS_API_KEY"] = self._key

    def test_prefers_openverse_over_bing(self):
        broll.openverse_image_urls = lambda q, limit=4: ["http://ov/img.jpg"]
        broll.bing_image_urls = lambda q, limit=4: ["http://bing/img.jpg"]
        self.assertEqual(broll.image_urls("octopus", 1), ["http://ov/img.jpg"])

    def test_falls_back_to_bing_when_openverse_empty(self):
        broll.openverse_image_urls = lambda q, limit=4: []
        broll.bing_image_urls = lambda q, limit=4: ["http://bing/img.jpg"]
        self.assertEqual(broll.image_urls("octopus", 1), ["http://bing/img.jpg"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
