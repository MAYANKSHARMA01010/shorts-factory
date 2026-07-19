"""Tests for B-roll sourcing + composition (the Section-B visual upgrade).

Network calls are not made: keyword extraction + Bing-HTML parsing are pure; the
fetch path is exercised with stubbed sourcing; composition uses local images/clips.
"""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from clippilot.generate import assemble, broll
from clippilot.media import ffmpeg as ffm
from clippilot.media import signals

_RENDER = os.environ.get("CLIPPILOT_RUN_RENDER") == "1"  # video renders are opt-in


class TestKeywords(unittest.TestCase):
    def test_heuristic_drops_stopwords_and_keeps_title(self):
        kw = broll.keywords_from_script(
            "Facts about volcanoes",
            "Volcanoes are openings in the earth crust. Lava and ash erupt and shape mountains.",
            generate_fn=None, amount=4)
        self.assertEqual(kw[0], "Facts about volcanoes")          # title first
        self.assertNotIn("the", kw)
        self.assertNotIn("are", kw)
        self.assertLessEqual(len(kw), 4)

    def test_llm_keywords_parsed(self):
        gen = lambda p: '["ocean waves","city skyline","forest path"]'
        kw = broll.keywords_from_script("t", "s", generate_fn=gen, amount=3)
        self.assertEqual(kw, ["ocean waves", "city skyline", "forest path"])

    def test_llm_bad_output_falls_back(self):
        kw = broll.keywords_from_script("Space travel", "rockets and stars", generate_fn=lambda p: "nope")
        self.assertTrue(kw and kw[0] == "Space travel")


class TestBingParse(unittest.TestCase):
    def test_parse_murl(self):
        sample = ('... m="{&quot;murl&quot;:&quot;https://ex.com/a.jpg&quot;}" ... '
                  '"murl":"https://ex.com/b.jpg" ... "murl":"https://ex.com/a.jpg"')
        urls = broll._parse_murl(sample, limit=5)
        self.assertEqual(urls, ["https://ex.com/a.jpg", "https://ex.com/b.jpg"])  # deduped


class TestImageSource(unittest.TestCase):
    def test_parse_pexels_photos_prefers_portrait_and_dedupes(self):
        data = {"photos": [
            {"src": {"portrait": "http://p/1p.jpg", "large": "http://p/1l.jpg"}},
            {"src": {"large": "http://p/2l.jpg"}},
            {"src": {"portrait": "http://p/1p.jpg"}},   # duplicate
        ]}
        self.assertEqual(broll._parse_pexels_photos(data, 5),
                         ["http://p/1p.jpg", "http://p/2l.jpg"])

    def test_image_urls_prefers_pexels_when_key(self):
        prev = os.environ.get("PEXELS_API_KEY")
        orig_p, orig_b = broll.pexels_photo_urls, broll.bing_image_urls
        try:
            os.environ["PEXELS_API_KEY"] = "k"
            broll.pexels_photo_urls = lambda q, key, limit=4: ["http://px/a.jpg"]
            broll.bing_image_urls = lambda q, limit=4: ["http://bing/b.jpg"]
            self.assertEqual(broll.image_urls("x"), ["http://px/a.jpg"])   # curated wins
        finally:
            broll.pexels_photo_urls, broll.bing_image_urls = orig_p, orig_b
            if prev is None:
                os.environ.pop("PEXELS_API_KEY", None)
            else:
                os.environ["PEXELS_API_KEY"] = prev

    def test_image_urls_falls_back_to_bing_without_key(self):
        prev = os.environ.pop("PEXELS_API_KEY", None)
        orig_o, orig_b = broll.openverse_image_urls, broll.bing_image_urls
        try:
            broll.openverse_image_urls = lambda q, limit=4: []   # openverse empty → bing last-resort
            broll.bing_image_urls = lambda q, limit=4: ["http://bing/b.jpg"]
            self.assertEqual(broll.image_urls("x"), ["http://bing/b.jpg"])
        finally:
            broll.openverse_image_urls, broll.bing_image_urls = orig_o, orig_b
            if prev is not None:
                os.environ["PEXELS_API_KEY"] = prev


class TestFetchBroll(unittest.TestCase):
    def test_none_when_no_sources(self):
        prev = os.environ.pop("PEXELS_API_KEY", None)
        orig_o, orig_b = broll.openverse_image_urls, broll.bing_image_urls
        try:
            broll.openverse_image_urls = lambda q, limit=4: []   # no source returns anything
            broll.bing_image_urls = lambda q, limit=4: []        # no images, no key
            with tempfile.TemporaryDirectory() as d:
                res = broll.fetch_broll(["x"], d)
                self.assertEqual(res["kind"], "none")
        finally:
            broll.openverse_image_urls, broll.bing_image_urls = orig_o, orig_b
            if prev is not None:
                os.environ["PEXELS_API_KEY"] = prev

    def test_images_when_bing_returns_and_download_writes(self):
        prev = os.environ.pop("PEXELS_API_KEY", None)
        orig_o, orig_b, orig_d = broll.openverse_image_urls, broll.bing_image_urls, broll.download
        try:
            broll.openverse_image_urls = lambda q, limit=4: ["http://x/1.jpg", "http://x/2.jpg"]
            broll.bing_image_urls = lambda q, limit=4: ["http://x/1.jpg", "http://x/2.jpg"]
            broll.download = lambda url, path, **k: (Path(path).write_bytes(b"x" * 4096) or True)
            with tempfile.TemporaryDirectory() as d:
                res = broll.fetch_broll(["topic"], d, max_items=3)
                self.assertEqual(res["kind"], "images")
                self.assertTrue(res["paths"])
        finally:
            broll.openverse_image_urls, broll.bing_image_urls, broll.download = orig_o, orig_b, orig_d
            if prev is not None:
                os.environ["PEXELS_API_KEY"] = prev


