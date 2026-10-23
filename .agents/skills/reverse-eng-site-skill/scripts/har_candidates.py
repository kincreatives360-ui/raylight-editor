#!/usr/bin/env python3
"""Rank likely internal API requests from a HAR without printing secret values."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

SENSITIVE = {
    "access_token",
    "api_key",
    "apikey",
    "auth",
    "authorization",
    "code",
    "cookie",
    "csrf",
    "jwt",
    "key",
    "password",
    "refresh_token",
    "session",
    "sid",
    "signature",
    "token",
    "x-csrf-token",
    "x-xsrf-token",
}

STATIC_EXTENSIONS = {
    ".avif", ".css", ".gif", ".ico", ".jpeg", ".jpg", ".js", ".map",
    ".mp3", ".mp4", ".png", ".svg", ".ttf", ".webm", ".webp", ".woff",
    ".woff2",
}


def sensitive_name(name: str) -> bool:
    lowered = name.lower()
    return lowered in SENSITIVE or any(
        piece in lowered
        for piece in ("auth", "csrf", "token", "cookie", "password", "secret", "signature")
    )


def redact_url(url: str, *, show_params: bool = False) -> str:
    parts = urlsplit(url)
    query = [
        (key, value if show_params and not sensitive_name(key) else "<redacted>")
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query, safe="<>"), ""))


def header_map(headers: list[dict[str, Any]] | None) -> dict[str, str]:
    return {
        str(item.get("name", "")).lower(): str(item.get("value", ""))
        for item in headers or []
        if item.get("name")
    }


def response_shape(entry: dict[str, Any]) -> str:
    content = entry.get("response", {}).get("content", {})
    text = content.get("text")
    if not isinstance(text, str) or len(text) > 2_000_000:
        return "unknown"
    try:
        value = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return "unknown"
    if isinstance(value, list):
        return f"list[{len(value)}]"
    if isinstance(value, dict):
        keys = sorted(map(str, value.keys()))[:12]
        return "object{" + ",".join(keys) + (",..." if len(value) > 12 else "") + "}"
    return type(value).__name__


def rank_entry(
    entry: dict[str, Any], index: int, *, show_params: bool = False
) -> dict[str, Any]:
    request = entry.get("request", {})
    response = entry.get("response", {})
    url = str(request.get("url", ""))
    method = str(request.get("method", "GET")).upper()
    request_headers = header_map(request.get("headers"))
    response_headers = header_map(response.get("headers"))
    mime = str(response.get("content", {}).get("mimeType") or response_headers.get("content-type", "")).lower()
    resource_type = str(entry.get("_resourceType", "")).lower()
    path = urlsplit(url).path.lower()
    score = 0
    reasons: list[str] = []

    if "json" in mime or "graphql" in mime:
        score += 5
        reasons.append("structured response")
    if resource_type in {"fetch", "xhr"}:
        score += 4
        reasons.append(resource_type)
    if any(marker in path for marker in ("/api", "/graphql", "/rpc", "/trpc", "/query")):
        score += 3
        reasons.append("API-like path")
    if method in {"POST", "PUT", "PATCH", "DELETE"}:
        score += 2
        reasons.append("state-capable method")
    if request.get("postData"):
        score += 1
        reasons.append("request body")
    if Path(path).suffix in STATIC_EXTENSIONS or mime.startswith(("image/", "font/", "text/css", "audio/", "video/")):
        score -= 8
        reasons.append("static asset")

    auth_signals = sorted(
        name for name in request_headers if sensitive_name(name)
    )
    if request.get("cookies"):
        auth_signals.append("cookie-jar")

    return {
        "index": index,
        "score": score,
        "method": method,
        "url": redact_url(url, show_params=show_params),
        "status": response.get("status"),
        "resource_type": resource_type or "unknown",
        "mime_type": mime or "unknown",
        "response_size": response.get("content", {}).get("size") or response.get("bodySize"),
        "response_shape": response_shape(entry),
        "auth_signals": sorted(set(auth_signals)),
        "reasons": reasons,
    }


def load_entries(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        entries = payload["log"]["entries"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ValueError(f"invalid HAR: {exc}") from exc
    if not isinstance(entries, list):
        raise ValueError("invalid HAR: log.entries must be a list")
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("har", type=Path)
    parser.add_argument("--min-score", type=int, default=1)
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a compact table")
    parser.add_argument(
        "--show-params",
        action="store_true",
        help="show non-sensitive query values; auth-like values remain redacted",
    )
    args = parser.parse_args()

    try:
        ranked = [
            rank_entry(entry, index, show_params=args.show_params)
            for index, entry in enumerate(load_entries(args.har))
        ]
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    ranked = sorted((item for item in ranked if item["score"] >= args.min_score), key=lambda item: (-item["score"], item["index"]))

    if args.json:
        print(json.dumps(ranked, indent=2))
        return 0

    print("score\tmethod\tstatus\tshape\tauth signals\turl")
    for item in ranked:
        print(
            f'{item["score"]}\t{item["method"]}\t{item["status"]}\t'
            f'{item["response_shape"]}\t{",".join(item["auth_signals"])}\t{item["url"]}'
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
