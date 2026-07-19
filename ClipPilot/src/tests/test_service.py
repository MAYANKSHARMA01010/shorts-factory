"""Tests for the unattended service runner + the settings control tools.

Together these are the "100% automation" control plane: set auto_approve on a
trusted lane → the service drains the pipeline to published, unattended. Run
against a temp store (CLIPPILOT_DATA); no ffmpeg/whisper/key needed.
"""
from __future__ import annotations

import json
import os
import tempfile
import threading
import types
import unittest
from pathlib import Path

from clippilot import config as cfg
from clippilot import service
from clippilot.mcp_server import server as mcp


def _enqueue(source_ref: str, **kw):
    from clippilot.db import connect
    from clippilot.queue import JobQueue
    conn = connect(cfg.db_path())
    try:
        return JobQueue(conn, cfg.Settings.load(cfg.settings_path())).enqueue(source_ref, **kw)
    finally:
        conn.close()


def _tool(name: str, arguments: dict | None = None) -> dict:
    resp = mcp.handle_rpc({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                           "params": {"name": name, "arguments": arguments or {}}})
    return json.loads(resp["result"]["content"][0]["text"])


class _TempData(unittest.TestCase):
    def setUp(self):
        self._prev = os.environ.get("CLIPPILOT_DATA")
        self._tmp = tempfile.TemporaryDirectory(prefix="clippilot_svc_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = self._tmp.name

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("CLIPPILOT_DATA", None)
        else:
            os.environ["CLIPPILOT_DATA"] = self._prev
        self._tmp.cleanup()


class TestSettingsTools(_TempData):
    def test_defaults_then_toggle_auto_approve(self):
        s = _tool("get_settings")
        self.assertFalse(s["auto_approve"])
        self.assertTrue(s["guardrails"]["approval_gate"])

        out = _tool("set_settings", {"auto_approve": True})
        self.assertTrue(out["settings"]["auto_approve"])
        # persisted + visible on a fresh read
        self.assertTrue(_tool("get_settings")["auto_approve"])
        self.assertTrue((Path(self._tmp.name) / "settings.json").exists())

    def test_set_settings_tolerates_unknown_guardrail_key(self):
        # a typo'd/legacy guardrail key must not crash the tool (free-form schema)
        out = _tool("set_settings", {"guardrails": {"approval_gates": False, "approval_gate": False}})
        self.assertIn("settings", out)
        self.assertFalse(out["settings"]["guardrails"]["approval_gate"])  # known key still applied

    def test_guardrail_merge_keeps_other_toggles(self):
        _tool("set_settings", {"guardrails": {"strike_pause_threshold": 1}})
        g = _tool("get_settings")["guardrails"]
        self.assertEqual(g["strike_pause_threshold"], 1)
        self.assertTrue(g["approval_gate"])  # untouched toggle preserved
        self.assertTrue(g["block_realperson_faceswap"])


class TestService(_TempData):
    def test_cycle_parks_at_gate_by_default(self):
        job = _enqueue("demo.mp4")
        result = service.run_cycle()
        self.assertGreater(result["steps"], 0)
        self.assertIn(job.id, result["awaiting_approval"])
        self.assertNotIn("error", result)

    def test_auto_approve_lets_service_publish_unattended(self):
        _tool("set_settings", {"auto_approve": True})  # graduate this lane
        _enqueue("demo.mp4", channel="yt1")
        cycles = service.run_service(interval=0.0, max_cycles=1)
        self.assertEqual(cycles, 1)
        self.assertEqual(service.run_cycle()["counts"].get("done"), 1)

    def test_run_service_honours_max_cycles_and_stop(self):
        stop = threading.Event()
        seen: list[dict] = []
        cycles = service.run_service(interval=0.0, max_cycles=3,
                                     stop_event=stop, on_cycle=seen.append)
        self.assertEqual(cycles, 3)
        self.assertEqual(len(seen), 3)


class TestTaskScheduler(_TempData):
    def test_build_install_command(self):
        cmd = service.build_install_command(every_minutes=5, bat_path="X.bat")
        self.assertEqual(cmd[0], "schtasks")
        self.assertIn("/Create", cmd)
        self.assertIn("ClipPilot", cmd)
        self.assertIn("MINUTE", cmd)
        self.assertEqual(cmd[cmd.index("/MO") + 1], "5")

    def test_build_uninstall_command(self):
        cmd = service.build_uninstall_command()
        self.assertEqual(cmd[:2], ["schtasks", "/Delete"])
        self.assertIn("ClipPilot", cmd)

    def test_install_command_tr_is_bare_path(self):
        cmd = service.build_install_command(bat_path="C:/a b/tick.bat")
        tr = cmd[cmd.index("/TR") + 1]
        self.assertEqual(tr, "C:/a b/tick.bat")   # bare — subprocess quotes it, no pre-quoting
        self.assertNotIn('"', tr)

    def test_build_status_command(self):
        cmd = service.build_status_command()
        self.assertEqual(cmd[:2], ["schtasks", "/Query"])
        self.assertIn("ClipPilot", cmd)

    def test_write_service_bat(self):
        path = service.write_service_bat(python_exe="py.exe", pythonpath="C:\\src",
                                         data_dir=self._tmp.name)
        content = Path(path).read_text(encoding="utf-8")
        self.assertIn("PYTHONPATH=C:\\src", content)
        self.assertIn("-m clippilot.service --once", content)
        Path(path).unlink(missing_ok=True)


class TestControllerServiceControl(_TempData):
    """The GUI service-control wiring — schtasks calls are mocked, no real tasks."""

    def _ctrl(self):
        from clippilot.db import connect
        from clippilot.queue import JobQueue
        from clippilot.ui.controller import AppController
        return AppController(JobQueue(connect(cfg.db_path()), cfg.Settings()))

    def test_install_remove_delegate_to_service(self):
        import clippilot.service as svc
        ctrl = self._ctrl()
        ok = types.SimpleNamespace(returncode=0, stdout="SUCCESS", stderr="")
        orig_i, orig_u = svc.install_task, svc.uninstall_task
        try:
            svc.install_task = lambda **k: ok
            svc.uninstall_task = lambda **k: ok
            self.assertTrue(ctrl.install_service_task(5)["ok"])
            self.assertTrue(ctrl.remove_service_task()["ok"])
        finally:
            svc.install_task, svc.uninstall_task = orig_i, orig_u

    def test_automation_status(self):
        import clippilot.service as svc
        ctrl = self._ctrl()
        orig = svc.task_installed
        try:
            svc.task_installed = lambda *a, **k: True
            st = ctrl.automation_status()
            self.assertIn("auto_approve", st)
            self.assertTrue(st["task_installed"])
        finally:
            svc.task_installed = orig

    def test_install_cli_forwards_data_dir(self):
        import clippilot.service as svc
        captured = {}
        orig = svc.install_task
        try:
            svc.install_task = lambda every_minutes=5, data_dir=None: (
                captured.update(dir=data_dir, every=every_minutes)
                or types.SimpleNamespace(returncode=0, stdout="", stderr=""))
            svc.main(["--install", "--every", "7"])  # CLIPPILOT_DATA set by _TempData.setUp
            self.assertEqual(captured["dir"], self._tmp.name)
            self.assertEqual(captured["every"], 7)
        finally:
            svc.install_task = orig


if __name__ == "__main__":
    unittest.main(verbosity=2)
