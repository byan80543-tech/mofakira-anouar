#!/usr/bin/env python3
"""Static quality gate for the Anwar notebook PWA. No third-party Python packages."""
from __future__ import annotations

import json
import re
import subprocess
import struct
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
MANIFEST = ROOT / "manifest.webmanifest"
SERVICE_WORKER = ROOT / "service-worker.js"
errors: list[str] = []
warnings: list[str] = []


class PageAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.references: list[tuple[str, str]] = []
        self.local_resources: list[str] = []
        self.blank_links: list[tuple[str, str]] = []
        self.inline_handlers: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.ids.append(element_id)

        for key in ("aria-controls", "aria-labelledby", "aria-describedby", "for", "headers"):
            value = values.get(key)
            if value:
                self.references.extend((key, part) for part in value.split())

        if tag.lower() == "a" and (values.get("target") or "").lower() == "_blank":
            self.blank_links.append((values.get("href") or "", values.get("rel") or ""))

        for key, value in attrs:
            if key.lower().startswith("on"):
                self.inline_handlers.append(key)
            if key.lower() in ("src", "href") and value:
                self.local_resources.append(value)


def fail(message: str) -> None:
    errors.append(message)


def check_local_url(value: str, owner: str) -> None:
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith(("#", "//")):
        return
    path = parsed.path
    if not path:
        return
    candidate = (ROOT / path.lstrip("/")).resolve()
    if not candidate.is_file():
        fail(f"{owner}: local resource is missing: {value}")


def check_js_syntax(source: str, label: str) -> None:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".js") as temp:
        temp.write(source)
        temp.flush()
        result = subprocess.run(
            ["node", "--check", temp.name],
            text=True,
            capture_output=True,
            check=False,
        )
    if result.returncode:
        fail(f"{label}: JavaScript syntax check failed: {result.stderr.strip()}")


def png_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        with path.open("rb") as image_file:
            header = image_file.read(24)
        if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
            return None
        return struct.unpack(">II", header[16:24])
    except OSError:
        return None


def main() -> int:
    for path in (INDEX, MANIFEST, SERVICE_WORKER):
        if not path.is_file():
            fail(f"Required file is missing: {path.relative_to(ROOT)}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    html = INDEX.read_text(encoding="utf-8")
    parser = PageAudit()
    parser.feed(html)
    parser.close()

    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        fail("Duplicate HTML IDs: " + ", ".join(duplicates))

    id_set = set(parser.ids)
    missing = sorted({
        target for _, target in parser.references if target not in id_set
    })
    if missing:
        fail("ARIA/label references target missing IDs: " + ", ".join(missing))

    for href, rel in parser.blank_links:
        if "noopener" not in rel.lower().split():
            fail(f'target="_blank" link lacks rel="noopener": {href}')

    if parser.inline_handlers:
        fail("Inline HTML event handlers found: " + ", ".join(parser.inline_handlers))

    for resource in parser.local_resources:
        check_local_url(resource, "index.html")

    for element in re.finditer(r"<script\b([^>]*)>([\s\S]*?)</script\s*>", html, re.I):
        attributes, source = element.group(1), element.group(2)
        if re.search(r"\bsrc\s*=", attributes, re.I):
            continue
        if source.strip():
            check_js_syntax(source, "inline script")

    if re.search(r"\beval\s*\(|new\s+Function\s*\(", html):
        fail("Dynamic code execution pattern (eval/new Function) detected")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for field in ("name", "short_name", "start_url", "scope", "icons"):
        if field not in manifest:
            fail(f"Web manifest is missing required field: {field}")

    for icon in manifest.get("icons", []):
        source = icon.get("src", "")
        if source:
            check_local_url(source, "manifest icon")

    icons = manifest.get("icons", [])
    sizes = {
        size
        for icon in icons
        for size in str(icon.get("sizes", "")).split()
    }
    missing_icon_sizes = {"192x192", "512x512"} - sizes
    if missing_icon_sizes:
        fail(
            "PWA manifest is missing required Chromium icon sizes: "
            + ", ".join(sorted(missing_icon_sizes))
        )

    for icon in icons:
        source = icon.get("src", "")
        if icon.get("type") != "image/png" or not source:
            continue
        image_path = (ROOT / urlsplit(source).path.lstrip("/")).resolve()
        declared_png_sizes = [
            tuple(map(int, match.groups()))
            for size in str(icon.get("sizes", "")).split()
            if (match := re.fullmatch(r"(\d+)x(\d+)", size))
        ]
        actual_dimensions = png_dimensions(image_path) if image_path.is_file() else None
        for expected_dimensions in declared_png_sizes:
            if actual_dimensions != expected_dimensions:
                fail(
                    f"Manifest icon dimensions do not match {source}: "
                    f"declared {expected_dimensions}, actual {actual_dimensions}"
                )

    sw_text = SERVICE_WORKER.read_text(encoding="utf-8")
    check_js_syntax(sw_text, "service-worker.js")
    assets_match = re.search(r"SHELL_ASSETS\s*=\s*\[(.*?)\]", sw_text, re.S)
    if not assets_match:
        fail("Service worker SHELL_ASSETS list was not found")
    else:
        for asset in re.findall(r"['\"](\.\/[^'\"]+)['\"]", assets_match.group(1)):
            check_local_url(asset, "service-worker.js")

    if "navigator.serviceWorker.register('./service-worker.js'" not in html:
        fail("Service worker registration is missing from index.html")

    if errors:
        print("QUALITY CHECK FAILED", file=sys.stderr)
        for issue in errors:
            print("ERROR: " + issue, file=sys.stderr)
        for warning in warnings:
            print("WARNING: " + warning, file=sys.stderr)
        return 1

    print("Static quality checks passed.")
    print(f"HTML IDs checked: {len(parser.ids)}")
    print("Inline JavaScript and service-worker syntax: valid")
    print("Local HTML/manifest/service-worker resources: present")
    if warnings:
        for warning in warnings:
            print("WARNING: " + warning)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
