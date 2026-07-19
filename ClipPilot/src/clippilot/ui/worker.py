"""Background engine worker — drains the pipeline off the Qt thread.

Opens its OWN SQLite connection (sqlite objects aren't shareable across threads);
the GUI keeps a separate connection. WAL mode lets them run concurrently.
"""
from __future__ import annotations

import threading
from typing import Optional

from .. import config as cfg
from ..db import connect
from ..engine import Engine
from ..queue import JobQueue


class EngineWorker(threading.Thread):
    def __init__(self, db_path: Optional[str] = None, interval: float = 2.0):
        super().__init__(daemon=True, name="clippilot-engine")
        self.db_path = str(db_path or cfg.DB_PATH)
        self.interval = interval
        self._stop = threading.Event()

    def run(self) -> None:
        cfg.ensure_dirs()
        conn = connect(self.db_path)
        queue = JobQueue(conn, cfg.Settings.load())
        engine = Engine(queue)
        try:
            while not self._stop.is_set():
                try:
                    # Re-read settings each cycle so a GUI/MCP toggle (e.g.
                    # auto_approve) takes effect on the very next drain.
                    queue.settings = cfg.Settings.load(cfg.settings_path())
                    engine.drain(max_steps=50)
                except Exception:  # noqa: BLE001 — never let the worker thread die
                    pass
                self._stop.wait(self.interval)
        finally:
            conn.close()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        if self.is_alive():
            self.join(timeout=timeout)
