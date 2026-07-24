"""`python -m clippilot.mcp_server` — launch the MCP server.

Default transport is **stdio** (what the Claude Desktop app launches). Pass
`--http [host] [port]` to run the loopback HTTP server instead (for the in-app
brain / local debugging).

    python -m clippilot.mcp_server            # stdio (for Claude Desktop)
    python -m clippilot.mcp_server --http     # HTTP on 127.0.0.1:19789
"""
from __future__ import annotations

import sys


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv and argv[0] == "--http":
        from .server import serve
        host = argv[1] if len(argv) > 1 else "127.0.0.1"
        port = int(argv[2]) if len(argv) > 2 else 19789
        serve(host, port)
        return 0
    from .stdio import serve_stdio
    serve_stdio()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
