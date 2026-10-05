# Úvodní zpravodaj — generátor DOCX (ŠSČR)

Generátor úvodního zpravodaje soutěže družstev Šachového svazu ČR.
Jednosouborová webová aplikace (stejný základ jako
[sscr-zpravodaj](../sscr-zpravodaj)), která z API chess.cz vygeneruje
dokument `.docx` podle vzoru `docs/rp_b_26_27-uz.docx` (RP sk. B SŠS 2026/27).

Generují se hlavně kapitoly **Soupisky družstev** a **Rozlosování soutěže**,
dále **Specifické požadavky** (seznam jiných začátků) a **Stránky soutěže**
(odkazy). Ostatní kapitoly vzoru jsou v dokumentu jen jako nadpisy.

## Použití

1. **Soutěž** — *Sezóna → Kraj → Soutěž* nebo ID soutěže, **Načíst data**.
2. **Začátky utkání a rozhodčí** (pamatuje se v prohlížeči pro každou soutěž zvlášť):
   - **Výchozí začátek** — standardně 10:00 (např. RP SŠS má 9:00).
   - **Družstva s jiným začátkem** — čas *Doma* a/nebo *Venku*; pole jsou
     předvyplněná zašedlým výchozím začátkem (mění se s ním). Jiný čas se
     v rozlosování připíše tučně červeně k domácímu družstvu („Sokol Mšeno **10:00 hodin**“),
     ať ho požaduje domácí (doma), nebo hosté (venku). Když se oba požadavky
     liší, zapíše se místo času **???**. Záhlaví kola dostane
     „, pokud není uvedeno jinak“ jen tehdy, když se v kole nějaká výjimka uplatní.
   - **Poslední kolo** (výchozí zapnuto) — všechna utkání ve výchozí čas,
     výjimky se neuplatní (náhled vypíše, kterých zápasů se to týká), a do
     záhlaví kola se připíše poznámka (výchozí „poslední kolo, všechna utkání
     musí začínat v …“, lze přepsat nebo smazat).
   - **Rozhodčí** Ano/Ne — sloupec v rozlosování; jména se píšou do žlutých
     polí v náhledu (Enter = další zápas) nebo později ve Wordu.
3. **Náhled** — rozměry tabulek jako v DOCX, nahoře upozornění (konflikty
   časů, neověřená startovní čísla, nerozlišené shodné jméno).
4. **Stažení** — DOCX, název souboru navržen jako `rpb_26_27_uz`.

## Data a pravidla

| Údaj | Zdroj |
|---|---|
| Název soutěže, region, řídící (jméno, e-mail, telefon), odkaz chess-results | `/competitions/{id}/details` (`compWww`) |
| Ročník | seznam soutěží `/competitions/{rok}` |
| Družstva | `/competitions/{id}/table` |
| Rozlosování (kola, data, pořadí zápasů) | `/competitions/{id}/schedule` |
| Soupisky (pořadí, jméno, NRtg, IRtg, příznaky) | `/competitions/{id}/team/{teamId}/roster` |
| Rok narození u shodných jmen | `/members/{lok}/cze` (jen pro duplicity) |

- **Startovní čísla** API nevrací. Bere se pořadí podle `teamId` (import ze
  Swiss-Manageru), ověří se Bergerovým schématem 1. kola (dvojice i a N+1−i);
  nesedí-li, zkusí se pořadí tabulky, jinak varování.
- **Sloupec Z** = hráč v základní sestavě (příznak `Z`), sloupec **Typ** =
  ostatní příznaky (K, ZK, H, V, C) oddělené čárkou.
- **Shodná jména** v soupisce družstva → přípona *st.* / *ml.* podle roku
  narození. Stejný rok nebo víc než dva hráči → beze změny + varování.
- **Písmo** Arial 10 pt, pevně. Je nastavené jen ve stylech dokumentu
  (výchozí písmo dokumentu, Název, Podtitul, Nadpis 1), ne u jednotlivých
  textů — změna stylu ve Wordu se projeví v celém dokumentu.
  Záhlaví stránky *Region - Soutěž - Ročník*, zápatí *Strana X z Y*.
- **Okraje** na tisknutelné minimum: boky 0,7 cm, nahoře/dole 1,2 cm
  (záhlaví/zápatí 0,5 cm od kraje). Vnitřní okraje buněk minimální (50 DXA).
- **Soupisky po dvou vedle sebe** — jedna plochá tabulka na dvojici
  (6 sloupců | mezera | 6 sloupců; vnořené tabulky LibreOffice stránkuje
  špatně). Sloupec pořadí bez nadpisu; nad tabulkou číslo a název družstva
  12 pt bez podbarvení a hran (bez průměrného ratingu).
- **Rozlosování** — sloupce Č. | St. | Družstvo | - | Družstvo | St. | Rozhodčí,
  rozhodčí zkrácen na „Příjmení J.“ (v náhledu po opuštění pole).
- Tabulky (dvojice soupisek, kola) se nedělí mezi stránky (`cantSplit` + `keepNext`).

API je šetřené stejně jako v sscr-zpravodaj: serializovaná fronta s rozestupem
≥ 300 ms, po `429`/síťové chybě 10 min blokace, cache v `localStorage` 1 h
(tlačítko *Vymazat cache*). Jedno načtení soutěže s 10 družstvy ≈ 14 dotazů
(+2 za každou dvojici shodných jmen).

## Nasazení (Cloudflare Workers — static assets)

`wrangler.jsonc`: obsah `public/`, doména **uvodni.sachytynec.cz**
+ záložní `uvodni-zpravodaj.<účet>.workers.dev`.

```
npx wrangler login   # jednorázově
npm run deploy       # = npx wrangler deploy
```

Záznam v rozcestníku app.sachytynec.cz: `apps.json` v repu `app`.

## Vývoj a testování

```
npm test
```

Testy (`test/pure.test.js`) vytáhnou inline `<script>` z `public/index.html`
a spustí čisté funkce v Node bez DOM (příznaky, st./ml., startovní
čísla, časy utkání a konflikty, záhlaví kol, šířky sloupců, název souboru).

## Adresáře

- `public/index.html` — celá aplikace (jeden soubor)
- `wrangler.jsonc` — nasazení na Cloudflare
- `test/` — testy čistých funkcí (`node --test`)
- `docs/` — vzor a referenční podklady (mimo git)
