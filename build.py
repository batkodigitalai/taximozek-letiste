#!/usr/bin/env python3
"""Vloží aktuální prilety.json jako záložní snímek do index.html."""
import json
snap = open("prilety.json", encoding="utf-8").read().replace("<", "\\u003c")
src = open("index.src.html", encoding="utf-8").read()
assert "__SNAPSHOT__" in src
open("index.html", "w", encoding="utf-8").write(src.replace("__SNAPSHOT__", snap))
print("index.html", len(src) + len(snap), "bytes")
