"""stdio MCP transport — newline-delimited JSON-RPC 2.0 over stdin/stdout.

This is the transport the **Claude Desktop app** speaks: it launches a command
and exchanges one JSON object per line. We reuse the same `handle_rpc` dispatcher
as the HTTP server, so the full ClipPilot tool surface (read/understand +
pipeline control) is available to Claude with zero extra code.

Register it in Claude Desktop's `claude_desktop_config.json` (see
docs/09-claude-app-connection.md):

    {
      "mcpServers": {
        "clippilot": {
          "command": "python",
          "args": ["-m", "clippilot.mcp_server"],
          "env": {"PYTHONPATH": "/Users/mayanksharma/Downloads/New_Projects/shorts-factory/ClipPilot/src"}
        }
      }
    }

No `mcp` SDK dependency — stdlib only, so it imports on Python 3.14.
"""
from __future__ import annotations

import json
import sys
from typing import Any, TextIO

from .server import handle_rpc

_BOM = "﻿"  # byte-order mark some shells/clients prepend to the stream


def _write(out: TextIO, obj: dict[str, Any]) -> None:
    out.write(json.dumps(obj) + "\n")
    out.flush()


def serve_stdio(stdin: TextIO | None = None, stdout: TextIO | None = None) -> None:
    """Read JSON-RPC requests line by line; write one response line each.

    Notifications (messages with no `id`, e.g. `notifications/initialized`) are
    processed but draw no response, per JSON-RPC / MCP. Blank lines are ignored.
    Returns when stdin reaches EOF (the client disconnected).
    """
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    for raw in stdin:
        # Strip a leading UTF-8 BOM (then whitespace) so the first line parses.
        line = raw.strip().lstrip(_BOM).strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except (ValueError, json.JSONDecodeError):
            _write(stdout, {"jsonrpc": "2.0", "id": None,
                            "error": {"code": -32700, "message": "parse error"}})
            continue
        is_notification = isinstance(payload, dict) and "id" not in payload
        try:
            response = handle_rpc(payload)
        except Exception as exc:  # noqa: BLE001 — one bad message must not kill the server
            _write(stdout, {"jsonrpc": "2.0", "id": None,
                            "error": {"code": -32603, "message": f"internal error: {exc}"}})
            continue
        if is_notification:
            continue  # JSON-RPC: never reply to a notification
        _write(stdout, response)


if __name__ == "__main__":
    serve_stdio()
