// Testy čistých funkcí z index.html (běží bez prohlížeče, bez závislostí).
// Inline <script> se spustí ve vm-kontextu bez DOM; docx.* se volá jen uvnitř
// funkcí pro sestavení DOCX, takže tady není potřeba.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(m, 'inline <script> v index.html nenalezen');

const ctx = { window: { addEventListener() {} }, console };
vm.createContext(ctx);
vm.runInContext(m[1], ctx);

const { splitFlags, parseRoster, duplicateGroups, dupSuffixes, displayName,
        bergerOk, assignStartNumbers, parseRounds, fmtTime, matchTime, roundHeader, defaultLastNote,
        scheduleView, schedCols, requirementLines, refShort, calendarMonths, pairWeeks, parseCzDate, abbrev, suggestFname, resolveFname } = ctx;
const CONTENT = 11112;  // šířka sazby A4 s okraji 0,7 cm (top-level const není v kontextu)
const plain = o => JSON.parse(JSON.stringify(o));

test('splitFlags — Z do samostatného sloupce, ostatní příznaky za sebou', () => {
  assert.deepEqual(plain(splitFlags(' K Z')), { z: true, typ: 'K' });
  assert.deepEqual(plain(splitFlags(' H Z ZK')), { z: true, typ: 'H,ZK' });
  assert.deepEqual(plain(splitFlags(' ZK')), { z: false, typ: 'ZK' });   // ZK ≠ Z
  assert.deepEqual(plain(splitFlags('')), { z: false, typ: '' });
  assert.deepEqual(plain(splitFlags(null)), { z: false, typ: '' });
});

test('parseRoster — pořadí podle rosterPosition, příznaky, jméno bez mezer', () => {
  const r = parseRoster([
    { rosterPosition: 2, playerId: 2, playerName: 'B ', playerCzeElo: 1500, playerFideElo: 0, playerFlags: '' },
    { rosterPosition: 1, playerId: 1, playerName: 'A', playerCzeElo: null, playerFideElo: 1600, playerFlags: ' K Z' },
  ]);
  assert.deepEqual(plain(r.map(p => [p.pos, p.name, p.nrtg, p.irtg, p.z, p.typ])),
                   [[1, 'A', 0, 1600, true, 'K'], [2, 'B', 1500, 0, false, '']]);
});

test('duplicateGroups / dupSuffixes — st./ml. podle roku narození', () => {
  const roster = [{ id: 1, name: 'Meca Viktor' }, { id: 2, name: 'Novák Jan' }, { id: 3, name: 'Meca Viktor' }];
  const g = duplicateGroups(roster);
  assert.equal(g.length, 1);
  assert.deepEqual(plain(dupSuffixes(g[0], { 1: 2008, 3: 1975 })), { 1: 'ml.', 3: 'st.' });
  assert.equal(dupSuffixes(g[0], { 1: 1975, 3: 1975 }), null);   // stejný rok → nelze
  assert.equal(dupSuffixes(g[0], { 1: 1975 }), null);            // chybí údaj
  assert.equal(displayName({ name: 'Meca Viktor', suffix: 'st.' }), 'Meca Viktor st.');
  assert.equal(displayName({ name: 'Novák Jan', suffix: '' }), 'Novák Jan');
});

test('bergerOk / assignStartNumbers — teamId, záložně tabulka, jinak varování', () => {
  const teams = [1, 2, 3, 4].map(i => ({ id: 100 + i, name: 'T' + i, rank: 5 - i }));
  const r1 = { nr: 1, matches: [{ homeId: 101, awayId: 104 }, { homeId: 102, awayId: 103 }] };
  let sn = assignStartNumbers(teams, [r1]);
  assert.equal(sn.ok, true); assert.equal(sn.source, 'teamId');
  assert.deepEqual(plain(sn.teams.map(t => [t.id, t.stc])), [[101, 1], [102, 2], [103, 3], [104, 4]]);
  // ID neodpovídá Bergerovi, tabulka ano → startovní čísla podle tabulky
  const t2 = [{ id: 1, rank: 2 }, { id: 2, rank: 1 }, { id: 3, rank: 3 }, { id: 4, rank: 4 }];
  const r1b = { nr: 1, matches: [{ homeId: 2, awayId: 4 }, { homeId: 1, awayId: 3 }] };
  sn = assignStartNumbers(t2, [r1b]);
  assert.equal(sn.ok, true); assert.equal(sn.source, 'tabulka');
  assert.deepEqual(plain(sn.teams.map(t => [t.id, t.stc])), [[2, 1], [1, 2], [3, 3], [4, 4]]);
  const r1c = { nr: 1, matches: [{ homeId: 101, awayId: 102 }, { homeId: 103, awayId: 104 }] };
  sn = assignStartNumbers(teams, [r1c]);
  assert.equal(sn.ok, false);
  // lichý počet (N = 6): 1 má volno, hrají 2–5 a 3–4
  const odd = [{ homeId: 2, awayId: 5 }, { homeId: 3, awayId: 4 }];
  assert.equal(bergerOk({ matches: odd }, { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }, 5), true);
});

