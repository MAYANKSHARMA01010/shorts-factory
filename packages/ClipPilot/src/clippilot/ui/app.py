"""The PySide6 desktop window: 3 section tabs (A/B/C) + dashboard + the
approval-gate review screen. The engine runs on a background thread (worker.py);
this thread only reads/approves/rejects via the controller and refreshes on a
QTimer. Launch: python -m clippilot.ui
"""
from __future__ import annotations

import os
import sys
from typing import Optional

from PySide6 import QtCore, QtGui, QtWidgets

from .. import config as cfg
from ..db import connect
from ..models import Job, RightsTag, Section
from ..queue import JobQueue
from .controller import SECTION_BLURB, SECTION_LABELS, AppController
from .worker import EngineWorker

APP_NAME = "ClipPilot"


def _make_icon() -> QtGui.QIcon:
    pm = QtGui.QPixmap(64, 64)
    pm.fill(QtCore.Qt.transparent)
    p = QtGui.QPainter(pm)
    p.setRenderHint(QtGui.QPainter.Antialiasing)
    p.setBrush(QtGui.QColor("#2D7FF9"))
    p.setPen(QtCore.Qt.NoPen)
    p.drawRoundedRect(6, 6, 52, 52, 14, 14)
    p.setBrush(QtGui.QColor("white"))
    p.drawPolygon(QtGui.QPolygon([QtCore.QPoint(26, 20), QtCore.QPoint(26, 44), QtCore.QPoint(46, 32)]))
    p.end()
    return QtGui.QIcon(pm)


def _open_path(path: str) -> None:
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{path}"')
        else:
            os.system(f'xdg-open "{path}"')
    except Exception:  # noqa: BLE001
        pass


def _job_row(job: Job) -> list[str]:
    return [str(job.id), job.status.value, job.stage.value, job.rights_tag.value,
            job.channel or "-", job.source_ref]


class JobsTable(QtWidgets.QTableWidget):
    HEADERS = ["#", "Status", "Stage", "Rights", "Channel", "Source"]

    def __init__(self):
        super().__init__(0, len(self.HEADERS))
        self.setHorizontalHeaderLabels(self.HEADERS)
        self.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)
        self.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
        self.horizontalHeader().setStretchLastSection(True)
        self.verticalHeader().setVisible(False)

    def set_jobs(self, jobs: list[Job]) -> None:
        self.setRowCount(len(jobs))
        for r, job in enumerate(jobs):
            for c, val in enumerate(_job_row(job)):
                self.setItem(r, c, QtWidgets.QTableWidgetItem(val))


class DashboardTab(QtWidgets.QWidget):
    def __init__(self, ctrl: AppController):
        super().__init__()
        self.ctrl = ctrl
        lay = QtWidgets.QVBoxLayout(self)
        self.counts = QtWidgets.QLabel()
        self.counts.setStyleSheet("font-size: 14px; padding: 6px;")
        lay.addWidget(self.counts)
        lay.addWidget(QtWidgets.QLabel("Recent jobs"))
        self.table = JobsTable()
        lay.addWidget(self.table)

    def refresh(self) -> None:
        c = self.ctrl.counts()
        order = ["pending", "running", "blocked_approval", "needs_attention", "done", "rejected"]
        parts = [f"{k}: {c.get(k, 0)}" for k in order]
        self.counts.setText("  |  ".join(parts) or "no jobs yet")
        self.table.set_jobs(self.ctrl.list_jobs(limit=100))


