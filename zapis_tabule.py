#!/usr/bin/env python3
"""Denní záznam příletové tabule Letiště Praha do Google tabulky: PLÁN vs. SKUTEČNOST.
Nahrazuje dvě plánované úlohy v Claude („Přílety PRG – denní záznam“ v :15 a v :45),
aby záznam nestál žádné tokeny. Spouští ho GitHub Action zapis-tabule.yml.

Stejné rozložení jako dřív:
- list „Přílety RRRR-MM-DD den“: A1 nadpis, A3:H lety, K3:T27 hodinový přehled, K28:T28 součty
- list „Denní souhrn“: jeden řádek za den (přepíše se, když už existuje)
Ve 00:xx počítá ještě předchozí den (finální stav).

Potřebuje proměnné prostředí:
  GOOGLE_SA_JSON  – celý JSON klíč servisního účtu Google (GitHub Secret)
  SHEET_ID        – ID tabulky (výchozí = tabulka měření TaxiMozek)
"""
import json, os, sys, time, urllib.request, datetime as d
from zoneinfo import ZoneInfo

import gspread
from google.oauth2.service_account import Credentials

SHEET_ID = os.environ.get("SHEET_ID", "1EelHNtT4NYPNuNIq-mUTP6-r0qWU00zbiFlNnpqxiBQ")
Z = ZoneInfo("Europe/Prague")
DNY = ["po", "út", "st", "čt", "pá", "so", "ne"]


def stahni(datum):
    url = f"https://api.prg.aero/arrivals-shorttime?offset=0&limit=300&from={datum}_00-00"
    req = urllib.request.Request(url, headers={"Origin": "https://www.prg.aero"})
    for pokus in range(2):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            print("API letiště neodpovídá:", e)
            if pokus == 0:
                time.sleep(60)
    sys.exit("tabule nedostupná – nic nezapisuji")


def main():
    now = d.datetime.now(Z)
    ref = now if now.hour > 0 else now - d.timedelta(days=1)
    day = ref.date()
    dn = DNY[day.weekday()]
    surova = stahni(ref.strftime("%d-%m-%Y"))

    p = lambda s: d.datetime.strptime(s, "%Y-%m-%dT%H:%M:%S%z").astimezone(Z)
    fl = []
    for x in surova:
        if not x.get("isMainFlight"):
            continue
        t = p(x["time"])
        e = p(x["time-new"]) if x.get("time-new") else t
        if t.date() != day:
            continue
        fl.append(dict(f=x["flyNumber"], o=x["destination"], T=x["terminal"], t=t, e=e,
                       s=x.get("state") or "", c=x.get("company", "")))
    fl.sort(key=lambda r: r["t"])

    rows = [["Let", "Odkud", "Aerolinka", "Terminál", "PLÁN (HH:MM)", "SKUTEČNOST/OČEKÁVÁNO (HH:MM)",
             "Rozdíl min (skut.−plán)", "Stav na tabuli"]]
    for r in fl:
        rows.append([r["f"], r["o"], r["c"], r["T"], r["t"].strftime("%H:%M"), r["e"].strftime("%H:%M"),
                     int(round((r["e"] - r["t"]).total_seconds() / 60)), r["s"]])

    hours = [["Hodina", "PLÁN T1", "PLÁN T2", "PLÁN celkem", "SKUT. T1", "SKUT. T2", "SKUT. celkem",
              "ROZDÍL T1", "ROZDÍL T2", "ROZDÍL celkem"]]
    for h in range(24):
        pl, ac = [0, 0], [0, 0]
        for r in fl:
            i = 0 if r["T"] == "T1" else 1
            if r["t"].hour == h:
                pl[i] += 1
            if r["e"].hour == h and r["e"].date() == day:
                ac[i] += 1
        hours.append([f"{h:02d}:00–{h:02d}:59", pl[0], pl[1], sum(pl), ac[0], ac[1], sum(ac),
                      ac[0] - pl[0], ac[1] - pl[1], sum(ac) - sum(pl)])

    n = len(fl)
    dl = [(r["e"] - r["t"]).total_seconds() / 60 for r in fl]
    summary = [day.isoformat(), dn, now.strftime("%H:%M"), n,
               sum(1 for r in fl if r["T"] == "T1"), sum(1 for r in fl if r["T"] == "T2"),
               sum(1 for r in fl if r["s"].startswith("Přistálo")), sum(1 for x in dl if x >= 15),
               round(sum(dl) / n, 1) if n else 0, max(dl) if dl else 0]

    creds = Credentials.from_service_account_info(
        json.loads(os.environ["GOOGLE_SA_JSON"]),
        scopes=["https://www.googleapis.com/auth/spreadsheets"])
    sh = gspread.authorize(creds).open_by_key(SHEET_ID)

    nazev = f"Přílety {day.isoformat()} {dn}"
    try:
        ws = sh.worksheet(nazev)
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=nazev, rows=400, cols=22)
        ws.freeze(rows=3)

    ws.batch_update([
        {"range": "A1", "values": [[f"Přílety PRG {day.isoformat()} {dn} – PLÁN vs. SKUTEČNOST "
                                     f"(aktualizováno {now.strftime('%H:%M')})"]]},
        {"range": f"A3:H{2 + len(rows)}", "values": rows},
        {"range": "K3:T27", "values": hours},
        {"range": "K28:T28", "values": [["CELKEM za den"] +
                                        [f"=SUM({c}4:{c}27)" for c in "LMNOPQRST"]]},
    ], value_input_option="USER_ENTERED")

    souhrn = sh.worksheet("Denní souhrn")
    hlavicka = ["Datum", "Den", "Poslední aktualizace", "Lety celkem (plán)", "z toho T1", "z toho T2",
                "Už přistálo", "Zpoždění ≥15 min (počet)", "Průměrná odchylka min", "Největší zpoždění min"]
    sloupec_a = souhrn.col_values(1)
    if not sloupec_a or sloupec_a[0] != "Datum":
        souhrn.update(range_name="A1:J1", values=[hlavicka])
        sloupec_a = souhrn.col_values(1)
    if day.isoformat() in sloupec_a:
        radek = sloupec_a.index(day.isoformat()) + 1
        souhrn.update(range_name=f"A{radek}:J{radek}", values=[summary])
    else:
        souhrn.append_row(summary, value_input_option="USER_ENTERED")

    print(f"{nazev}: {n} letů, aktualizováno {now.strftime('%H:%M')}")


if __name__ == "__main__":
    main()
