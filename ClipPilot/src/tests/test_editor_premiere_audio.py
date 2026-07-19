"""Tests for Adobe Premiere parity — the Essential-Sound per-clip audio FX stack
(Loudness / Repair / Clarity / EQ / Dynamics). Compiled in `render._audio_chain`,
settable via set_clip_properties(audio_fx=[...]) or add_audio_effect / the
editor_add_audio_effect MCP tool."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestAudioEffectBuilders(unittest.TestCase):
    def test_loudness_and_gain(self):
        self.assertEqual(R._one_audio_effect({"type": "gain", "db": -6}), "volume=-6.00dB")
        self.assertEqual(R._one_audio_effect({"type": "normalize", "target_lufs": -14}),
                         "loudnorm=I=-14.0:TP=-1.5:LRA=11")

    def test_repair_and_clarity(self):
        self.assertEqual(R._one_audio_effect({"type": "denoise", "amount": 20}), "afftdn=nr=20.00")
        self.assertEqual(R._one_audio_effect({"type": "highpass", "freq": 100}), "highpass=f=100")
        self.assertEqual(R._one_audio_effect({"type": "lowpass", "freq": 12000}), "lowpass=f=12000")
        self.assertEqual(R._one_audio_effect({"type": "deesser"}), "deesser")

    def test_eq_three_band(self):
        f = R._one_audio_effect({"type": "eq", "low": 3, "mid": -2, "high": 4})
        self.assertIn("bass=g=3.00:f=110", f)
        self.assertIn("equalizer=f=1200:t=q:w=1.0:g=-2.00", f)
        self.assertIn("treble=g=4.00:f=10000", f)

    def test_dynamics(self):
        self.assertEqual(R._one_audio_effect({"type": "compressor", "threshold": -18, "ratio": 4}),
                         "acompressor=threshold=-18.0dB:ratio=4.0")
        self.assertEqual(R._one_audio_effect({"type": "limiter", "limit": 0.9}), "alimiter=limit=0.900")
        self.assertTrue(R._one_audio_effect({"type": "reverb", "amount": 0.5}).startswith("aecho="))

    def test_clamp_default_unknown(self):
        self.assertEqual(R._one_audio_effect({"type": "gain", "db": 999}), "volume=30.00dB")  # clamped
        self.assertEqual(R._one_audio_effect({"type": "gain"}), "volume=0.00dB")               # default
        self.assertEqual(R._one_audio_effect({"type": "gain", "db": "x"}), "volume=0.00dB")    # bad → default
        self.assertIsNone(R._one_audio_effect({"type": "nope"}))
        self.assertIsNone(R._one_audio_effect("not a dict"))

    def test_filters_compile_in_order(self):
        fx = [{"type": "denoise", "amount": 12}, {"type": "junk"}, {"type": "limiter", "limit": 0.95}]
        self.assertEqual(R._audio_effect_filters(fx), ["afftdn=nr=12.00", "alimiter=limit=0.950"])
        self.assertEqual(R._audio_effect_filters(None), [])


class TestAudioChain(unittest.TestCase):
    def test_applied_after_volume_before_delay(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=30, duration_frames=30,
                   volume=0.8, audio_fx=[{"type": "normalize", "target_lufs": -14}])
        chain = R._audio_chain("1:a", "a1", c, tl)
        self.assertIn("volume=0.800", chain)
        self.assertIn("loudnorm=I=-14.0", chain)
        self.assertIn("adelay=", chain)
        # order: volume → loudnorm → adelay
        self.assertLess(chain.index("volume=0.800"), chain.index("loudnorm"))
        self.assertLess(chain.index("loudnorm"), chain.index("adelay"))

    def test_no_audio_fx_no_change(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="audio", start_frame=0, duration_frames=30)
        chain = R._audio_chain("1:a", "a1", c, tl)
        self.assertNotIn("loudnorm", chain)
        self.assertNotIn("afftdn", chain)


class TestAudioOps(unittest.TestCase):
    def test_add_audio_effect_appends(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", media_type="audio", start_frame=0,
                                     duration_frames=30))
        self.assertEqual(T.add_audio_effect(tl, [c.id], {"type": "denoise", "amount": 18}), 1)
        self.assertEqual(T.add_audio_effect(tl, [c.id], {"type": "normalize"}), 1)
        self.assertEqual([e["type"] for e in c.audio_fx], ["denoise", "normalize"])
        # video and audio stacks are independent
        self.assertEqual(c.effects, [])

    def test_add_audio_effect_requires_type(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", media_type="audio", start_frame=0,
                                     duration_frames=30))
        self.assertEqual(T.add_audio_effect(tl, [c.id], {"amount": 5}), 0)
        self.assertEqual(c.audio_fx, [])

    def test_set_properties_replace_clear_roundtrip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", media_type="audio", start_frame=0,
                                     duration_frames=30))
        T.set_clip_properties(tl, [c.id], audio_fx=[{"type": "compressor", "ratio": 3}])
        self.assertEqual(c.audio_fx[0]["type"], "compressor")
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].audio_fx[0]["ratio"], 3)
        # malformed value sanitized on load
        bad = tl.to_dict()
        bad["tracks"][0]["clips"][0]["audio_fx"] = "oops"
        self.assertEqual(T.Timeline.from_dict(bad).tracks[0].clips[0].audio_fx, [])
        T.set_clip_properties(tl, [c.id], audio_fx=None)
        self.assertEqual(c.audio_fx, [])


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestAudioRender(unittest.TestCase):
    def test_audio_fx_stack_renders_with_audio(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        from clippilot.media.signals import probe
        d = tempfile.mkdtemp(prefix="afxtest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                    "-pix_fmt", "yuv420p", "-shortest", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   audio_fx=[{"type": "highpass", "freq": 90}, {"type": "denoise", "amount": 12},
                             {"type": "eq", "low": 2, "mid": -1, "high": 3},
                             {"type": "compressor", "threshold": -18, "ratio": 3},
                             {"type": "normalize", "target_lufs": -14},
                             {"type": "limiter", "limit": 0.95}])
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))
        self.assertTrue(probe(out).has_audio)             # audio survived the FX chain

    def test_deesser_and_reverb_render(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="afxtest2_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                    "-pix_fmt", "yuv420p", "-shortest", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   audio_fx=[{"type": "deesser"}, {"type": "reverb", "amount": 0.4},
                             {"type": "gain", "db": -3}])
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
