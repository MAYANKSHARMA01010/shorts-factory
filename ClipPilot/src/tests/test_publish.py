"""Tests for the publish stage ported from MoneyPrinterTurbo (MIT):
metadata generation + the Upload-Post request shape. No network."""
from __future__ import annotations

import os
import unittest

from clippilot.publish import metadata as md
from clippilot.publish.upload_post import UploadPostPublisher, publisher_from_env
from clippilot.publish.youtube import YouTubePublisher
from clippilot.publish.youtube import publisher_from_env as youtube_from_env


class TestMetadata(unittest.TestCase):
    def test_parse_handles_code_fence_and_chatter(self):
        self.assertEqual(md.parse_metadata('```json\n{"title":"x"}\n```')["title"], "x")
        self.assertEqual(md.parse_metadata('sure! {"title":"y"} done')["title"], "y")
        self.assertIsNone(md.parse_metadata("not json at all"))
        self.assertIsNone(md.parse_metadata(""))

    def test_parse_recovers_object_with_trailing_prose(self):
        # a trailing brace/emoticon must not break recovery (greedy {.*} did)
        self.assertEqual(md.parse_metadata('Sure! {"title":"x"} hope that helps :}')["title"], "x")

    def test_generate_with_list_response_falls_back(self):
        m = md.generate_social_metadata("subj", "script", "tiktok",
                                        generate_fn=lambda p: '["title","caption"]')
        self.assertTrue(m["_fallback"])   # a JSON list must not crash with AttributeError

    def test_normalize_hashtags_count_zero(self):
        self.assertEqual(md.normalize_hashtags(["a", "b"], 0), [])

    def test_normalize_hashtags(self):
        tags = md.normalize_hashtags(["#fun!!", "Fun", "viral video", "viral", "a", "b"], 3)
        self.assertEqual(tags, ["#fun", "#viralvideo", "#viral"])  # dedupe Fun~fun, strip, cap 3

    def test_fallback_shape(self):
        m = md.fallback_metadata("A really cool clip", "youtube_shorts")
        self.assertLessEqual(len(m["title"]), 100)
        self.assertEqual(len(m["hashtags"]), 3)  # youtube_shorts hashtag_count
        self.assertTrue(m["_fallback"])

    def test_generate_with_mock_llm(self):
        long_title = "T" * 200
        gen = lambda p: ('{"title":"' + long_title + '","caption":"watch this",'
                         '"hashtags":["#a","#b","#c","#d","#e"]}')
        m = md.generate_social_metadata("subj", "script", "youtube_shorts", generate_fn=gen)
        self.assertLessEqual(len(m["title"]), 100)        # title cap enforced
        self.assertEqual(len(m["hashtags"]), 3)            # youtube_shorts cap
        self.assertEqual(m["caption"], "watch this")

    def test_generate_llm_failure_falls_back(self):
        def boom(_):
            raise RuntimeError("llm down")
        m = md.generate_social_metadata("subj", "script", "tiktok", generate_fn=boom)
        self.assertTrue(m["_fallback"])
        self.assertEqual(len(m["hashtags"]), 5)            # tiktok cap

    def test_generate_none_generator_falls_back(self):
        m = md.generate_social_metadata("subj", "script", generate_fn=None)
        self.assertTrue(m["_fallback"])

    def test_from_understanding(self):
        u = {"summary": "A funny moment", "topics": ["comedy"],
             "scenes": [{"transcript_excerpt": "the punchline lands"}]}
        m = md.from_understanding(u, generate_fn=None)
        self.assertIn("title", m)


class TestUploadPost(unittest.TestCase):
    def test_request_shape_dry_run(self):
        pub = UploadPostPublisher(api_key="KEY123", username="me")
        req = pub.upload_video("video.mp4", title="My Clip",
                               platforms=["youtube", "instagram_reels"],
                               description="desc", tags=["#a", "#b"], dry_run=True)
        self.assertTrue(req["dry_run"])
        self.assertEqual(req["url"], "https://api.upload-post.com/api/upload")
        self.assertEqual(req["headers"]["Authorization"], "Apikey KEY123")
        data = dict(req["data"])  # last-wins, but checks presence
        self.assertEqual(data["user"], "me")
        # platform tokens deduped + mapped (instagram_reels → instagram)
        self.assertEqual(set(req["platforms"]), {"youtube", "instagram"})
        # AI-disclosure forced on for youtube
        pairs = req["data"]
        self.assertIn(("containsSyntheticMedia", "true"), pairs)
        self.assertIn(("platform[]", "youtube"), pairs)
        self.assertIn(("platform[]", "instagram"), pairs)
        self.assertIn(("tags[]", "#a"), pairs)

    def test_tiktok_gets_ai_disclosure(self):
        pub = UploadPostPublisher(api_key="K", username="me")
        req = pub.upload_video("v.mp4", title="t", platforms=["tiktok"], dry_run=True)
        self.assertIn(("is_aigc", "true"), req["data"])  # TikTok AIGC disclosure forced

    def test_publisher_from_env_none_without_keys(self):
        from clippilot.brain import env as benv
        saved = {k: os.environ.pop(k, None) for k in ("UPLOAD_POST_API_KEY", "UPLOAD_POST_USERNAME")}
        orig_load = benv.load_dotenv
        try:
            benv.load_dotenv = lambda *a, **k: None  # don't let a real .env inject keys
            self.assertIsNone(publisher_from_env())
        finally:
            benv.load_dotenv = orig_load
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v


