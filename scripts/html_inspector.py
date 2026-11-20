#!/usr/bin/env python3
"""Parse static HTML structure with Python's standards-based HTMLParser."""

from __future__ import annotations

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


class HtmlInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.references: list[tuple[str, str]] = []
        self.local_resources: list[str] = []
        self.blank_links: list[tuple[str, str]] = []
        self.inline_handlers: list[str] = []
        self.inline_scripts: list[str] = []
        self.csp_meta: str | None = None
        self.referrer_meta: str | None = None
        self.script_sources: list[str] = []
        self.preload_scripts: list[str] = []
        self.elements: list[dict[str, Any]] = []
        self._inside_inline_script = False
        self._script_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        values = {key.lower(): value for key, value in attrs}
        self.elements.append({"tag": tag, "attrs": values})
        element_id = values.get("id")
        if element_id:
            self.ids.append(element_id)

        for key in ("aria-controls", "aria-labelledby", "aria-describedby", "for", "headers"):
            value = values.get(key)
            if value:
                self.references.extend((key, part) for part in value.split())

        if tag == "a" and (values.get("target") or "").lower() == "_blank":
            self.blank_links.append((values.get("href") or "", values.get("rel") or ""))

        for key, value in attrs:
            key = key.lower()
            if key.startswith("on"):
                self.inline_handlers.append(key)
            if key in ("src", "href") and value:
                self.local_resources.append(value)

        if tag == "meta":
            http_equiv = (values.get("http-equiv") or "").strip().lower()
            if http_equiv == "content-security-policy" and values.get("content") is not None:
                self.csp_meta = values["content"]
            if (values.get("name") or "").strip().lower() == "referrer":
                self.referrer_meta = values.get("content")

        if tag == "link":
            rel = set((values.get("rel") or "").lower().split())
            if "preload" in rel and (values.get("as") or "").lower() == "script" and values.get("href"):
                self.preload_scripts.append(values["href"])

        if tag == "script":
            if values.get("src"):
                self.script_sources.append(values["src"])
            self._inside_inline_script = "src" not in values
            self._script_parts = []

    def handle_data(self, data: str) -> None:
        if self._inside_inline_script:
            self._script_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script":
            if self._inside_inline_script:
                self.inline_scripts.append("".join(self._script_parts))
            self._inside_inline_script = False
            self._script_parts = []

    def result(self) -> dict[str, Any]:
        return {
            "ids": self.ids,
            "references": self.references,
            "local_resources": self.local_resources,
            "blank_links": self.blank_links,
            "inline_handlers": self.inline_handlers,
            "inline_scripts": self.inline_scripts,
            "csp_meta": self.csp_meta,
            "referrer_meta": self.referrer_meta,
            "script_sources": self.script_sources,
            "preload_scripts": self.preload_scripts,
            "elements": self.elements,
        }


def inspect_html(source: str) -> dict[str, Any]:
    parser = HtmlInspector()
    parser.feed(source)
    parser.close()
    return parser.result()


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: html_inspector.py PATH", file=sys.stderr)
        return 2
    source = Path(sys.argv[1]).read_text(encoding="utf-8")
    print(json.dumps(inspect_html(source), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
