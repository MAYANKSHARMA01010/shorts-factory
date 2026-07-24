"""Tests for batch/folder enqueue (DFY throughput) — discovery + idempotent enqueue."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from clippilot import batch
from clippilot import config as cfg
from clippilot import db as dbmod
from clippilot.mcp_server import server as mcp
from clippilot.queue import JobQueue


def _touch(path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_bytes(b"x")


class TestFindVideos(unittest.TestCase):
    def test_finds_videos_recursively_and_filters(self):
        with tempfile.TemporaryDirectory() as d:
            _touch(os.path.join(d, "a.mp4"))
            _touch(os.path.join(d, "b.MOV"))           # case-insensitive ext
            _touch(os.path.join(d, "notes.txt"))       # not a video
            _touch(os.path.join(d, "sub", "c.mkv"))    # nested
            found = batch.find_videos(d, recursive=True)
            self.assertEqual(len(found), 3)
            self.assertTrue(all(Path(f).suffix.lower() in batch.VIDEO_EXTS for f in found))

    def test_non_recursive_skips_subfolders(self):
        with tempfile.TemporaryDirectory() as d:
            _touch(os.path.join(d, "a.mp4"))
            _touch(os.path.join(d, "sub", "b.mp4"))
            self.assertEqual(len(batch.find_videos(d, recursive=False)), 1)

    def test_missing_folder_is_empty(self):
        self.assertEqual(batch.find_videos("does_not_exist_xyz"), [])


class TestEnqueueFolder(unittest.TestCase):
    def _queue(self):
        return JobQueue(dbmod.connect(":memory:"), cfg.Settings())

    def test_enqueues_all_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as d:
            _touch(os.path.join(d, "one.mp4"))
            _touch(os.path.join(d, "two.mp4"))
            q = self._queue()
            r1 = batch.enqueue_folder(q, d, section="A", rights="owned")
            self.assertEqual(r1["found"], 2)
            self.assertEqual(r1["count"], 2)
            # re-running the same folder must NOT duplicate jobs
            r2 = batch.enqueue_folder(q, d)
            self.assertEqual(r2["count"], 2)
            self.assertEqual(len(q.list()), 2)


class TestMcpEnqueueFolder(unittest.TestCase):
    def setUp(self):
        self._prev = os.environ.get("CLIPPILOT_DATA")
        self._tmp = tempfile.TemporaryDirectory(prefix="clippilot_batch_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = self._tmp.name

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("CLIPPILOT_DATA", None)
        else:
            os.environ["CLIPPILOT_DATA"] = self._prev
        self._tmp.cleanup()

    def test_tool_enqueues_folder(self):
        vids = os.path.join(self._tmp.name, "client")
        _touch(os.path.join(vids, "x.mp4"))
        _touch(os.path.join(vids, "y.mp4"))
        resp = mcp.handle_rpc({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                               "params": {"name": "enqueue_folder", "arguments": {"folder": vids}}})
        data = json.loads(resp["result"]["content"][0]["text"])
        self.assertEqual(data["count"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
