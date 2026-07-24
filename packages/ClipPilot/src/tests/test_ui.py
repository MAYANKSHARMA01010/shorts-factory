"""GUI tests: the Qt-free controller always runs; the offscreen window-construction
test runs only when PySide6 is importable (QT_QPA_PLATFORM=offscreen, no display)."""
from __future__ import annotations

import os
import unittest

from clippilot import config as cfg
from clippilot import db as dbmod
from clippilot.engine import Engine
from clippilot.models import JobStatus, RightsTag, Section
from clippilot.queue import JobQueue
from clippilot.ui.controller import SECTION_LABELS, AppController


def _ctrl() -> tuple[AppController, JobQueue]:
    q = JobQueue(dbmod.connect(":memory:"), cfg.Settings())
    return AppController(q), q


class TestController(unittest.TestCase):
    def test_enqueue_and_section_filter(self):
        ctrl, _ = _ctrl()
        ctrl.enqueue("a.mp4", Section.PAID_CLIPPING, RightsTag.OWNED)
        ctrl.enqueue("b.mp4", Section.AD_SHARE, RightsTag.THIRD_PARTY)
        self.assertEqual(len(ctrl.jobs_for_section(Section.PAID_CLIPPING)), 1)
        self.assertEqual(len(ctrl.jobs_for_section(Section.AD_SHARE)), 1)

    def test_approval_flow_through_controller(self):
        ctrl, q = _ctrl()
        eng = Engine(q)
        job = ctrl.enqueue("x.mp4", Section.PAID_CLIPPING)
        eng.drain()  # → parks at approval
        pending = ctrl.pending_approvals()
        self.assertEqual([j.id for j in pending], [job.id])
        ctrl.approve(job.id)
        eng.drain()
        self.assertEqual(ctrl.get(job.id).status, JobStatus.DONE)

    def test_reject_through_controller(self):
        ctrl, q = _ctrl()
        eng = Engine(q)
        job = ctrl.enqueue("x.mp4", Section.FACELESS_FUNNEL)
        eng.drain()
        ctrl.reject(job.id, "off-brand")
        self.assertEqual(ctrl.get(job.id).status, JobStatus.REJECTED)

    def test_section_labels_present(self):
        for s in Section:
            self.assertIn(s, SECTION_LABELS)

    def test_thumbnail_none_without_clips(self):
        from clippilot.models import Job
        ctrl, _ = _ctrl()
        self.assertIsNone(ctrl.thumbnail_for(Job(payload={})))

    def test_thumbnail_generate_false_is_cached_only(self):
        from clippilot.models import Job
        ctrl, _ = _ctrl()
        # uncached clip → None (no ffmpeg) so the GUI never blocks on the fast path
        job = Job(payload={"caption": {"clips": ["does_not_exist.mp4"]}})
        self.assertIsNone(ctrl.thumbnail_for(job, generate=False))

    def test_controller_profiles_crud(self):
        import os
        import tempfile
        prev = os.environ.get("CLIPPILOT_DATA")
        tmp = tempfile.TemporaryDirectory(prefix="clippilot_uiprof_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = tmp.name
        try:
            ctrl, _ = _ctrl()
            self.assertEqual(ctrl.list_profiles(), [])
            ctrl.save_profile(name="Acme", section="B", channel="yt1", target_seconds=20)
            names = [p.name for p in ctrl.list_profiles()]
            self.assertIn("Acme", names)
            self.assertTrue(ctrl.delete_profile("Acme"))
            self.assertEqual(ctrl.list_profiles(), [])
        finally:
            if prev is None:
                os.environ.pop("CLIPPILOT_DATA", None)
            else:
                os.environ["CLIPPILOT_DATA"] = prev
            tmp.cleanup()

    def test_get_save_settings_roundtrip(self):
        import os
        import tempfile
        prev = os.environ.get("CLIPPILOT_DATA")
        tmp = tempfile.TemporaryDirectory(prefix="clippilot_ui_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = tmp.name
        try:
            ctrl, _ = _ctrl()
            self.assertFalse(ctrl.get_settings()["auto_approve"])  # default
            out = ctrl.save_settings({"auto_approve": True, "bgm_path": "C:/music/bed.mp3",
                                      "guardrails": {"strike_pause_threshold": 1}})
            self.assertTrue(out["auto_approve"])
            self.assertEqual(out["bgm_path"], "C:/music/bed.mp3")    # BGM persisted
            self.assertEqual(out["guardrails"]["strike_pause_threshold"], 1)
            self.assertTrue(out["guardrails"]["approval_gate"])     # untouched toggle preserved
            self.assertTrue(ctrl.get_settings()["auto_approve"])    # persisted to disk
            self.assertTrue(ctrl.queue.settings.auto_approve)        # applied to the live queue
        finally:
            if prev is None:
                os.environ.pop("CLIPPILOT_DATA", None)
            else:
                os.environ["CLIPPILOT_DATA"] = prev
            tmp.cleanup()


def _pyside_available() -> bool:
    try:
        import PySide6  # noqa: F401
        return True
    except ImportError:
        return False


@unittest.skipUnless(_pyside_available(), "PySide6 not installed")
class TestWindowConstructs(unittest.TestCase):
    def test_main_window_builds_offscreen(self):
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        from PySide6 import QtWidgets

        from clippilot.ui.app import MainWindow

        app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
        ctrl, _ = _ctrl()
        win = MainWindow(ctrl, start_worker=False)  # no background thread in tests
        try:
            self.assertEqual(win.tabs.count(), 7)  # Dashboard + A/B/C + Review + Templates + Settings
            # Section A clips a video; B/C generate from a topic — form reflects that.
            self.assertEqual(win.section_a.add_btn.text(), "Add job")
            self.assertEqual(win.section_b.add_btn.text(), "Generate short")
            self.assertIn("Source", win.section_a.source.placeholderText())
            self.assertIn("Topic", win.section_b.source.placeholderText())
            win.refresh_all()  # exercises every tab's refresh()
        finally:
            win.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
