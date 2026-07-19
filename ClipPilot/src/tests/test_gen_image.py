"""Tests for the hosted-API image-generation hook (backlog #7). No real network —
the no-key path is the default; the happy path is exercised with a mocked httpx."""
from __future__ import annotations

import base64
import os
import tempfile
import unittest

from clippilot.generate import broll, gen_image


class TestGenImageGuards(unittest.TestCase):
    def setUp(self):
        self._saved = os.environ.pop("GEN_IMAGE_API_KEY", None)

    def tearDown(self):
        if self._saved is not None:
            os.environ["GEN_IMAGE_API_KEY"] = self._saved

    def test_unavailable_without_key(self):
        self.assertFalse(gen_image.gen_available())
        self.assertIsNone(gen_image.generate_image("x", tempfile.mktemp()))
        self.assertEqual(gen_image.generate_images(["a", "b"], tempfile.mkdtemp()), [])

    def test_fetch_gen_broll_none_without_key(self):
        self.assertEqual(broll.fetch_gen_broll(["ocean"], tempfile.mkdtemp())["kind"], "none")


class TestResponseParser(unittest.TestCase):
    def test_b64(self):
        self.assertEqual(gen_image._parse_image_response({"data": [{"b64_json": "AAA"}]}), {"b64": "AAA"})

    def test_url(self):
        self.assertEqual(gen_image._parse_image_response({"data": [{"url": "http://x/i.png"}]}),
                         {"url": "http://x/i.png"})

    def test_empty(self):
        self.assertIsNone(gen_image._parse_image_response({"data": []}))
        self.assertIsNone(gen_image._parse_image_response({}))


class TestMockedGeneration(unittest.TestCase):
    def test_b64_image_is_saved(self):
        import httpx
        os.environ["GEN_IMAGE_API_KEY"] = "test-key"
        b64 = base64.b64encode(bytes.fromhex("89504e470d0a1a0a")).decode()  # PNG magic

        class _Resp:
            status_code = 200

            def json(self):
                return {"data": [{"b64_json": b64}]}

        orig = httpx.post
        httpx.post = lambda *a, **k: _Resp()
        try:
            d = tempfile.mkdtemp()
            out = os.path.join(d, "g.png")
            self.assertEqual(gen_image.generate_image("a cinematic forest", out), out)
            self.assertTrue(os.path.exists(out))
        finally:
            httpx.post = orig
            os.environ.pop("GEN_IMAGE_API_KEY", None)

    def test_non_200_returns_none(self):
        import httpx
        os.environ["GEN_IMAGE_API_KEY"] = "test-key"

        class _Err:
            status_code = 429

            def json(self):
                raise AssertionError("must not parse the body on a non-200 response")

        orig = httpx.post
        httpx.post = lambda *a, **k: _Err()
        try:
            self.assertIsNone(gen_image.generate_image("x", tempfile.mktemp(suffix=".png")))
        finally:
            httpx.post = orig
            os.environ.pop("GEN_IMAGE_API_KEY", None)


if __name__ == "__main__":
    unittest.main(verbosity=2)
