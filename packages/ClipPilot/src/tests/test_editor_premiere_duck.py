"""Tests for Adobe Premiere parity — Essential-Sound auto-duck (music ducks under VO).

Timeline-level `auto_duck` config; in render the music track is sidechain-compressed
by the voice track. Built in `render._audio_mix_nodes`, set via set_auto_duck / the
editor_set_auto_duck MCP tool."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestAutoDuckModel(unittest.TestCase):
    def test_set_and_clear(self):
        tl = T.Timeline()
        cfg = T.set_auto_duck(tl, music_track=1, voice_track=0)
        self.assertEqual(cfg["music_track"], 1)
        self.assertEqual(cfg["voice_track"], 0)
        self.assertEqual(tl.auto_duck, cfg)
        self.assertIsNone(T.set_auto_duck(tl, None, 0))           # missing track clears
        self.assertIsNone(tl.auto_duck)

    def test_same_track_rejected(self):
        tl = T.Timeline()
        self.assertIsNone(T.set_auto_duck(tl, music_track=2, voice_track=2))
        self.assertIsNone(tl.auto_duck)

    def test_params_clamped(self):
        tl = T.Timeline()
        cfg = T.set_auto_duck(tl, 1, 0, threshold=5.0, ratio=999, release_ms=99999)
        self.assertLessEqual(cfg["threshold"], 0.9)
        self.assertLessEqual(cfg["ratio"], 20.0)
        self.assertLessEqual(cfg["release_ms"], 3000)

    def test_json_round_trip(self):
        tl = T.Timeline()
        T.set_auto_duck(tl, 1, 0, ratio=6)
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.auto_duck["music_track"], 1)
        self.assertEqual(tl2.auto_duck["ratio"], 6.0)
        # malformed auto_duck sanitized on load
        bad = tl.to_dict()
        bad["auto_duck"] = "oops"
        self.assertIsNone(T.Timeline.from_dict(bad).auto_duck)


class TestAudioMixNodes(unittest.TestCase):
    def test_plain_mix_no_duck(self):
        tl = T.Timeline()
        nodes, out = R._audio_mix_nodes([(0, "a1"), (1, "a2")], tl)
        self.assertEqual(out, "aout")
        self.assertIn("amix=inputs=2", ";".join(nodes))
        self.assertNotIn("sidechaincompress", ";".join(nodes))

    def test_single_label_wrapped(self):
        tl = T.Timeline()
        nodes, out = R._audio_mix_nodes([(0, "a1")], tl)
        self.assertEqual(out, "aout")
        self.assertIn("[a1]anull[aout]", ";".join(nodes))

    def test_empty(self):
        self.assertEqual(R._audio_mix_nodes([], T.Timeline()), ([], None))

    def test_duck_builds_sidechain(self):
        tl = T.Timeline()
        T.set_auto_duck(tl, music_track=1, voice_track=0, threshold=0.05, ratio=6)
        # voice on track 0, music on track 1
        nodes, out = R._audio_mix_nodes([(0, "a1"), (1, "a2")], tl)
        graph = ";".join(nodes)
        self.assertEqual(out, "aout")
        self.assertIn("asplit[vkey][avoice]", graph)               # voice split for key + final
        self.assertIn("[a2][vkey]sidechaincompress=threshold=0.0500:ratio=6.00", graph)
        self.assertIn("[avoice][ducked]", graph)                   # both in the final mix
        self.assertIn("amix=inputs=2", graph)

    def test_duck_with_multiple_clips_per_track_and_other(self):
        tl = T.Timeline()
        T.set_auto_duck(tl, music_track=1, voice_track=0)
        # two voice clips (track 0), one music (track 1), one sfx (track 2)
        nodes, out = R._audio_mix_nodes([(0, "a1"), (0, "a2"), (1, "a3"), (2, "a4")], tl)
        graph = ";".join(nodes)
        self.assertIn("[a1][a2]amix=inputs=2:normalize=0[vmix]", graph)   # voice premixed
        self.assertIn("sidechaincompress", graph)
        self.assertIn("[avoice][ducked][a4]amix=inputs=3", graph)         # sfx passes through

    def test_duck_falls_back_when_track_missing(self):
        tl = T.Timeline()
        T.set_auto_duck(tl, music_track=5, voice_track=0)   # no music clips on track 5
        nodes, out = R._audio_mix_nodes([(0, "a1"), (1, "a2")], tl)
        self.assertNotIn("sidechaincompress", ";".join(nodes))   # plain mix fallback
        self.assertIn("amix=inputs=2", ";".join(nodes))


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestAutoDuckRender(unittest.TestCase):
    def _audio(self, d, name, freq):
        from clippilot.media.ffmpeg import run_ffmpeg
        p = os.path.join(d, name)
        run_ffmpeg(["-f", "lavfi", "-i", f"sine=frequency={freq}:duration=1",
                    "-c:a", "aac", "-y", p])
        return p

    def test_duck_renders_with_audio(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.signals import probe
        d = tempfile.mkdtemp(prefix="ducktest_")
        voice = self._audio(d, "voice.m4a", 300)
        music = self._audio(d, "music.m4a", 800)
        tl = T.Timeline(fps=30, width=320, height=568)
        T.add_clip(tl, 0, T.Clip(media_ref=voice, media_type="audio", start_frame=0,
                                 duration_frames=30))
        T.add_clip(tl, 1, T.Clip(media_ref=music, media_type="audio", start_frame=0,
                                  duration_frames=30, volume=0.6))
        T.set_auto_duck(tl, music_track=1, voice_track=0)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))
        self.assertTrue(probe(out).has_audio)


if __name__ == "__main__":
    unittest.main(verbosity=2)