class SectionTab(QtWidgets.QWidget):
    def __init__(self, ctrl: AppController, section: Section):
        super().__init__()
        self.ctrl = ctrl
        self.section = section
        lay = QtWidgets.QVBoxLayout(self)

        blurb = QtWidgets.QLabel(SECTION_BLURB[section])
        blurb.setWordWrap(True)
        blurb.setStyleSheet("color: #555; padding: 4px;")
        lay.addWidget(blurb)

        # Section A clips a SOURCE VIDEO; B/C GENERATE from a TOPIC — make the form
        # match so it's never ambiguous what to type.
        self._is_clip = (section == Section.PAID_CLIPPING)

        form = QtWidgets.QHBoxLayout()
        self.source = QtWidgets.QLineEdit()
        self.source.setPlaceholderText(
            "Source video path or URL…" if self._is_clip
            else "Topic for the short — e.g. “3 surprising facts about space”")
        self.browse = QtWidgets.QPushButton("Browse…")
        self.browse.clicked.connect(self._browse)
        self.rights = QtWidgets.QComboBox()
        self.rights.addItems([r.value for r in RightsTag])
        self.channel = QtWidgets.QLineEdit()
        self.channel.setPlaceholderText("channel (optional)")
        self.add_btn = QtWidgets.QPushButton("Add job" if self._is_clip else "Generate short")
        self.add_btn.clicked.connect(self._enqueue)

        form.addWidget(self.source)
        if self._is_clip:
            form.addWidget(self.browse)
            form.addWidget(QtWidgets.QLabel("rights:"))
            form.addWidget(self.rights)
        form.addWidget(self.channel)
        form.addWidget(self.add_btn)
        lay.addLayout(form)

        self.table = JobsTable()
        lay.addWidget(self.table)

    def _browse(self) -> None:
        path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "Choose a video", "", "Video (*.mp4 *.mov *.mkv *.webm *.avi);;All (*.*)")
        if path:
            self.source.setText(path)

    def _enqueue(self) -> None:
        src = self.source.text().strip()
        if not src:
            return
        # Generated (B/C) content is owned by the operator; A uses the chosen rights.
        rights = (RightsTag(self.rights.currentText()) if self._is_clip else RightsTag.OWNED)
        self.ctrl.enqueue(src, self.section, rights, self.channel.text().strip() or None)
        self.source.clear()
        self.channel.clear()
        self.refresh()

    def refresh(self) -> None:
        self.table.set_jobs(self.ctrl.jobs_for_section(self.section))


class _ThumbEmitter(QtCore.QObject):
    done = QtCore.Signal(int, str)  # (job_id, thumbnail_path)


class _ThumbTask(QtCore.QRunnable):
    def __init__(self, fn):
        super().__init__()
        self._fn = fn

    def run(self) -> None:  # runs on a QThreadPool worker thread
        self._fn()


