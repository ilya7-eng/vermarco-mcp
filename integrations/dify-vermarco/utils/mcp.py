"""Minimal JSON-RPC client for the Vermarco remote MCP server (Streamable HTTP)."""

from __future__ import annotations

import json
import time
from typing import Any

import requests

VERMARCO_MCP_URL = "https://vermarco.com/api/mcp"
USER_AGENT = "dify-plugin-vermarco/0.0.1"


class VermarcoError(Exception):
    pass


def _parse_envelope(resp: requests.Response) -> dict[str, Any]:
    text = resp.text.strip()
    if text.startswith("{"):
        return json.loads(text)
    # Single-event SSE answer: take the last JSON data line.
    data_lines = [ln[5:].strip() for ln in text.splitlines() if ln.startswith("data:")]
    for line in reversed(data_lines):
        if line.startswith("{"):
            return json.loads(line)
    raise VermarcoError(f"Unexpected response from Vermarco (HTTP {resp.status_code})")


def _parse_result(result: dict[str, Any]) -> dict[str, Any]:
    if isinstance(result.get("structuredContent"), dict):
        return result["structuredContent"]
    texts = [c.get("text", "") for c in result.get("content", []) if c.get("type") == "text"]
    if len(texts) == 1:
        try:
            parsed = json.loads(texts[0])
            return parsed if isinstance(parsed, dict) else {"result": parsed}
        except ValueError:
            return {"text": texts[0]}
    return {"content": result.get("content", [])}


def call_tool(name: str, arguments: dict[str, Any], api_key: str | None = None, timeout: int = 60) -> dict[str, Any]:
    """Call one Vermarco MCP tool with JSON-RPC tools/call. The key goes only in the Authorization header."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "User-Agent": USER_AGENT,
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "jsonrpc": "2.0",
        "id": int(time.time() * 1000),
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    resp = requests.post(VERMARCO_MCP_URL, json=payload, headers=headers, timeout=timeout)
    if resp.status_code >= 400 and not resp.text.strip().startswith(("{", "event:", "data:")):
        raise VermarcoError(f"Vermarco HTTP {resp.status_code}: {resp.text[:200]}")
    envelope = _parse_envelope(resp)
    if envelope.get("error"):
        err = envelope["error"]
        raise VermarcoError(f"Vermarco MCP error {err.get('code')}: {err.get('message')}")
    result = envelope.get("result") or {}
    output = _parse_result(result)
    # Some tools report failures as {"error": ...} without setting isError.
    if result.get("isError") or isinstance(output.get("error"), str):
        message = output.get("error") if isinstance(output.get("error"), str) else json.dumps(output)[:500]
        if "AUTH_REQUIRED" in message or "API key" in message:
            message += " (add your Vermarco agent API key in the plugin authorization settings)"
        raise VermarcoError(f"Vermarco tool {name} failed: {message}")
    return output


def tools_list(api_key: str | None = None, timeout: int = 30) -> list[dict[str, Any]]:
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream", "User-Agent": USER_AGENT}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    resp = requests.post(VERMARCO_MCP_URL, json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, headers=headers, timeout=timeout)
    return _parse_envelope(resp).get("result", {}).get("tools", [])
