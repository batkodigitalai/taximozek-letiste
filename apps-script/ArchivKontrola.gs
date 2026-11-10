/**
 * ARCHIV KONTROLA – denní kontrola archivů plánovaných úloh Claude a index denní složky.
 * Náhrada za plánovanou úlohu Claude „Archiv kontrola a index denní složky 23:52" (bez AI, bez tokenů).
 * Napsal Claude 10. 11. 2026. Spouštěč: denně kolem 23:52 (funkce archivKontrola).
 * Jednorázové nastavení spouštěče: spusť funkci nastavSpoustecArchivu().
 */

var AK_ROOT_ID = '1AWLRhjoOsbIgjfPr_2829KdQLwTguEsk'; // 00 Optimalizace deníku 2026
var AK_TZ = 'Europe/Prague';
var AK_EMAIL = 'DOPLNIT_EMAIL'; // v ostrém projektu je skutečná adresa; ve veřejné záloze záměrně vynechána
var AK_DNY = ['', 'po', 'út', 'st', 'čt', 'pá', 'so', 'ne']; // 1 = pondělí

// slug, název úlohy, kdy běží, pravidlo: 'vzdy' | 'nedele' | 'pondeli' | 'volitelne'
var AK_OCEKAVANE = [
  ['sauto-snapshot', 'Sauto tracker denní snapshot', 'denně 07:45', 'vzdy'],
  ['openlane-ranni-mereni', 'OPENLANE ranní měření', 'denně 07:15', 'vzdy'],
  ['openlane-vecerni-sken', 'OPENLANE večerní sken', 'denně 18:45', 'vzdy'],
  ['track-record', 'Track record vyhodnocení', 'denně 21:00', 'vzdy'],
  ['dealer-pilot', 'Dealer pilot automat', 'denně 09:00', 'vzdy'],
  ['zaloha-kontrola', 'Kontrola zálohy Cowork', 'denně 23:00', 'vzdy'],
  ['sauto-vlna', 'Odpolední Sauto vlna', 'denně 17:30', 'vzdy'],
  ['reakce-socialni-site', 'Reakce ze sítí (8× denně)', '08–22', 'volitelne'],
  ['sauto-obratka', 'Sauto obrátka měření', 'denně 07:00', 'vzdy'],
  ['ranni-kontrola-ukolu', 'Ranní kontrola úkolů', 'denně 07:00', 'vzdy'],
  ['uzaverka-ukolu', 'Odpolední uzávěrka úkolů', 'denně 17:30', 'vzdy'],
  ['nedelni-revize-ukolu', 'Nedělní revize úkolů', 'jen neděle 18:00', 'nedele'],
  ['prompt-dashboard', 'Refresh prompt dashboardu', 'jen pondělí 07:09', 'pondeli'],
  ['taaft', 'TAAFT večerní zpracování', 'denně 23:00', 'vzdy'],
  ['medium', 'Medium Daily Digest', 'denně 07:30', 'vzdy'],
  ['ai-prilezitosti', 'AI příležitosti', 'denně 21:05', 'vzdy']
];

