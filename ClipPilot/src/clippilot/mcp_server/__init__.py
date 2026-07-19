"""ClipPilot's MCP server — the tool surface Claude drives.

Two transports over one JSON-RPC dispatcher (`handle_rpc`):
  • stdio (`stdio.serve_stdio`) — what the Claude Desktop app launches
    (`python -m clippilot.mcp_server`). See docs/09-claude-app-connection.md.
  • HTTP on 127.0.0.1 (`serve`) — for the in-app brain / local clients.

Tools: read/understand (probe, extract_signals, understand_meta,
understand_video) + pipeline control (enqueue, list_jobs, job_detail,
job_counts, run_engine, approve, reject, requeue, record_strike). Stdlib-only —
no `mcp` SDK dependency, so it imports on Python 3.14.
"""
from .server import TOOLS, handle_rpc, make_server, serve, serve_in_thread
from .stdio import serve_stdio

__all__ = ["TOOLS", "handle_rpc", "make_server", "serve", "serve_in_thread", "serve_stdio"]
