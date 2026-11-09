# TaxiMozek · Letiště Praha

Mobilní webová aplikace pro taxikáře: **kdy být u T1/T2, aby nečekali.**
Zdroj dat: oficiální příletová tabule Letiště Praha (api.prg.aero), živě každé 2 minuty.

## Nasazení na GitHub Pages (5 minut, zdarma)

1. Na GitHubu založ nový veřejný repozitář, např. `taximozek-letiste`.
2. Nahraj do něj **všechny soubory z této složky** (včetně skryté složky `.github/workflows/`).
3. Settings → Pages → Source: *Deploy from a branch* → Branch `main` / `(root)` → Save.
4. Settings → Actions → General → Workflow permissions: **Read and write** → Save.
5. Actions → „Přílety PRG – záloha každých 10 minut“ → *Run workflow* (první spuštění ručně).

Aplikace poběží na `https://<tvůj-účet>.github.io/taximozek-letiste/`.

## Jak to funguje

- `index.html` – celá aplikace (jeden soubor). V prohlížeči si tahá tabuli přímo z api.prg.aero.
- `prilety.json` – záloha, kterou GitHub Action obnovuje každých 10 minut. Použije se, kdyby přímé
  stažení v prohlížeči selhalo (firewall letiště, CORS, výpadek).
- V `index.html` je navíc **vložený snímek** tabule (`build.py`), takže stránka ukáže data i úplně offline.
- `fetch_prilety.py` – stahovací skript (bez triků, veřejné API).
- Ladění: `index.html?t=14:30` posune „teď“ na 14:30, `?ask=1` otestuje odpovědi.

## Živá data – tři cesty (v tomto pořadí)

1. Přímé čtení z api.prg.aero v prohlížeči – letiště ale firewall pravděpodobně blokuje požadavky z cizích webů
   (ověřeno: s cizí hlavičkou Origin vrací „Request Rejected“).
2. **Vlastní proxy** `prilety-proxy.php` – nahraj na libovolný PHP hosting (např. batkoai.com), adresu vlož
   v aplikaci do Nastavení → „Adresa živé proxy“. Pak jsou data živá každé 2 minuty. Doporučeno.
3. Záloha `prilety.json` z GitHub Action (každých 10 min, GitHub někdy zpozdí o dalších 5–15 min).

## Odhady

„Lidi venku“ = přistání + 25 min (T2 Schengen) / + 45 min (T1 mimo Schengen) – řidič si upraví v Nastavení.
Tabule letiště neposílá typ letadla. Aplikace doplňuje typický stroj dopravce na linkách do Prahy (tabulka ~50 dopravců),
typickou obsazenost, kupní sílu trasy (1–5) a podíl cestujících, kteří si vezmou taxi (dálkové/byznys 15–22 %, low-cost 5–8 %,
dovolenkové charterové 3–5 %). Z toho: lidí na palubě → lidí na taxi → vozů (÷ 1,5 osoby na vůz) po půlhodinách a terminálech.
Násobky si řidič upraví v Nastavení.
