"""Phase 1 tests for the in-app MCP HTTP server (JSON-RPC 2.0, loopback)."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
import urllib.request

from clippilot.mcp_server import server as mcp
from clippilot.media import ffmpeg as ffm


def rpc(port: int, method: str, params=None, rid: int = 1) -> dict:
    payload = {"jsonrpc": "2.0", "id": rid, "method": method}
    if params is not None:
        payload["params"] = params
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


class TestMcpServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv, cls.thread = mcp.serve_in_thread(port=0)
        cls.port = cls.srv.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_refuses_non_loopback(self):
        with self.assertRaises(ValueError):
            mcp.make_server(host="0.0.0.0", port=0)

    def test_initialize_and_tools_list(self):
        init = rpc(self.port, "initialize")
        self.assertEqual(init["result"]["serverInfo"]["name"], "clippilot")
        r = rpc(self.port, "tools/list")
        names = [t["name"] for t in r["result"]["tools"]]
        for expected in ("probe", "extract_signals", "understand_meta", "understand_video"):
            self.assertIn(expected, names)

    def test_unknown_method(self):
        r = rpc(self.port, "bogus/method")
        self.assertEqual(r["error"]["code"], -32601)

    def test_missing_path_arg_errors(self):
        r = rpc(self.port, "tools/call", {"name": "probe", "arguments": {}})
        self.assertEqual(r["error"]["code"], -32602)

    def test_call_unavailable_source(self):
        r = rpc(self.port, "tools/call",
                {"name": "extract_signals", "arguments": {"path": "missing_xyz.mp4"}})
        content = json.loads(r["result"]["content"][0]["text"])
        self.assertFalse(content["available"])

    @unittest.skipUnless(ffm.ffmpeg_available(), "ffmpeg not available")
    def test_call_extract_signals_on_real_sample(self):
        with tempfile.TemporaryDirectory(prefix="clippilot_mcp_") as d:
            sample = os.path.join(d, "s.mp4")
            ffm.run_ffmpeg([
                "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=30",
                "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                "-t", "2", "-y", sample,
            ], timeout=120)
            if not os.path.exists(sample):
                self.skipTest("could not generate sample")
            r = rpc(self.port, "tools/call",
                    {"name": "extract_signals", "arguments": {"path": sample}})
            content = json.loads(r["result"]["content"][0]["text"])
            self.assertTrue(content["available"])
            self.assertEqual(content["source"]["resolution"], "320x240")


if __name__ == "__main__":
    unittest.main(verbosity=2)
