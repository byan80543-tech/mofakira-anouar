#!/usr/bin/env python3
"""Regression tests for the shared HTMLParser-based static inspector."""

from html_inspector import inspect_html


sample = """<!doctype html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="preload" as="script" href="/app.js">
<script src="/app.js"></script>
</head>
<body>
<label for="note">ملاحظة</label>
<textarea id="note"></textarea>
<a href="/download" target="_blank" rel="noopener noreferrer">تنزيل</a>
<button id="unsafe" onclick="run()">غير آمن</button>
<script>window.inlineExample = true;</script>
</body>
</html>
"""

result = inspect_html(sample)
assert result["ids"] == ["note", "unsafe"]
assert result["references"] == [("for", "note")]
assert result["blank_links"] == [("/download", "noopener noreferrer")]
assert result["inline_handlers"] == ["onclick"]
assert result["csp_meta"] == "default-src 'none'"
assert result["referrer_meta"] == "strict-origin-when-cross-origin"
assert result["script_sources"] == ["/app.js"]
assert result["preload_scripts"] == ["/app.js"]
assert result["inline_scripts"] == ["window.inlineExample = true;"]

print("HTML inspector tests passed: IDs, attributes, CSP, resources and inline scripts.")
