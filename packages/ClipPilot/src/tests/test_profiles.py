"""Tests for DFY templates (profiles): store CRUD, enqueue-with-profile, MCP tools."""
from __future__ import annotations

import json
import os
import tempfile
import unittest

from clippilot import config as cfg
from clippilot import db as dbmod
from clippilot import profiles
from clippilot.mcp_server import server as mcp
from clippilot.queue import JobQueue


class _TempData(unittest.TestCase):
    def setUp(self):
        self._prev = os.environ.get("CLIPPILOT_DATA")
        self._tmp = tempfile.TemporaryDirectory(prefix="clippilot_prof_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = self._tmp.name

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("CLIPPILOT_DATA", None)
        else:
            os.environ["CLIPPILOT_DATA"] = self._prev
        self._tmp.cleanup()


class TestProfileStore(_TempData):
    def test_save_get_list_delete(self):
        self.assertEqual(profiles.load_profiles(), {})
        profiles.save_profile(profiles.Profile(name="AcmeFunnel", section="B",
                                               voice="Zira", bgm_path="C:/m/bed.mp3", target_seconds=25))
        got = profiles.get_profile("AcmeFunnel")
        self.assertIsNotNone(got)
        self.assertEqual(got.section, "B")
        self.assertEqual(got.voice, "Zira")
        self.assertEqual(got.target_seconds, 25)
        self.assertIn("AcmeFunnel", profiles.load_profiles())
        self.assertTrue(profiles.delete_profile("AcmeFunnel"))
        self.assertIsNone(profiles.get_profile("AcmeFunnel"))
        self.assertFalse(profiles.delete_profile("AcmeFunnel"))

    def test_empty_name_rejected(self):
        with self.assertRaises(ValueError):
            profiles.save_profile(profiles.Profile(name="  "))

    def test_corrupt_file_is_empty(self):
        profiles.profiles_path().parent.mkdir(parents=True, exist_ok=True)
        profiles.profiles_path().write_text("{ not json", encoding="utf-8")
        self.assertEqual(profiles.load_profiles(), {})


class TestEnqueueWithProfile(_TempData):
    def test_applies_section_rights_channel_and_payload(self):
        q = JobQueue(dbmod.connect(cfg.db_path()), cfg.Settings())
        p = profiles.Profile(name="Client1", section="B", rights="owned", channel="client_yt",
                             voice="David", bgm_path="C:/m/x.mp3", target_seconds=20)
        job = profiles.enqueue_with_profile(q, "five facts about bees", p)
        self.assertEqual(job.section.value, "B")
        self.assertEqual(job.channel, "client_yt")
        prof = job.payload["profile"]
        self.assertEqual(prof["voice"], "David")
        self.assertEqual(prof["bgm_path"], "C:/m/x.mp3")
        self.assertEqual(prof["target_seconds"], 20)


def _tool(name, args=None):
    resp = mcp.handle_rpc({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                           "params": {"name": name, "arguments": args or {}}})
    return json.loads(resp["result"]["content"][0]["text"])


class TestProfileMcpTools(_TempData):
    def test_save_list_enqueue_via_mcp(self):
        _tool("save_profile", {"name": "P1", "section": "B", "channel": "yt1", "target_seconds": 30})
        listed = _tool("list_profiles")
        self.assertTrue(any(p["name"] == "P1" for p in listed["profiles"]))
        out = _tool("enqueue_with_profile", {"source_ref": "a topic", "profile": "P1"})
        self.assertEqual(out["job"]["section"], "B")
        self.assertEqual(out["job"]["channel"], "yt1")

    def test_enqueue_unknown_profile_errors(self):
        out = _tool("enqueue_with_profile", {"source_ref": "x", "profile": "nope"})
        self.assertIn("error", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
