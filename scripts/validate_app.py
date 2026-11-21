#!/usr/bin/env python3
"""Static quality gate for the Anwar notebook PWA. No third-party Python packages."""
from __future__ import annotations

import json
import re
import subprocess
import struct
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from html_inspector import inspect_html

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
APP_CORE = ROOT / "app-core.js"
FLOATING_PANELS = ROOT / "floating-panels.js"
FLOATING_PANELS_CSS = ROOT / "floating-panels.css"
PROTECTIVE_ADHKAR = ROOT / "protective-adhkar.js"
MANIFEST = ROOT / "manifest.webmanifest"
SERVICE_WORKER = ROOT / "service-worker.js"
errors: list[str] = []
warnings: list[str] = []


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
    for path in (INDEX, APP_CORE, FLOATING_PANELS, FLOATING_PANELS_CSS, PROTECTIVE_ADHKAR, MANIFEST, SERVICE_WORKER):
        if not path.is_file():
            fail(f"Required file is missing: {path.relative_to(ROOT)}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    html = INDEX.read_text(encoding="utf-8")
    app_core = APP_CORE.read_text(encoding="utf-8")
    audit = inspect_html(html)

    duplicates = sorted({item for item in audit["ids"] if audit["ids"].count(item) > 1})
    if duplicates:
        fail("Duplicate HTML IDs: " + ", ".join(duplicates))

    id_set = set(audit["ids"])
    missing = sorted({
        target for _, target in audit["references"] if target not in id_set
    })
    if missing:
        fail("ARIA/label references target missing IDs: " + ", ".join(missing))

    for href, rel in audit["blank_links"]:
        if "noopener" not in rel.lower().split():
            fail(f'target="_blank" link lacks rel="noopener": {href}')

    if audit["inline_handlers"]:
        fail("Inline HTML event handlers found: " + ", ".join(audit["inline_handlers"]))

    for resource in audit["local_resources"]:
        check_local_url(resource, "index.html")

    for source in audit["inline_scripts"]:
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

    check_js_syntax(app_core, "app-core.js")
    check_js_syntax(FLOATING_PANELS.read_text(encoding="utf-8"), "floating-panels.js")
    check_js_syntax(PROTECTIVE_ADHKAR.read_text(encoding="utf-8"), "protective-adhkar.js")

    sw_text = SERVICE_WORKER.read_text(encoding="utf-8")
    check_js_syntax(sw_text, "service-worker.js")
    assets_match = re.search(r"SHELL_ASSETS\s*=\s*\[(.*?)\]", sw_text, re.S)
    if not assets_match:
        fail("Service worker SHELL_ASSETS list was not found")
    else:
        for asset in re.findall(r"['\"](\.\/[^'\"]+)['\"]", assets_match.group(1)):
            check_local_url(asset, "service-worker.js")

    sw_assets = assets_match.group(1) if assets_match else ""
    if "'./floating-panels.js'" not in sw_assets or "'./floating-panels.css'" not in sw_assets:
        fail("Service worker does not precache floating panel assets")

    if "navigator.serviceWorker.register('./service-worker.js'" not in app_core:
        fail("Service worker registration is missing from app-core.js")
    if 'toolbar-back-navigation.js' not in sw_text:
        fail('Service worker shell does not precache the contextual back-navigation helper')

    if errors:
        print("QUALITY CHECK FAILED", file=sys.stderr)
        for issue in errors:
            print("ERROR: " + issue, file=sys.stderr)
        for warning in warnings:
            print("WARNING: " + warning, file=sys.stderr)
        return 1

    print("Static quality checks passed.")
    print(f"HTML IDs checked: {len(audit["ids"])}")
    print("Inline JavaScript and service-worker syntax: valid")
    print("Local HTML/manifest/service-worker resources: present")
    if warnings:
        for warning in warnings:
            print("WARNING: " + warning)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
