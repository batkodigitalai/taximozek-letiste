/**
 * Přílety PRG – denní záznam PLÁN vs. SKUTEČNOST (TaxiMozek)
 * Běží v Google Apps Script přímo v tabulce, každých 30 min, bez Claude a bez zapnutého PC.
 * Nahrazuje plánované úlohy v Claude „Přílety PRG – denní záznam“ (v :15 a v :45).
 *
 * Jednorázově: spusťte funkci nastavitSpousteni() a povolte přístup.
 */
const TZ = 'Europe/Prague';
const DNY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']; // podle getDay(): 0 = neděle

function nastavitSpousteni() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'zapisPrilety')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('zapisPrilety').timeBased().everyMinutes(30).create();
  zapisPrilety();
}

function fmt(d, f) { return Utilities.formatDate(d, TZ, f); }

function parse(s) { // "2026-11-10T08:15:00+0100" i "+01:00"
  return new Date(s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
}

function stahni(datum) {
  const url = 'https://api.prg.aero/arrivals-shorttime?offset=0&limit=300&from=' + datum + '_00-00';
  for (let pokus = 0; pokus < 2; pokus++) {
    try {
      const r = UrlFetchApp.fetch(url, { headers: { Origin: 'https://www.prg.aero' }, muteHttpExceptions: true });
      if (r.getResponseCode() === 200) return JSON.parse(r.getContentText());
    } catch (e) { console.log('API letiště: ' + e); }
    Utilities.sleep(30000);
  }
  throw new Error('tabule nedostupná – nic nezapisuji');
}

function zapisPrilety() {
  const now = new Date();
  const ref = fmt(now, 'H') === '0' ? new Date(now.getTime() - 86400000) : now; // ve 00:xx finál předchozího dne
  const den = fmt(ref, 'yyyy-MM-dd');
  const dn = DNY[parseInt(fmt(ref, 'u'), 10) % 7];
  const surova = stahni(fmt(ref, 'dd-MM-yyyy'));

  const fl = [];
  surova.forEach(x => {
    if (!x.isMainFlight) return;
    const t = parse(x.time);
    const e = x['time-new'] ? parse(x['time-new']) : t;
    if (fmt(t, 'yyyy-MM-dd') !== den) return;
    fl.push({ f: x.flyNumber, o: x.destination, T: x.terminal, t: t, e: e, s: x.state || '', c: x.company || '' });
  });
  fl.sort((a, b) => a.t - b.t);

  const rows = [['Let', 'Odkud', 'Aerolinka', 'Terminál', 'PLÁN (HH:MM)', 'SKUTEČNOST/OČEKÁVÁNO (HH:MM)',
    'Rozdíl min (skut.−plán)', 'Stav na tabuli']];
  fl.forEach(r => rows.push([r.f, r.o, r.c, r.T, fmt(r.t, 'HH:mm'), fmt(r.e, 'HH:mm'),
    Math.round((r.e - r.t) / 60000), r.s]));

  const hours = [['Hodina', 'PLÁN T1', 'PLÁN T2', 'PLÁN celkem', 'SKUT. T1', 'SKUT. T2', 'SKUT. celkem',
    'ROZDÍL T1', 'ROZDÍL T2', 'ROZDÍL celkem']];
  for (let h = 0; h < 24; h++) {
    const pl = [0, 0], ac = [0, 0];
    fl.forEach(r => {
      const i = r.T === 'T1' ? 0 : 1;
      if (parseInt(fmt(r.t, 'H'), 10) === h) pl[i]++;
      if (parseInt(fmt(r.e, 'H'), 10) === h && fmt(r.e, 'yyyy-MM-dd') === den) ac[i]++;
    });
    const hh = ('0' + h).slice(-2);
    hours.push([hh + ':00–' + hh + ':59', pl[0], pl[1], pl[0] + pl[1], ac[0], ac[1], ac[0] + ac[1],
      ac[0] - pl[0], ac[1] - pl[1], ac[0] + ac[1] - pl[0] - pl[1]]);
  }

  const n = fl.length;
  const dl = fl.map(r => (r.e - r.t) / 60000);
  const summary = [den, dn, fmt(now, 'HH:mm'), n,
    fl.filter(r => r.T === 'T1').length, fl.filter(r => r.T === 'T2').length,
    fl.filter(r => r.s.indexOf('Přistálo') === 0).length, dl.filter(x => x >= 15).length,
    n ? Math.round(dl.reduce((a, b) => a + b, 0) / n * 10) / 10 : 0, dl.length ? Math.max.apply(null, dl) : 0];

  const ss = SpreadsheetApp.getActive();
  const nazev = 'Přílety ' + den + ' ' + dn;
  let ws = ss.getSheetByName(nazev);
  if (!ws) { ws = ss.insertSheet(nazev); ws.setFrozenRows(3); }
  ws.getRange('A1').setValue('Přílety PRG ' + den + ' ' + dn + ' – PLÁN vs. SKUTEČNOST (aktualizováno ' + fmt(now, 'HH:mm') + ')');
  ws.getRange(3, 5, rows.length, 2).setNumberFormat('@'); // časy HH:MM ponechat jako text
  ws.getRange(3, 1, rows.length, 8).setValues(rows);
  ws.getRange('K3:T27').setValues(hours);
  ws.getRange('K28:T28').setValues([['CELKEM za den'].concat('LMNOPQRST'.split('').map(c => '=SUM(' + c + '4:' + c + '27)'))]);

  let s = ss.getSheetByName('Denní souhrn') || ss.insertSheet('Denní souhrn');
  const hlav = ['Datum', 'Den', 'Poslední aktualizace', 'Lety celkem (plán)', 'z toho T1', 'z toho T2',
    'Už přistálo', 'Zpoždění ≥15 min (počet)', 'Průměrná odchylka min', 'Největší zpoždění min'];
  if (s.getRange('A1').getValue() !== 'Datum') s.getRange(1, 1, 1, 10).setValues([hlav]);
  const a = s.getRange(1, 1, Math.max(s.getLastRow(), 1), 1).getValues()
    .map(r => r[0] instanceof Date ? fmt(r[0], 'yyyy-MM-dd') : String(r[0]));
  const idx = a.indexOf(den);
  const radek = idx >= 0 ? idx + 1 : s.getLastRow() + 1;
  s.getRange(radek, 1).setNumberFormat('@');
  s.getRange(radek, 1, 1, 10).setValues([summary]);
  console.log(nazev + ': ' + n + ' letů, aktualizováno ' + fmt(now, 'HH:mm'));
}