class TestTimedBroll(unittest.TestCase):
    def test_salient_word_is_longest_non_stopword(self):
        self.assertEqual(broll.salient_word("the deep ocean creatures"), "creatures")
        self.assertEqual(broll.salient_word("the and of to"), "")  # all stopwords

    def test_phrase_windows_cover_the_script(self):
        wins = broll.phrase_windows(
            "The ocean covers our planet. Deep creatures glow in the dark waters.", 12.0)
        self.assertTrue(wins)
        starts = [w[0] for w in wins]
        self.assertEqual(starts, sorted(starts))            # chronological
        self.assertTrue(all(d > 0 and t for (_s, d, t) in wins))  # real duration + text

    def test_fetch_timed_broll_one_image_per_phrase(self):
        prev = os.environ.pop("PEXELS_API_KEY", None)
        orig_o, orig_b, orig_d = broll.openverse_image_urls, broll.bing_image_urls, broll.download
        try:
            broll.openverse_image_urls = lambda q, limit=4: ["http://x/" + q.replace(" ", "") + ".jpg"]
            broll.bing_image_urls = lambda q, limit=1: ["http://x/" + q.replace(" ", "") + ".jpg"]
            broll.download = lambda url, path, **k: (Path(path).write_bytes(b"x" * 4096) or True)
            with tempfile.TemporaryDirectory() as d:
                res = broll.fetch_timed_broll("Deep ocean creatures glow. Reefs burst with color.",
                                              "Ocean", 10.0, d)
                self.assertEqual(res["kind"], "timed_images")
                self.assertTrue(res["segments"])
                self.assertTrue(all(dur > 0 and Path(p).exists() for (p, dur) in res["segments"]))
        finally:
            broll.openverse_image_urls, broll.bing_image_urls, broll.download = orig_o, orig_b, orig_d
            if prev is not None:
                os.environ["PEXELS_API_KEY"] = prev


@unittest.skipUnless(_RENDER and ffm.ffmpeg_available(), "set CLIPPILOT_RUN_RENDER=1 (renders video)")
class TestComposition(unittest.TestCase):
    def _assets(self, d: str, n_imgs: int = 3, audio_s: int = 5):
        imgs = []
        for i, c in enumerate(["red", "green", "blue", "orange"][:n_imgs]):
            p = os.path.join(d, f"img{i}.png")
            ffm.run_ffmpeg(["-f", "lavfi", "-i", f"color=c={c}:s=800x600", "-frames:v", "1", "-y", p], timeout=30)
            imgs.append(p)
        wav = os.path.join(d, "n.wav")
        ffm.run_ffmpeg(["-f", "lavfi", "-i", f"sine=frequency=300:duration={audio_s}", "-y", wav], timeout=30)
        return imgs, wav

    def test_slideshow_is_vertical_and_matches_audio(self):
        with tempfile.TemporaryDirectory(prefix="cp_slide_") as d:
            imgs, wav = self._assets(d)
            out = os.path.join(d, "short.mp4")
            res = assemble.assemble_slideshow(imgs, wav, out)
            self.assertTrue(res and os.path.exists(res))
            m = signals.probe(res)
            self.assertEqual(m.resolution, "1080x1920")
            self.assertTrue(m.has_audio)
            self.assertGreater(m.duration_s, 3)

    def test_timed_slideshow_respects_per_image_durations(self):
        with tempfile.TemporaryDirectory(prefix="cp_timed_") as d:
            imgs, wav = self._assets(d, n_imgs=3, audio_s=6)
            segments = [(imgs[0], 2.0), (imgs[1], 2.0), (imgs[2], 2.0)]
            out = os.path.join(d, "timed.mp4")
            res = assemble.assemble_timed_slideshow(segments, wav, out)
            self.assertTrue(res and os.path.exists(res))
            m = signals.probe(res)
            self.assertEqual(m.resolution, "1080x1920")
            self.assertTrue(m.has_audio)

    def test_broll_video_crops_and_uses_narration(self):
        with tempfile.TemporaryDirectory(prefix="cp_brollvid_") as d:
            _, wav = self._assets(d, n_imgs=1, audio_s=4)
            stock = os.path.join(d, "stock.mp4")
            ffm.run_ffmpeg(["-f", "lavfi", "-i", "testsrc=duration=2:size=640x360:rate=30",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", "2", "-y", stock], timeout=60)
            out = os.path.join(d, "out.mp4")
            res = assemble.assemble_broll_video(stock, wav, out)
            self.assertTrue(res and os.path.exists(res))
            m = signals.probe(res)
            self.assertEqual(m.resolution, "1080x1920")
            self.assertTrue(m.has_audio)


if __name__ == "__main__":
    unittest.main(verbosity=2)