test('parseRounds — seřazení podle čísla kola', () => {
  const r = parseRounds([
    { roundNr: 2, roundDate: '08.11.2026', roundMatches: [] },
    { roundNr: 1, roundDate: '18.10.2026', roundMatches: [{ homeTeamId: 1, homeTeamName: 'A', awayTeamId: 2, awayTeamName: 'B' }] },
  ]);
  assert.deepEqual(plain(r.map(x => x.nr)), [1, 2]);
  assert.deepEqual(plain(r[0].matches[0]), { homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' });
});

test('matchTime — doma/venku, výchozí čas, konflikt ???', () => {
  assert.equal(fmtTime('09:00'), '9:00');
  assert.equal(fmtTime(''), '');
  assert.equal(matchTime('', '', '10:00'), '');
  assert.equal(matchTime('10:00', '', '9:00'), '10:00');      // jen domácí
  assert.equal(matchTime('', '09:30', '9:00'), '9:30');       // jen hosté venku
  assert.equal(matchTime('10:00', '10:00', '9:00'), '10:00'); // shoda
  assert.equal(matchTime('10:00', '09:00', '9:00'), '???');   // konflikt (i když hosté chtějí výchozí)
  assert.equal(matchTime('09:00', '', '09:00'), '');          // = výchozí → nic
});

test('roundHeader — „pokud není uvedeno jinak“ jen při výjimce, poznámka v závorce', () => {
  const r = { nr: 1, date: '18.10.2026' };
  assert.equal(roundHeader(r, '10:00', false, ''), 'Kolo 1 dne 18.10.2026 v 10:00 hodin');
  assert.equal(roundHeader(r, '09:00', true, ''), 'Kolo 1 dne 18.10.2026 v 9:00 hodin, pokud není uvedeno jinak');
  assert.equal(roundHeader(r, '10:00', false, defaultLastNote('10:00')),
               'Kolo 1 dne 18.10.2026 v 10:00 hodin (poslední kolo, všechna utkání musí začínat v 10:00)');
});

const D = {
  teams: [{ id: 1, name: 'A', stc: 1 }, { id: 2, name: 'B', stc: 2 }, { id: 3, name: 'C', stc: 3 }, { id: 4, name: 'D', stc: 4 }],
  rounds: [
    { nr: 1, date: '1.1.2027', matches: [{ homeId: 1, awayId: 4, homeName: 'A', awayName: 'D' }, { homeId: 2, awayId: 3, homeName: 'B', awayName: 'C' }] },
    { nr: 2, date: '8.1.2027', matches: [{ homeId: 4, awayId: 3, homeName: 'D', awayName: 'C' }, { homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' }] },
  ],
};
const cfg = o => Object.assign({ defTime: '10:00', home: {}, away: {}, lastUniform: true, lastNote: null, withRef: true, refs: {} }, o);

test('scheduleView — čas u domácích, konflikt, poslední kolo bez výjimek, rozhodčí', () => {
  const sv = scheduleView(D, cfg({ home: { 1: '09:00' }, away: { 4: '11:00' }, refs: { '1.2': 'Novák' } }));
  assert.equal(sv.rounds[0].rows[0].time, '???');                 // A doma 9:00 × D venku 11:00
  assert.deepEqual(plain(sv.conflicts), ['1.1 A – D']);
  assert.match(sv.rounds[0].header, /pokud není uvedeno jinak$/);
  assert.equal(sv.rounds[0].rows[1].ref, 'Novák');
  assert.equal(sv.rounds[0].rows[0].awayStc, 4);
  // poslední kolo: A doma 9:00 se neuplatní, poznámka v záhlaví
  assert.equal(sv.rounds[1].rows[1].time, '');
  assert.deepEqual(plain(sv.suppressed), ['2.2 A – B (9:00)']);
  assert.equal(sv.rounds[1].header, 'Kolo 2 dne 8.1.2027 v 10:00 hodin (poslední kolo, všechna utkání musí začínat v 10:00)');
  // bez jednotného posledního kola: výjimka platí, poznámka zmizí
  const sv2 = scheduleView(D, cfg({ home: { 1: '09:00' }, lastUniform: false }));
  assert.equal(sv2.rounds[1].rows[1].time, '9:00');
  assert.equal(sv2.rounds[1].header, 'Kolo 2 dne 8.1.2027 v 10:00 hodin, pokud není uvedeno jinak');
  // vlastní / smazaná poznámka
  assert.equal(scheduleView(D, cfg({ lastNote: '' })).rounds[1].header, 'Kolo 2 dne 8.1.2027 v 10:00 hodin');
});

test('schedCols — součet = šířka sazby, s rozhodčím i bez', () => {
  const sv = scheduleView(D, cfg());
  [true, false].forEach(w => {
    const c = schedCols(w);
    assert.equal(c.length, w ? 7 : 6);
    assert.ok(Math.abs(c.reduce((a, b) => a + b, 0) - CONTENT) <= 1);
    assert.equal(c[2], c[4]);
  });
});

test('requirementLines — seznam jiných začátků, jinak prázdné', () => {
  assert.deepEqual(plain(requirementLines(D, cfg())), []);
  assert.deepEqual(plain(requirementLines(D, cfg({ defTime: '09:00', home: { 2: '10:00' }, away: { 3: '09:30' } }))), [
    'Jiné začátky utkání (výchozí začátek je v 9:00 hodin):',
    '• B — domácí utkání v 10:00 hodin',
    '• C — utkání venku v 9:30 hodin',
  ]);
});

test('název souboru — zkratka soutěže, ročník, _uz; sanitizace', () => {
  assert.equal(abbrev("Regionální přebor 'B'"), 'rpb');
  assert.equal(suggestFname("Regionální přebor 'B'", 2026), 'rpb_26_27_uz');
  assert.equal(resolveFname('rpb_26_27_uz'), 'rpb_26_27_uz.docx');
  assert.equal(resolveFname('a/b.docx'), 'a_b.docx');
  assert.equal(resolveFname(''), 'uvodni_zpravodaj.docx');
});

test('refShort — příjmení + iniciály křestních jmen', () => {
  assert.equal(refShort('Burda Roman'), 'Burda R.');
  assert.equal(refShort('  Urbánek  Alexandr Jan '), 'Urbánek A. J.');
  assert.equal(refShort('Meca Viktor st.'), 'Meca V. st.');
  assert.equal(refShort('Burda R.'), 'Burda R.');     // už zkrácené
  assert.equal(refShort('Burda'), 'Burda');
  assert.equal(refShort(''), '');
  assert.equal(refShort(null), '');
});

test('calendarMonths — měsíce od prvního do posledního kola, týdny po–ne, dny utkání', () => {
  const rounds = [{ nr: 1, date: '18.10.2026' }, { nr: 2, date: '08.11.2026' }, { nr: 3, date: '10.01.2027' }];
  const ms = calendarMonths(rounds);
  assert.deepEqual(plain(ms.map(m => m.name)), ['Říjen 2026', 'Listopad 2026', 'Prosinec 2026', 'Leden 2027']);
  ms.forEach(m => m.weeks.forEach(w => assert.equal(w.length, 7)));
  // jen potřebné týdny: říjen 2026 (čt + 31 dní) 5, listopad (ne + 30) 6, únor 2027 (po + 28) 4
  assert.deepEqual(plain(ms.map(m => m.weeks.length)), [5, 6, 5, 5]);
  assert.equal(calendarMonths([{ nr: 1, date: '07.02.2027' }])[0].weeks.length, 4);
  assert.equal(pairWeeks([ms[0], ms[1]]), 6);
  assert.equal(pairWeeks([ms[2]]), 5);
  // 1. 10. 2026 je čtvrtek → první týden: po–st prázdné
  const oct = ms[0];
  assert.deepEqual(plain(oct.weeks[0].map(c => c && c.d)), [null, null, null, 1, 2, 3, 4]);
  // 18. 10. 2026 je neděle (poslední sloupec) a je to 1. kolo
  const d18 = oct.weeks.flat().find(c => c && c.d === 18);
  assert.deepEqual(plain(d18.rounds), [1]);
  assert.equal(oct.weeks[2][6].d, 18);
  // 31 dní v říjnu, mimo měsíc null
  assert.equal(oct.weeks.flat().filter(Boolean).length, 31);
  assert.equal(ms[2].weeks.flat().filter(c => c && c.rounds.length).length, 0);   // prosinec bez kola
  assert.deepEqual(plain(calendarMonths([])), []);
});

test('parseCzDate', () => {
  assert.equal(parseCzDate('x'), null);
  assert.equal(parseCzDate('08.11.2026').getDate(), 8);
});