class ReviewTab(QtWidgets.QWidget):
    """The approval gate: review a job's clip + metadata, then Approve/Reject."""

    def __init__(self, ctrl: AppController):
        super().__init__()
        self.ctrl = ctrl
        self._thumb_pool = QtCore.QThreadPool.globalInstance()
        self._thumb_emitter = _ThumbEmitter()
        self._thumb_emitter.done.connect(self._on_thumb_ready)
        lay = QtWidgets.QHBoxLayout(self)

        left = QtWidgets.QVBoxLayout()
        left.addWidget(QtWidgets.QLabel("Awaiting approval"))
        self.list = QtWidgets.QListWidget()
        self.list.currentItemChanged.connect(self._show_detail)
        left.addWidget(self.list)
        lay.addLayout(left, 1)

        right = QtWidgets.QVBoxLayout()
        self.thumb = QtWidgets.QLabel("(select a job to preview)")
        self.thumb.setAlignment(QtCore.Qt.AlignCenter)
        self.thumb.setMinimumHeight(260)
        self.thumb.setStyleSheet("background:#111; color:#888; border:1px solid #333;")
        right.addWidget(self.thumb)
        self.detail = QtWidgets.QTextEdit()
        self.detail.setReadOnly(True)
        right.addWidget(self.detail)
        btns = QtWidgets.QHBoxLayout()
        self.open_btn = QtWidgets.QPushButton("▶ Open clip")
        self.open_btn.clicked.connect(self._open_clip)
        self.approve_btn = QtWidgets.QPushButton("✅ Approve & publish")
        self.approve_btn.clicked.connect(self._approve)
        self.reject_btn = QtWidgets.QPushButton("✖ Reject")
        self.reject_btn.clicked.connect(self._reject)
        for b in (self.open_btn, self.approve_btn, self.reject_btn):
            btns.addWidget(b)
        right.addLayout(btns)
        lay.addLayout(right, 2)
        self._current: Optional[int] = None

    def refresh(self) -> None:
        # Keep the operator's selection across the 2s auto-refresh — otherwise the
        # list selection is dropped and Approve/Reject/Open silently become no-ops.
        prev = self._current
        self.list.blockSignals(True)
        self.list.clear()
        target = None
        for i, job in enumerate(self.ctrl.pending_approvals()):
            it = QtWidgets.QListWidgetItem(f"#{job.id} · {SECTION_LABELS[job.section]}")
            it.setData(QtCore.Qt.UserRole, job.id)
            self.list.addItem(it)
            if job.id == prev:
                target = i
        if target is not None:
            # Restore the same job WITHOUT re-firing _show_detail (it's already shown).
            self.list.setCurrentRow(target)
            self.list.blockSignals(False)
        elif prev is None and self.list.count():
            self.list.blockSignals(False)
            self.list.setCurrentRow(0)  # first populate → select + show its detail
        else:
            self.list.blockSignals(False)
            if prev is not None:  # the previously-selected job left the gate
                self._current = None
                self.detail.clear()
                self._clear_thumb("(select a job to preview)")

    def _selected_job_id(self) -> Optional[int]:
        it = self.list.currentItem()
        return it.data(QtCore.Qt.UserRole) if it else None

    def _show_detail(self) -> None:
        jid = self._selected_job_id()
        self._current = jid
        if jid is None:
            self.detail.clear()
            self._clear_thumb("(select a job to preview)")
            return
        job = self.ctrl.get(jid)
        if not job:
            return
        u = self.ctrl.understanding_for(job)
        meta = self.ctrl.metadata_for(job)
        clips = self.ctrl.clips_for(job)
        lines = [
            f"JOB #{job.id} — {SECTION_LABELS[job.section]}",
            f"source: {job.source_ref}   rights: {job.rights_tag.value}",
            "",
            f"SUMMARY: {u.get('summary', '(no understanding yet)')}",
            f"TOPICS: {', '.join(u.get('topics', []) or [])}",
            f"LIKENESS FLAG: {'⚠ identifiable person — consent required' if 'identifiable_person' in (u.get('flags', {}) or {}).get('likeness', []) else 'none'}",
            "",
            f"TITLE: {meta.get('title', '(metadata pending)')}",
            f"CAPTION: {meta.get('caption', '')}",
            f"HASHTAGS: {' '.join(meta.get('hashtags', []) or [])}",
            "",
            f"CLIPS ({len(clips)}):",
        ] + [f"  • {c}" for c in clips]
        if job.rights_tag == RightsTag.THIRD_PARTY:
            lines += ["", "⚠ THIRD-PARTY SOURCE — verify rights before publishing (copyright/strike risk)."]
        self.detail.setPlainText("\n".join(lines))
        self._set_thumb(job)

    def _clear_thumb(self, text: str) -> None:
        self.thumb.setPixmap(QtGui.QPixmap())
        self.thumb.setText(text)

    def _apply_thumb(self, path: str) -> None:
        pm = QtGui.QPixmap(path)
        if not pm.isNull():
            self.thumb.setPixmap(pm.scaledToHeight(300, QtCore.Qt.SmoothTransformation))
        else:
            self._clear_thumb("(no preview)")

    def _set_thumb(self, job: Job) -> None:
        # Fast path: an already-cached frame loads on the GUI thread (no ffmpeg).
        try:
            cached = self.ctrl.thumbnail_for(job, generate=False)
        except Exception:  # noqa: BLE001 — preview is best-effort
            cached = None
        if cached and os.path.exists(cached):
            self._apply_thumb(cached)
            return
        # Otherwise extract off the GUI thread (ffmpeg is blocking) and deliver the
        # result via a queued signal, so the window never freezes on selection.
        self._clear_thumb("(generating preview…)")
        jid = job.id or -1
        ctrl, emitter = self.ctrl, self._thumb_emitter

        def work() -> None:
            try:
                p = ctrl.thumbnail_for(job, generate=True) or ""
            except Exception:  # noqa: BLE001
                p = ""
            emitter.done.emit(jid, p)

        self._thumb_pool.start(_ThumbTask(work))

    def _on_thumb_ready(self, jid: int, path: str) -> None:
        if jid == self._current and path and os.path.exists(path):
            self._apply_thumb(path)

    def _open_clip(self) -> None:
        jid = self._selected_job_id()
        if jid is None:
            return
        clips = self.ctrl.clips_for(self.ctrl.get(jid))
        if clips:
            _open_path(clips[0])

    def _approve(self) -> None:
        jid = self._selected_job_id()
        if jid is None:
            return
        try:
            self.ctrl.approve(jid)
        except ValueError:
            pass
        self._current = None
        self.refresh()

    def _reject(self) -> None:
        jid = self._selected_job_id()
        if jid is None:
            return
        try:
            self.ctrl.reject(jid)
        except ValueError:
            pass
        self._current = None
        self.refresh()


