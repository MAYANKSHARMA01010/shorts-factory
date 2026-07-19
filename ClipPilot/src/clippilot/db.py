"""SQLite layer: connection helper + schema. Stdlib `sqlite3` only.

WAL mode + busy timeout so a future GUI thread and a background worker can share
the DB without locking each other out.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    section         TEXT    NOT NULL,
    source_ref      TEXT    NOT NULL,
    rights_tag      TEXT    NOT NULL,
    channel         TEXT,
    stage           TEXT    NOT NULL,
    status          TEXT    NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    idempotency_key TEXT    UNIQUE,
    content_hash    TEXT,
    payload         TEXT    NOT NULL DEFAULT '{}',
    error           TEXT,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_stage  ON jobs(stage);

CREATE TABLE IF NOT EXISTS channels (
    channel    TEXT PRIMARY KEY,
    platform   TEXT NOT NULL DEFAULT 'youtube',
    strikes    INTEGER NOT NULL DEFAULT 0,
    paused     INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id  INTEGER,
    ts      TEXT NOT NULL,
    kind    TEXT NOT NULL,
    detail  TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_job ON events(job_id);
"""


def connect(db_path: Path | str) -> sqlite3.Connection:
    """Open (and create) a connection with sane concurrency defaults."""
    db_path = str(db_path)
    if db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30, isolation_level=None)  # autocommit
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA busy_timeout=30000;")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