class TestYouTube(unittest.TestCase):
    def test_dry_run_body_shape_and_caps(self):
        pub = YouTubePublisher("CID", "SECRET", "REFRESH")
        req = pub.upload_video("video.mp4", title="T" * 200, description="watch this",
                               tags=["#a", "#b"], privacy="public", dry_run=True)
        self.assertTrue(req["dry_run"])
        self.assertEqual(req["url"], "https://www.googleapis.com/upload/youtube/v3/videos")
        snip = req["body"]["snippet"]
        self.assertLessEqual(len(snip["title"]), 100)            # title cap
        self.assertEqual(snip["tags"], ["#a", "#b"])
        self.assertIn("AI-generated", snip["description"])       # disclosure appended
        self.assertEqual(req["body"]["status"]["privacyStatus"], "public")
        self.assertFalse(req["body"]["status"]["selfDeclaredMadeForKids"])

    def test_disclosure_not_duplicated(self):
        from clippilot.publish.youtube import AI_DISCLOSURE
        pub = YouTubePublisher("CID", "SECRET", "REFRESH")
        body = pub._build_body("t", "watch this" + AI_DISCLOSURE, None, "unlisted")
        # dedup keys off the real marker (not the common phrase "AI-generated")
        self.assertEqual(body["snippet"]["description"].count("Disclosure:"), 1)
        self.assertEqual(body["status"]["privacyStatus"], "unlisted")

    def test_disclosure_survives_caption_at_cap(self):
        pub = YouTubePublisher("CID", "SECRET", "REFRESH")
        body = pub._build_body("t", "x" * 5000, None, "public")  # caption at the 5000 cap
        desc = body["snippet"]["description"]
        self.assertLessEqual(len(desc), 5000)
        self.assertIn("AI-generated", desc)   # disclosure reserved room, not truncated off

    def test_disclosure_can_be_disabled(self):
        pub = YouTubePublisher("CID", "SECRET", "REFRESH", ai_disclosure=False)
        body = pub._build_body("t", "plain", None, "private")
        self.assertNotIn("AI-generated", body["snippet"]["description"])
        self.assertEqual(body["status"]["privacyStatus"], "private")

    def test_publisher_from_env_none_without_keys(self):
        from clippilot.brain import env as benv
        keys = ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")
        saved = {k: os.environ.pop(k, None) for k in keys}
        orig_load = benv.load_dotenv
        try:
            benv.load_dotenv = lambda *a, **k: None  # don't let a real .env inject keys
            self.assertIsNone(youtube_from_env())
        finally:
            benv.load_dotenv = orig_load
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v


class TestInstagram(unittest.TestCase):
    def test_dry_run_reel_container_shape(self):
        from clippilot.publish.instagram import InstagramPublisher
        pub = InstagramPublisher("IGUID", "TOKEN")
        req = pub.upload_reel("https://cdn.example.com/clip.mp4", caption="watch this", dry_run=True)
        self.assertTrue(req["dry_run"])
        self.assertTrue(req["url"].endswith("/IGUID/media"))
        self.assertEqual(req["data"]["media_type"], "REELS")
        self.assertEqual(req["data"]["video_url"], "https://cdn.example.com/clip.mp4")
        self.assertEqual(req["data"]["access_token"], "TOKEN")
        self.assertIn("AI-generated", req["data"]["caption"])     # disclosure appended

    def test_disclosure_reserves_room_in_caption(self):
        from clippilot.publish.instagram import InstagramPublisher
        pub = InstagramPublisher("U", "T")
        req = pub.upload_reel("https://x/v.mp4", caption="y" * 2200, dry_run=True)
        cap = req["data"]["caption"]
        self.assertLessEqual(len(cap), 2200)
        self.assertIn("AI-generated", cap)

    def test_missing_url_errors(self):
        from clippilot.publish.instagram import InstagramPublisher
        self.assertFalse(InstagramPublisher("U", "T").upload_reel("")["success"])

    def test_publisher_from_env_none_without_keys(self):
        from clippilot.brain import env as benv
        from clippilot.publish.instagram import publisher_from_env
        saved = {k: os.environ.pop(k, None) for k in ("INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN")}
        orig = benv.load_dotenv
        try:
            benv.load_dotenv = lambda *a, **k: None
            self.assertIsNone(publisher_from_env())
        finally:
            benv.load_dotenv = orig
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v


if __name__ == "__main__":
    unittest.main(verbosity=2)
