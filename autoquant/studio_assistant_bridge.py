"""Private stdio MCP adapter; credentials stay in the provider CLI."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

TOOL = {
    "name": "aq",
    "description": "Use a governed AutoQuant operation. Start with catalog.",
    "inputSchema": {
        "type": "object", "required": ["operation", "params"],
        "additionalProperties": False,
        "properties": {
            "operation": {"type": "string"},
            "params": {"type": "object"},
        },
    },
}


def dispatch(request: dict) -> dict | None:
    identity = request.get("id")
    method = request.get("method")
    if identity is None:
        return None
    result = {}
    if method == "initialize":
        result = {"protocolVersion": "2024-11-05",
                  "capabilities": {"tools": {}},
                  "serverInfo": {"name": "autoquant-aq", "version": "1"}}
    elif method == "tools/list":
        result = {"tools": [TOOL]}
    elif method == "tools/call":
        params = request.get("params") or {}
        if params.get("name") != "aq":
            result = {"isError": True, "content": [
                {"type": "text", "text": "Unknown tool"}]}
        else:
            body = json.dumps({
                "sessionId": os.environ["AQ_ASSISTANT_SESSION"],
                "bridgeToken": os.environ["AQ_ASSISTANT_BRIDGE_TOKEN"],
                "arguments": params.get("arguments"),
            }).encode()
            call = urllib.request.Request(
                os.environ["AQ_STUDIO_URL"] + "/api/v1/assistant/tool",
                data=body, headers={
                    "Content-Type": "application/json",
                    "X-Studio-Token": os.environ["AQ_STUDIO_TOKEN"],
                    "Origin": os.environ["AQ_STUDIO_URL"],
                })
            try:
                with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(call, timeout=960) as response:
                    payload = json.load(response)
                result = {"isError": payload.get("ok") is not True,
                          "content": [{"type": "text", "text":
                                       json.dumps(payload, ensure_ascii=False)}]}
            except urllib.error.HTTPError as error:
                # Return the bounded public error, never request headers/env.
                result = {"isError": True, "content": [{
                    "type": "text", "text": error.read(16384).decode(
                        "utf-8", "replace")}]}
            except Exception:
                result = {"isError": True, "content": [{
                    "type": "text", "text": "Studio bridge is unavailable"}]}
    elif method != "ping":
        return {"jsonrpc": "2.0", "id": identity,
                "error": {"code": -32601, "message": "Unknown method"}}
    return {"jsonrpc": "2.0", "id": identity, "result": result}


def main() -> int:
    for line in sys.stdin:
        if len(line) > 1024 * 1024:
            return 2
        try:
            response = dispatch(json.loads(line))
            if response is not None:
                print(json.dumps(response, ensure_ascii=False), flush=True)
        except (ValueError, TypeError):
            print(json.dumps({"jsonrpc": "2.0", "id": None,
                              "error": {"code": -32700,
                                        "message": "Invalid JSON"}}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