function archivKontrola() {
  var ted = new Date();
  var dnes = Utilities.formatDate(ted, AK_TZ, 'yyyyMMdd');
  var den = AK_DNY[parseInt(Utilities.formatDate(ted, AK_TZ, 'u'), 10)];
  var vcera = Utilities.formatDate(new Date(ted.getTime() - 24 * 3600 * 1000), AK_TZ, 'yyyyMMdd');
  var root = DriveApp.getFolderById(AK_ROOT_ID);

  var slozky = akNajdiSlozky_(root, dnes);
  if (slozky.length === 0) {
    MailApp.sendEmail(AK_EMAIL, 'Archiv ' + dnes + ': denní složka neexistuje',
      'Ve složce „00 Optimalizace deníku 2026" není žádná podsložka začínající ' + dnes +
      '. Index nevznikl. Složku zakládá noční úloha Denní souhrn.');
    return;
  }
  var slozka = slozky[0];
  var poznamky = [];
  if (slozky.length > 1) {
    poznamky.push('Složek začínajících ' + dnes + ' je ' + slozky.length +
      ' (duplicita k ručnímu sloučení). Pracuji s nejstarší: ' + slozka.getName());
  }

  // výpis složky včetně tematických podsložek (soubory se do nich během dne třídí)
  var soubory = akVypis_(slozka, '');
  soubory.sort(function (a, b) { return a.vytvoreno - b.vytvoreno; });

  var nazevIndexu = dnes + '_2352_' + den + '_CLAUDE_ARCHIV-INDEX.md';
  var bezIndexu = soubory.filter(function (x) { return x.nazev !== nazevIndexu; });

  var radky = [];
  var chybi = [];
  var nalezeno = 0, neplati = 0;
  AK_OCEKAVANE.forEach(function (o) {
    var slug = o[0], uloha = o[1], pravidlo = o[3];
    if ((pravidlo === 'nedele' && den !== 'ne') || (pravidlo === 'pondeli' && den !== 'po')) {
      neplati++;
      radky.push('| ' + uloha + ' | NEPLATÍ DNES | — |');
      return;
    }
    var novy = new RegExp('_CLAUDE_' + slug + '(_\\d+)?\\.md$');
    var stary = new RegExp('^\\d{8}_(\\d{4}_)?[^_]+_' + slug + '(_\\d+)?\\.md$');
    var shody = bezIndexu.filter(function (x) { return novy.test(x.nazev); });
    var stare = bezIndexu.filter(function (x) { return !novy.test(x.nazev) && stary.test(x.nazev); });
    if (shody.length + stare.length > 0) {
      nalezeno++;
      var vse = shody.concat(stare);
      radky.push('| ' + uloha + ' | NALEZEN | ' + vse.map(function (x) {
        return '[' + x.nazev + '](' + x.url + ')';
      }).join(', ') + ' |');
      if (vse.length > 1) poznamky.push(uloha + ': ' + vse.length + ' souborů (duplicita).');
      if (stare.length > 0) poznamky.push(uloha + ': starý formát názvu bez CLAUDE (' + stare[0].nazev + ').');
    } else if (pravidlo === 'volitelne') {
      neplati++;
      radky.push('| ' + uloha + ' | BEZ SOUBORU (tichý den, není chyba) | — |');
    } else {
      chybi.push(uloha);
      radky.push('| ' + uloha + ' | **CHYBÍ** | — |');
    }
  });

  var souhrnNazev = 'souhrn-' + vcera + '.md';
  var vcSlozky = akNajdiSlozky_(root, vcera);
  var souhrn = null;
  if (vcSlozky.length > 0) {
    var vcVse = akVypis_(vcSlozky[0], '').filter(function (x) { return x.nazev === souhrnNazev; });
    if (vcVse.length > 0) souhrn = vcVse[0];
  }
  if (souhrn) {
    nalezeno++;
    radky.push('| Denní souhrn (za včerejšek) | NALEZEN | [' + souhrnNazev + '](' + souhrn.url + ') |');
  } else {
    chybi.push('Denní souhrn za ' + vcera);
    radky.push('| Denní souhrn (za včerejšek) | **CHYBÍ** | — |');
    if (vcSlozky.length === 0) poznamky.push('Včerejší složka (' + vcera + ') neexistuje.');
  }

  var sClaude = bezIndexu.filter(function (x) { return x.nazev.indexOf('CLAUDE') !== -1; }).length;

  var md = [];
  md.push('# Archivní index dne ' + Utilities.formatDate(ted, AK_TZ, 'd. M. yyyy') + ' (' + den +
    ') — vytvořil Apps Script (skript napsal Claude)');
  md.push('Složka: ' + slozka.getName() + ' — ' + slozka.getUrl());
  md.push('Vytvořeno: ' + Utilities.formatDate(ted, AK_TZ, 'd. M. yyyy HH:mm'));
  md.push('');
  md.push('## Stav archivů plánovaných úloh');
  md.push('Nalezeno ' + nalezeno + ' · chybí ' + chybi.length + ' · neplatí dnes ' + neplati);
  md.push('');
  md.push('| úloha | stav | soubor |');
  md.push('|---|---|---|');
  md = md.concat(radky);
  md.push('');
  md.push('## Všechny soubory ve složce (' + bezIndexu.length + ', z toho ' + sClaude + ' od Claude — s CLAUDE v názvu)');
  bezIndexu.forEach(function (x) {
    md.push('- ' + Utilities.formatDate(x.vytvoreno, AK_TZ, 'HH:mm') + ' · [' + x.nazev + '](' + x.url + ') · ' + (x.cesta ? 'podsložka: ' + x.cesta : 'kořen denní složky'));
  });
  md.push('');
  md.push('## Poznámky');
  md.push(poznamky.length ? poznamky.map(function (p) { return '- ' + p; }).join('\n') : 'bez poznámek');
  var obsah = md.join('\n');

  var ex = slozka.getFilesByName(nazevIndexu);
  var index;
  if (ex.hasNext()) {
    index = ex.next();
    index.setContent(obsah);
  } else {
    index = slozka.createFile(nazevIndexu, obsah, 'text/markdown');
  }

  if (chybi.length > 0 && !akTest_) {
    MailApp.sendEmail(AK_EMAIL, 'Archiv ' + dnes + ': chybí ' + chybi.length,
      'Chybí archivy: ' + chybi.join(', ') + '.\n\nIndex: ' + index.getUrl() + '\nSložka: ' + slozka.getUrl());
  }
  Logger.log('Hotovo. Nalezeno ' + nalezeno + ', chybí ' + chybi.length + ' (' + chybi.join(', ') +
    '), neplatí ' + neplati + '. Index: ' + index.getUrl());
}

var akTest_ = false;

/** Zkušební běh přes den: vytvoří index, ale neposílá e-mail o chybějících archivech. */
function archivKontrolaTest() {
  akTest_ = true;
  archivKontrola();
}

/** Všechny soubory ve složce i v jejích podsložkách (rekurzivně). */
function akVypis_(slozka, cesta) {
  var out = [];
  var it = slozka.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    out.push({ nazev: f.getName(), url: f.getUrl(), typ: f.getMimeType(), vytvoreno: f.getDateCreated(), cesta: cesta });
  }
  var sub = slozka.getFolders();
  while (sub.hasNext()) {
    var s = sub.next();
    out = out.concat(akVypis_(s, cesta ? cesta + ' / ' + s.getName() : s.getName()));
  }
  return out;
}

/** Podsložky, jejichž název ZAČÍNÁ daným datem, seřazené od nejstarší. */
function akNajdiSlozky_(root, datum) {
  var out = [];
  var it = root.searchFolders("title contains '" + datum + "'");
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(datum) === 0) out.push(f);
  }
  out.sort(function (a, b) { return a.getDateCreated() - b.getDateCreated(); });
  return out;
}

/** Spusť jednou: založí denní spouštěč kolem 23:52 (a smaže případný starý téže funkce). */
function nastavSpoustecArchivu() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'archivKontrola') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('archivKontrola').timeBased().everyDays(1).atHour(23).nearMinute(52)
    .inTimezone(AK_TZ).create();
}