class ProfilesTab(QtWidgets.QWidget):
    """DFY templates — per-client presets (section, channel, voice, music, length)
    applied at enqueue. Refreshed on open + after save/delete (not on the timer, so
    the table selection isn't reset under the operator)."""

    HEADERS = ["Name", "Section", "Channel", "Voice", "BGM", "Secs"]

    def __init__(self, ctrl: AppController):
        super().__init__()
        self.ctrl = ctrl
        lay = QtWidgets.QVBoxLayout(self)
        blurb = QtWidgets.QLabel("Done-for-you templates — save a client's preset, then enqueue "
                                 "jobs with it (CLI: enqueue-profile; Claude: enqueue_with_profile).")
        blurb.setWordWrap(True)
        blurb.setStyleSheet("color:#555; padding:4px;")
        lay.addWidget(blurb)

        form = QtWidgets.QHBoxLayout()
        self.name = QtWidgets.QLineEdit()
        self.name.setPlaceholderText("template name")
        self.section = QtWidgets.QComboBox()
        self.section.addItems([s.value for s in Section])
        self.channel = QtWidgets.QLineEdit()
        self.channel.setPlaceholderText("channel")
        self.voice = QtWidgets.QLineEdit()
        self.voice.setPlaceholderText("voice (Section B/C)")
        self.seconds = QtWidgets.QSpinBox()
        self.seconds.setRange(10, 90)
        self.seconds.setValue(35)
        save = QtWidgets.QPushButton("Save template")
        save.clicked.connect(self._save)
        for w in (self.name, QtWidgets.QLabel("section:"), self.section, self.channel,
                  self.voice, QtWidgets.QLabel("secs:"), self.seconds, save):
            form.addWidget(w)
        lay.addLayout(form)

        self.table = QtWidgets.QTableWidget(0, len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
        self.table.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)
        self.table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
        self.table.horizontalHeader().setStretchLastSection(True)
        lay.addWidget(self.table)

        delete = QtWidgets.QPushButton("Delete selected template")
        delete.clicked.connect(self._delete)
        lay.addWidget(delete)

    def _save(self) -> None:
        name = self.name.text().strip()
        if not name:
            return
        self.ctrl.save_profile(name=name, section=self.section.currentText(),
                               channel=self.channel.text().strip() or None,
                               voice=self.voice.text().strip() or None,
                               target_seconds=self.seconds.value())
        self.name.clear()
        self.channel.clear()
        self.voice.clear()
        self.refresh()

    def _delete(self) -> None:
        row = self.table.currentRow()
        if row < 0:
            return
        item = self.table.item(row, 0)
        if item:
            self.ctrl.delete_profile(item.text())
            self.refresh()

    def refresh(self) -> None:
        profs = self.ctrl.list_profiles()
        self.table.setRowCount(len(profs))
        for r, p in enumerate(profs):
            cells = [p.name, p.section, p.channel or "-", p.voice or "-",
                     p.bgm_path or "-", str(p.target_seconds)]
            for c, val in enumerate(cells):
                self.table.setItem(r, c, QtWidgets.QTableWidgetItem(val))


