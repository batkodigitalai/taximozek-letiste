#!/usr/bin/env python3
"""Stáhne příletovou tabuli Letiště Praha (api.prg.aero) na dnešek a zítřek
a uloží ji zmenšenou do prilety.json pro aplikaci TaxiMozek Letiště.
Bez jakýchkoli zvláštních hlaviček – jen veřejné JSON API."""
import json, sys, urllib.request, datetime as dt
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Prague")
now = dt.datetime.now(TZ)
frm = now.strftime("%d-%m-%Y_00-00")
out, off = [], 0
while True:
    url = f"https://api.prg.aero/arrivals-shorttime?offset={off}&limit=200&from={frm}"
    with urllib.request.urlopen(url, timeout=30) as r:
        batch = json.load(r)
    if not batch:
        break
    out += batch
    off += len(batch)
    if off >= 600:
        break

KEEP = ["time", "time-new", "flyNumber", "destination", "destination-id",
        "state", "state_id", "state-color", "terminal", "company", "company-id", "isMainFlight"]
rows = [{k: x.get(k) for k in KEEP} for x in out if x.get("isMainFlight")]
data = {"generated": now.isoformat(timespec="seconds"), "source": "api.prg.aero", "count": len(rows), "flights": rows}
path = sys.argv[1] if len(sys.argv) > 1 else "prilety.json"
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(path, len(rows), "letů, vygenerováno", data["generated"])
