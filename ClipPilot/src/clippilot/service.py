"""Unattended service runner — drains the pipeline on an interval so jobs flow
24/7 *without the GUI open*. This is the "100% automation" engine room:

  • `run_cycle()`   — one drain pass against the real (CLIPPILOT_DATA-aware) store.
  • `run_service()` — loop `run_cycle` every `interval` s until stopped.
  • Windows Task Scheduler install — register a `schtasks` MINUTE task that calls
    `python -m clippilot.service --once` each tick, so Windows keeps the pipeline
    moving even across reboots.

Jobs only auto-publish when the operator has enabled `auto_approve` (per docs/09
§5 — graduated per-lane trust); otherwise they pile up at the approval gate for a
human/Claude to clear. The service just turns the crank; the guardrails decide.

    python -m clippilot.service                 # loop forever (default 10s)
    python -m clippilot.service --interval 30   # loop every 30s
    python -m clippilot.service --once          # one cycle (what the task calls)
    python -m clippilot.service --install --every 5   # register a 5-min Win task
    python -m clippilot.service --uninstall
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import threading
from typing import Any, Callable, Optional

from . import config as cfg

TASK_NAME = "ClipPilot"


# ── core loop ────────────────────────────────────────────────────────────────
def run_cycle(max_steps: int = 50) -> dict[str, Any]:
    """One drain pass. Opens + closes its own connection (env-aware paths) and
    re-reads settings each call, so an `auto_approve` toggle takes effect on the
    very next cycle. Never raises — returns an `error` field instead."""
    from .db import connect
    from .engine import Engine
    from .models import JobStatus
    from .queue import JobQueue

    try:
        conn = connect(cfg.db_path())
    except Exception as exc:  # noqa: BLE001
        return {"steps": 0, "error": f"{type(exc).__name__}: {exc}"}
    try:
        q = JobQueue(conn, cfg.Settings.load(cfg.settings_path()))
        steps = Engine(q).drain(max_steps=max_steps)
        return {
            "steps": steps,
            "counts": q.counts(),
            "awaiting_approval": [j.id for j in q.list(JobStatus.BLOCKED_APPROVAL)],
            "needs_attention": [j.id for j in q.list(JobStatus.NEEDS_ATTENTION)],
        }
    except Exception as exc:  # noqa: BLE001 — a bad cycle must not kill the service
        return {"steps": 0, "error": f"{type(exc).__name__}: {exc}"}
    finally:
        conn.close()


def run_service(interval: float = 10.0, max_cycles: Optional[int] = None,
                stop_event: Optional[threading.Event] = None,
                on_cycle: Optional[Callable[[dict[str, Any]], None]] = None) -> int:
    """Drain every `interval` seconds until `stop_event` is set or `max_cycles`
    cycles have run. Returns the number of cycles executed."""
    stop_event = stop_event or threading.Event()
    cycles = 0
    while not stop_event.is_set():
        result = run_cycle()
        cycles += 1
        if on_cycle is not None:
            on_cycle(result)
        if max_cycles is not None and cycles >= max_cycles:
            break
        stop_event.wait(interval)
    return cycles


# ── Windows Task Scheduler integration ───────────────────────────────────────
def service_bat_path():
    return cfg.PROJECT_ROOT / "service_tick.bat"


def write_service_bat(python_exe: Optional[str] = None, pythonpath: Optional[str] = None,
                      data_dir: Optional[str] = None) -> str:
    """Write the wrapper .bat the scheduled task runs (sets PYTHONPATH/data dir,
    then one drain cycle). Returns its path."""
    python_exe = python_exe or sys.executable
    src = pythonpath or str(cfg.SRC_DIR)
    lines = ["@echo off", f'set "PYTHONPATH={src}"']
    if data_dir:
        lines.append(f'set "CLIPPILOT_DATA={data_dir}"')
    lines.append(f'"{python_exe}" -m clippilot.service --once')
    path = service_bat_path()
    path.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
    return str(path)


def build_install_command(task_name: str = TASK_NAME, every_minutes: int = 5,
                          bat_path: Optional[str] = None) -> list[str]:
    """The `schtasks` argv that registers a per-minute drain task (no side effects
    — `install_task` runs it). /F overwrites an existing task of the same name."""
    bat_path = bat_path or str(service_bat_path())
    # Pass the bare path — subprocess.run quotes argv elements itself; pre-quoting
    # would be double-escaped by list2cmdline and corrupt the registered task.
    return ["schtasks", "/Create", "/TN", task_name, "/SC", "MINUTE",
            "/MO", str(every_minutes), "/TR", bat_path, "/F"]


def build_uninstall_command(task_name: str = TASK_NAME) -> list[str]:
    return ["schtasks", "/Delete", "/TN", task_name, "/F"]


def build_status_command(task_name: str = TASK_NAME) -> list[str]:
    return ["schtasks", "/Query", "/TN", task_name]


def task_installed(task_name: str = TASK_NAME) -> bool:
    """True if the scheduled task exists (schtasks /Query returns 0)."""
    try:
        return subprocess.run(build_status_command(task_name),
                              capture_output=True, text=True).returncode == 0
    except OSError:
        return False


def install_task(every_minutes: int = 5, data_dir: Optional[str] = None) -> subprocess.CompletedProcess:
    """Write the wrapper .bat and register the Windows scheduled task."""
    write_service_bat(data_dir=data_dir)
    return subprocess.run(build_install_command(every_minutes=every_minutes),
                          capture_output=True, text=True)


def uninstall_task() -> subprocess.CompletedProcess:
    return subprocess.run(build_uninstall_command(), capture_output=True, text=True)


# ── CLI ──────────────────────────────────────────────────────────────────────
def main(argv: Optional[list[str]] = None) -> int:
    p = argparse.ArgumentParser(prog="clippilot.service", description="ClipPilot unattended drain service")
    p.add_argument("--once", action="store_true", help="run a single drain cycle and exit")
    p.add_argument("--interval", type=float, default=10.0, help="seconds between cycles (loop mode)")
    p.add_argument("--install", action="store_true", help="register a Windows scheduled task")
    p.add_argument("--uninstall", action="store_true", help="remove the Windows scheduled task")
    p.add_argument("--every", type=int, default=5, help="scheduled-task interval in minutes (with --install)")
    a = p.parse_args(argv)

    if a.install:
        import os
        # Forward the operator's data store so the scheduled task drains the SAME
        # store, not the default (the Windows task gets its own environment).
        r = install_task(every_minutes=a.every, data_dir=os.environ.get("CLIPPILOT_DATA"))
        print((r.stdout or "") + (r.stderr or ""))
        return r.returncode
    if a.uninstall:
        r = uninstall_task()
        print((r.stdout or "") + (r.stderr or ""))
        return r.returncode
    if a.once:
        print(json.dumps(run_cycle()))
        return 0

    print(f"ClipPilot service draining every {a.interval}s (Ctrl-C to stop)…")
    try:
        run_service(interval=a.interval, on_cycle=lambda r: print(json.dumps(r)))
    except KeyboardInterrupt:
        print("stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