class SettingsTab(QtWidgets.QWidget):
    """Operator settings — the automation control plane inside the app. Toggling
    auto-approve here graduates the running engine to hands-off (the worker
    re-reads settings each cycle). Refreshed once on open so it never stomps an
    in-progress edit."""

    def __init__(self, ctrl: AppController):
        super().__init__()
        self.ctrl = ctrl
        lay = QtWidgets.QVBoxLayout(self)

        warn = QtWidgets.QLabel(
            "⚠ Auto-approve publishes WITHOUT the human review gate. Enable it only for a "
            "trusted lane — your OWN source + cleared music. Never for third-party / face-present "
            "/ ad-share content (those keep the gate + strike guardrail)."
        )
        warn.setWordWrap(True)
        warn.setStyleSheet("color:#a33000; padding:6px; background:#fff6f0; border:1px solid #f0c0a0;")
        lay.addWidget(warn)

        form = QtWidgets.QFormLayout()
        self.auto_approve = QtWidgets.QCheckBox("Auto-approve & publish (unattended)")
        self.approval_gate = QtWidgets.QCheckBox("Human approval gate ON")
        self.strike_threshold = QtWidgets.QSpinBox()
        self.strike_threshold.setRange(1, 3)
        self.brain_model = QtWidgets.QLineEdit()
        self.compose_concat = QtWidgets.QCheckBox("Stitch a job's clips into one compilation (compose)")
        self.bgm_path = QtWidgets.QLineEdit()
        self.bgm_path.setPlaceholderText("optional: path to a CLEARED/royalty-free music file (Section B)")
        form.addRow(self.auto_approve)
        form.addRow(self.approval_gate)
        form.addRow("Strike pause threshold (termination = 3):", self.strike_threshold)
        form.addRow("Brain model:", self.brain_model)
        form.addRow(self.compose_concat)
        form.addRow("Background music:", self.bgm_path)
        lay.addLayout(form)

        locked = QtWidgets.QLabel(
            "🔒 Locked guardrails: AI-disclosure forced ON at publish · no non-consensual "
            "real-person face/voice swap (hard line)."
        )
        locked.setWordWrap(True)
        locked.setStyleSheet("color:#555; padding:4px;")
        lay.addWidget(locked)

        # Unattended automation — the 24/7 Windows Task Scheduler integration.
        auto_box = QtWidgets.QGroupBox("Unattended automation (24/7, even when this app is closed)")
        ab = QtWidgets.QVBoxLayout(auto_box)
        self.auto_status = QtWidgets.QLabel("auto-approve: ?")
        self.task_status = QtWidgets.QLabel("24/7 task: (click Check status)")
        ab.addWidget(self.auto_status)
        ab.addWidget(self.task_status)
        abtns = QtWidgets.QHBoxLayout()
        self.check_btn = QtWidgets.QPushButton("Check status")
        self.check_btn.clicked.connect(self._check_automation)
        self.install_btn = QtWidgets.QPushButton("Install 24/7 (every 5 min)")
        self.install_btn.clicked.connect(self._install_task)
        self.remove_btn = QtWidgets.QPushButton("Remove 24/7")
        self.remove_btn.clicked.connect(self._remove_task)
        for b in (self.check_btn, self.install_btn, self.remove_btn):
            abtns.addWidget(b)
        ab.addLayout(abtns)
        lay.addWidget(auto_box)

        btns = QtWidgets.QHBoxLayout()
        self.save_btn = QtWidgets.QPushButton("Save settings")
        self.save_btn.clicked.connect(self._save)
        self.status = QtWidgets.QLabel("")
        btns.addWidget(self.save_btn)
        btns.addWidget(self.status)
        btns.addStretch(1)
        lay.addLayout(btns)
        lay.addStretch(1)

    def refresh(self) -> None:
        s = self.ctrl.get_settings()
        g = s.get("guardrails", {}) or {}
        self.auto_approve.setChecked(bool(s.get("auto_approve")))
        self.approval_gate.setChecked(bool(g.get("approval_gate", True)))
        self.strike_threshold.setValue(int(g.get("strike_pause_threshold", 2)))
        self.brain_model.setText(str(s.get("brain_model", "claude-opus-4-8")))
        self.compose_concat.setChecked(bool(s.get("compose_concat")))
        self.bgm_path.setText(str(s.get("bgm_path", "")))
        # auto-approve status from settings only (no subprocess); task status is lazy.
        self.auto_status.setText(f"auto-approve: {'ON' if s.get('auto_approve') else 'OFF'}")

    def _save(self) -> None:
        s = self.ctrl.save_settings({
            "auto_approve": self.auto_approve.isChecked(),
            "brain_model": self.brain_model.text().strip() or "claude-opus-4-8",
            "compose_concat": self.compose_concat.isChecked(),
            "bgm_path": self.bgm_path.text().strip(),
            "guardrails": {
                "approval_gate": self.approval_gate.isChecked(),
                "strike_pause_threshold": self.strike_threshold.value(),
            },
        })
        self.status.setText("✓ saved · applies on the next engine cycle")
        self.auto_status.setText(f"auto-approve: {'ON' if s.get('auto_approve') else 'OFF'}")

    def _check_automation(self) -> None:
        st = self.ctrl.automation_status()
        self.auto_status.setText(f"auto-approve: {'ON' if st['auto_approve'] else 'OFF'}")
        self.task_status.setText(f"24/7 task: {'installed' if st['task_installed'] else 'not installed'}")

    def _install_task(self) -> None:
        r = self.ctrl.install_service_task(5)
        self.task_status.setText("24/7 task: installed (drains every 5 min)" if r["ok"]
                                 else f"install failed: {r['output'][:120]}")

    def _remove_task(self) -> None:
        r = self.ctrl.remove_service_task()
        self.task_status.setText("24/7 task: removed" if r["ok"]
                                 else f"remove failed: {r['output'][:120]}")


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self, ctrl: AppController, start_worker: bool = True):
        super().__init__()
        self.ctrl = ctrl
        self.setWindowTitle(APP_NAME)
        self.setWindowIcon(_make_icon())
        self.resize(1000, 640)

        self.tabs = QtWidgets.QTabWidget()
        self.dashboard = DashboardTab(ctrl)
        self.section_a = SectionTab(ctrl, Section.PAID_CLIPPING)
        self.section_b = SectionTab(ctrl, Section.FACELESS_FUNNEL)
        self.section_c = SectionTab(ctrl, Section.AD_SHARE)
        self.review = ReviewTab(ctrl)
        self.profiles = ProfilesTab(ctrl)
        self.settings = SettingsTab(ctrl)
        self.tabs.addTab(self.dashboard, "Dashboard")
        self.tabs.addTab(self.section_a, SECTION_LABELS[Section.PAID_CLIPPING])
        self.tabs.addTab(self.section_b, SECTION_LABELS[Section.FACELESS_FUNNEL])
        self.tabs.addTab(self.section_c, SECTION_LABELS[Section.AD_SHARE])
        self.tabs.addTab(self.review, "⛔ Review / Approve")
        self.tabs.addTab(self.profiles, "📋 Templates")
        self.tabs.addTab(self.settings, "⚙ Settings")
        self.setCentralWidget(self.tabs)
        self.statusBar().showMessage("Ready · engine running in background")
        self.settings.refresh()    # load once (not on the periodic timer)
        self.profiles.refresh()

        # Settings deliberately excluded — periodic refresh would stomp edits in progress.
        self._refresh_views = [self.dashboard, self.section_a, self.section_b,
                               self.section_c, self.review]
        self.timer = QtCore.QTimer(self)
        self.timer.setInterval(2000)
        self.timer.timeout.connect(self.refresh_all)
        self.timer.start()
        self.refresh_all()

        self.worker: Optional[EngineWorker] = None
        if start_worker:
            self.worker = EngineWorker()
            self.worker.start()

        self._tray = QtWidgets.QSystemTrayIcon(_make_icon(), self)
        menu = QtWidgets.QMenu()
        menu.addAction("Show", self.showNormal)
        menu.addAction("Quit", self._quit)
        self._tray.setContextMenu(menu)
        self._tray.setToolTip(APP_NAME)
        self._tray.show()

    def refresh_all(self) -> None:
        for v in self._refresh_views:
            v.refresh()

    def _quit(self) -> None:
        if self.worker:
            self.worker.stop()
        QtWidgets.QApplication.quit()

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:  # noqa: N802
        if self.worker:
            self.worker.stop()
        super().closeEvent(event)


def build_controller() -> AppController:
    cfg.ensure_dirs()
    conn = connect(cfg.DB_PATH)
    return AppController(JobQueue(conn, cfg.Settings.load()))


def main() -> int:
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    win = MainWindow(build_controller())
    win.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
