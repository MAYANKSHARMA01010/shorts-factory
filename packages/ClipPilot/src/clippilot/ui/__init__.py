"""Native Windows GUI (PySide6) — the desktop shell over the engine.

- controller.py : Qt-free facade over the SQLite JobQueue (testable headless).
- worker.py     : background thread that drains the engine (own DB connection;
                  never touches the Qt thread).
- app.py        : the PySide6 window — 3 section tabs (A/B/C), a dashboard, and
                  the approval-gate review screen.

Launch:  python -m clippilot.ui
"""
