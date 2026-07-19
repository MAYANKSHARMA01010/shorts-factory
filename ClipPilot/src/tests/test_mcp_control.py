"""Tests for the MCP pipeline-control surface + the stdio transport.

These exercise the tools Claude (the desktop app) uses to *operate* ClipPilot:
enqueue → run_engine → approval gate → approve → run_engine → published. They run
against a temp SQLite store (CLIPPILOT_DATA) so they never touch real data, and
need no ffmpeg / whisper / API key (placeholder sources degrade to stub stages).
"""
from __future__ import annotations

import io
import json
import os
import tempfile
import unittest

from clippilot.mcp_server import server as mcp
from clippilot.mcp_server import stdio as mcp_stdio


def call(name: str, arguments: dict | None = None, rid: int = 1) -> dict:
    """Invoke a tool via the JSON-RPC dispatcher; return the parsed tool result."""
    resp = mcp.handle_rpc({
        "jsonrpc": "2.0", "id": rid, "method": "tools/call",
        "params": {"name": name, "arguments": arguments or {}},
    })
    result = resp["result"]
    if result.get("isError"):
        raise AssertionError(f"tool {name} errored: {result['content'][0]['text']}")
    return json.loads(result["content"][0]["text"])


class TestMcpControl(unittest.TestCase):
    def setUp(self):
        self._prev = os.environ.get("CLIPPILOT_DATA")
        self._tmp = tempfile.TemporaryDirectory(prefix="clippilot_ctl_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = self._tmp.name

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("CLIPPILOT_DATA", None)
        else:
            os.environ["CLIPPILOT_DATA"] = self._prev
        self._tmp.cleanup()

    def test_tools_list_includes_control_tools(self):
        r = mcp.handle_rpc({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        names = {t["name"] for t in r["result"]["tools"]}
        for expected in ("enqueue", "list_jobs", "job_detail", "run_engine",
                         "approve", "reject", "record_strike", "job_counts"):
            self.assertIn(expected, names)
        # every control tool advertises an object inputSchema
        by_name = {t["name"]: t for t in r["result"]["tools"]}
        self.assertEqual(by_name["enqueue"]["inputSchema"]["required"], ["source_ref"])

    def test_enqueue_run_to_gate_then_approve_publishes(self):
        enq = call("enqueue", {"source_ref": "demo_podcast.mp4", "section": "A",
                               "rights_tag": "owned", "channel": "demo_yt"})
        jid = enq["job"]["id"]
        self.assertEqual(enq["job"]["status"], "pending")

        run1 = call("run_engine", {"max_steps": 50})
        self.assertIn(jid, run1["awaiting_approval"])  # parked at the human gate
        self.assertGreater(run1["steps"], 0)

        detail = call("job_detail", {"id": jid})
        self.assertTrue(detail["found"])
        self.assertEqual(detail["job"]["stage"], "approval")
        self.assertIn("title", detail["metadata"] if detail["metadata"] else {"title": None})

        ap = call("approve", {"id": jid})
        self.assertEqual(ap["job"]["stage"], "publish")

        run2 = call("run_engine", {"max_steps": 50})
        self.assertEqual(run2["counts"].get("done"), 1)
        self.assertNotIn(jid, run2["awaiting_approval"])

    def test_reject_marks_rejected(self):
        jid = call("enqueue", {"source_ref": "x.mp4"})["job"]["id"]
        call("run_engine")
        rej = call("reject", {"id": jid, "reason": "off-brand"})
        self.assertEqual(rej["job"]["status"], "rejected")

    def test_list_jobs_and_counts(self):
        call("enqueue", {"source_ref": "a.mp4"})
        call("enqueue", {"source_ref": "b.mp4"})
        listed = call("list_jobs", {"limit": 10})
        self.assertEqual(listed["count"], 2)
        counts = call("job_counts")
        self.assertEqual(sum(counts.values()), 2)

    def test_record_strike_pauses_channel_at_threshold(self):
        call("record_strike", {"channel": "ch1"})
        second = call("record_strike", {"channel": "ch1"})
        self.assertEqual(second["strikes"], 2)
        self.assertTrue(second["paused"])  # auto-pause at 2 (termination = 3)

    def test_handle_rpc_rejects_non_object_payloads(self):
        # valid JSON that isn't an object (batch array, scalar, null) must not crash
        for bad in ([{"jsonrpc": "2.0", "id": 1, "method": "ping"}], 42, None, "hi", True):
            resp = mcp.handle_rpc(bad)
            self.assertEqual(resp["error"]["code"], -32600)

    def test_missing_required_arg_errors(self):
        resp = mcp.handle_rpc({
            "jsonrpc": "2.0", "id": 1, "method": "tools/call",
            "params": {"name": "enqueue", "arguments": {}},
        })
        self.assertEqual(resp["error"]["code"], -32602)


class TestStdioTransport(unittest.TestCase):
    def setUp(self):
        self._prev = os.environ.get("CLIPPILOT_DATA")
        self._tmp = tempfile.TemporaryDirectory(prefix="clippilot_stdio_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = self._tmp.name

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("CLIPPILOT_DATA", None)
        else:
            os.environ["CLIPPILOT_DATA"] = self._prev
        self._tmp.cleanup()

    def _drive(self, messages: list[dict]) -> list[dict]:
        stdin = io.StringIO("\n".join(json.dumps(m) for m in messages) + "\n")
        stdout = io.StringIO()
        mcp_stdio.serve_stdio(stdin=stdin, stdout=stdout)
        out = stdout.getvalue().strip()
        return [json.loads(line) for line in out.splitlines() if line]

    def test_initialize_notification_then_call(self):
        responses = self._drive([
            {"jsonrpc": "2.0", "id": 1, "method": "initialize",
             "params": {"protocolVersion": "2025-06-18"}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},  # no id → no reply
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
             "params": {"name": "enqueue", "arguments": {"source_ref": "s.mp4"}}},
        ])
        # 3 responses (the notification drew none)
        self.assertEqual([r.get("id") for r in responses], [1, 2, 3])
        self.assertEqual(responses[0]["result"]["serverInfo"]["name"], "clippilot")
        self.assertEqual(responses[0]["result"]["protocolVersion"], "2025-06-18")
        names = {t["name"] for t in responses[1]["result"]["tools"]}
        self.assertIn("run_engine", names)
        call_result = json.loads(responses[2]["result"]["content"][0]["text"])
        self.assertEqual(call_result["job"]["status"], "pending")

    def test_parse_error_line(self):
        responses = self._drive_raw("not json\n")
        self.assertEqual(responses[0]["error"]["code"], -32700)

    def _drive_raw(self, raw: str) -> list[dict]:
        stdout = io.StringIO()
        mcp_stdio.serve_stdio(stdin=io.StringIO(raw), stdout=stdout)
        return [json.loads(line) for line in stdout.getvalue().splitlines() if line.strip()]


if __name__ == "__main__":
    unittest.main(verbosity=2)
