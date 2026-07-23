/* Кабина FOXLIK — методика «коридора реалистичности».
   Порт из дашборда v2.1 (утверждена пользователем — НЕ менять без него).
   Данные приходят ТОЛЬКО из data/data.js (window.CABIN_DATA). */
window.CABIN = (function () {
  const D = window.CABIN_DATA;
  const sum = (a, i, j) => a.slice(i, j).reduce((s, x) => s + x, 0);

  /* Решения пользователя по отдельным позициям (перенесены из v2.1):
     rec — рекомендуемый план задан вручную; recKeep — план не срезать;
     verdict — вердикт назначен решением; wave — запуск «второй волной».
     На странице такие строки помечаются бейджем «решение руководства». */
  const OVR = {
    'Модуль_3шт': { verdict: 'new', recKeep: true },
    'PLPSNN-ПланшетНожки': { rec: 1480 },
    'SPFKDK-Конструктор': { rec: 1210 },
    'Полка_резинки': { verdict: 'green' },
    'полка_на_колесах': { wave: 1 },
    'Столик Мольберт': { recKeep: true, wave: 1 },
    'Столик Мольберт (серый)': { wave: 1, recKeep: true },
    'Столик Мольберт (латте)': { wave: 1, recKeep: true }
  };

  /* Вердикт по плану planVal — та же формула для «План» и «Рекомендуемый»,
     чтобы бейджи никогда не противоречили цифрам на экране. */
  function calcVerdict(it, planVal) {
    if (it.newp) return 'new';
    if (planVal === 0) return it.f25H2 > 0 ? 'info' : 'green';
    if (it.expHigh === null) return it.f26H1 > 0 ? 'amber' : 'new';
    if (planVal < it.expLow * 0.9) return 'info';
    if (planVal <= it.expHigh * 1.05) return 'green';
    if (planVal <= it.expHigh * 1.3) return 'amber';
    return 'red';
  }

  const items = D.items.map(o => {
    const it = Object.assign({}, o);
    it.f25T = sum(it.f25, 0, 12); it.f25H1 = sum(it.f25, 0, 6); it.f25H2 = sum(it.f25, 6, 12);
    it.f26H1 = sum(it.y26, 0, 6); it.pH2 = sum(it.y26, 6, 12);
    it.newp = (it.f25T === 0);
    it.expLow = it.f26H1;
    it.K = it.f25H1 > 0 ? it.f25H2 / it.f25H1 : null;          // сезонность 2025
    it.expHigh = (it.K !== null) ? it.f26H1 * it.K : null;
    const ov = OVR[it.name] || {};
    it.verdict = ov.verdict || calcVerdict(it, it.pH2);

    let rec;
    if (ov.rec != null) rec = ov.rec;
    else if (ov.recKeep) rec = it.pH2;
    else if ((it.verdict === 'amber' || it.verdict === 'red') && it.expHigh) rec = Math.round(it.expHigh);
    else if (it.newp) rec = it.f26H1 > 0 ? Math.round(it.f26H1 * 1.3) : Math.round(it.pH2 * 0.25);
    else rec = it.pH2;
    it.recH2 = rec;
    it.verdictRec = ov.verdict || calcVerdict(it, rec);
    const f = it.pH2 > 0 ? rec / it.pH2 : 0;
    it.recMon = it.y26.slice(0, 6).concat(it.y26.slice(6).map(v => Math.round(v * f)));

    it.wave = ov.wave || 0;
    it.recKeep = !!ov.recKeep;
    it.ovrType = ov.verdict ? 'verdict' : (ov.rec != null || ov.recKeep) ? 'plan' : null;
    it.retired = (it.pH2 === 0 && it.f26H1 === 0 && it.f25T > 0);   // выведена из ассортимента?
    return it;
  });

  /* Классификация уверенности в спросе (решение пользователя 17.07):
     расширения цветовой линейки наследуют спрос родителя — это НЕ новинки. */
  const LINE_EXT = {
    'стол_стул_2024_латте': 'стол_стул_2024',
    'стол_стул_2024_серый': 'стол_стул_2024',
    'Столик Мольберт (серый)': 'Столик Мольберт',
    'Столик Мольберт (латте)': 'Столик Мольберт'
  };
  items.forEach(it => {
    it.lineExt = LINE_EXT[it.name] || null;
    it.trueNew = it.newp && !it.relaunch && !it.lineExt && it.f26H1 === 0;
    it.conf = it.trueNew ? 0
      : (it.newp && it.f26H1 > 0 && !it.lineExt) ? 1
      : it.relaunch ? 1
      : it.lineExt ? 2 : 3;
    it.confLbl = it.trueNew ? 'истинно новая'
      : (it.newp && it.f26H1 > 0 && !it.lineExt) ? 'новинка · первые продажи'
      : it.relaunch ? 'возврат в продажу'
      : it.lineExt ? 'расширение линейки ← ' + it.lineExt
      : 'история продаж';
  });

  /* ---- состояние отчёта ---- */
  const S = { mode: 'u', basis: 'plan' };            // u=штуки, m=деньги · plan|rec

  const money = (it, units) => S.mode === 'u' ? units : units * (it.margin || 0);
  const planOf = it => S.basis === 'plan' ? it.pH2 : it.recH2;
  const monOf = it => S.basis === 'plan' ? it.y26 : it.recMon;
  const vOf = it => S.basis === 'plan' ? it.verdict : it.verdictRec;
  const ratioOf = it => it.expHigh ? planOf(it) / it.expHigh : null;
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const vf = n => S.mode === 'u' ? fmt(n) : fmt(n / 1000) + ' т₽';

  const VL = { green: 'реалистичен', amber: 'завышен', red: 'оторван', info: 'занижен', new: 'новинка' };
  const VE = { green: '🟢', amber: '🟡', red: '🔴', info: '🔵', new: '🟣' };
  const isUnl = it => vOf(it) === 'new' && it.f26H1 === 0;
  const vlbl = it => vOf(it) === 'new'
    ? (it.relaunch
      ? (it.f26H1 > 0 ? 'возврат · первые продажи' : 'возврат в продажу')
      : (it.f26H1 > 0 ? 'новинка · первые продажи' : 'новинка · не запущена'))
    : VL[vOf(it)];

  /* ---- агрегаты; list — отфильтрованный срез (по умолчанию все) ---- */
  function totals(list) {
    const L = list || items;
    const t = { f25: 0, f25H2: 0, f26H1: 0, pH2: 0, recH2: 0, eL: 0, eH: 0, f25H1: 0 };
    L.forEach(it => {
      t.f25 += money(it, it.f25T); t.f25H1 += money(it, it.f25H1); t.f25H2 += money(it, it.f25H2);
      t.f26H1 += money(it, it.f26H1);
      t.pH2 += money(it, it.pH2); t.recH2 += money(it, it.recH2);
      t.eL += money(it, it.expLow || 0); t.eH += money(it, it.expHigh || 0);
    });
    t.cur = S.basis === 'plan' ? t.pH2 : t.recH2;
    return t;
  }
  function byVerdict(list) {
    const L = list || items;
    const order = ['green', 'amber', 'red', 'info', 'new'];
    return order.map(v => ({
      v,
      u: L.filter(i => vOf(i) === v).reduce((s, i) => s + money(i, planOf(i)), 0),
      n: L.filter(i => vOf(i) === v && planOf(i) > 0).length
    })).filter(p => p.u > 0);
  }
  function unlaunched() {
    const list = items.filter(isUnl).filter(i => planOf(i) > 0);
    return { list, u: list.reduce((s, i) => s + money(i, planOf(i)), 0) };
  }
  function byCat(list) {
    const L0 = list || items;
    const cats = [...new Set(L0.map(i => i.cat))];
    return cats.map(c => {
      const L = L0.filter(i => i.cat === c);
      return {
        cat: c, n: L.length,
        f25H2: L.reduce((s, i) => s + money(i, i.f25H2), 0),
        f26H1: L.reduce((s, i) => s + money(i, i.f26H1), 0),
        plan: L.reduce((s, i) => s + money(i, planOf(i)), 0)
      };
    }).sort((a, b) => b.plan - a.plan);
  }
  function monthTotals(list) {
    const L = list || items;
    const t25 = [], t26 = [];
    for (let m = 0; m < 12; m++) {
      t25.push(L.reduce((s, i) => s + money(i, i.f25[m]), 0));
      t26.push(L.reduce((s, i) => s + money(i, monOf(i)[m]), 0));
    }
    return { t25, t26 };
  }
  /* Вклад в рост: план H2-26 против факта H2-25 (честная метрика H2-vs-H2) */
  function growth() {
    return items.map(i => ({ it: i, d: money(i, planOf(i)) - money(i, i.f25H2) }))
      .sort((a, b) => b.d - a.d);
  }
  /* Запуск незапущенных новинок: старт, помесячно, кумулятив, стресс сдвига */
  function launches() {
    const L = items.filter(i => i.verdict === 'new' && i.f26H1 === 0 && i.pH2 > 0);
    const rows = L.map(i => {
      let st = -1;
      for (let m = 6; m < 12; m++) if (i.y26[m] > 0) { st = m; break; }
      return { it: i, start: st, mon: i.y26.slice(6), sum: i.pH2 };
    }).sort((a, b) => a.start - b.start);
    const cum = [];
    for (let m = 0; m < 6; m++)
      cum.push(rows.reduce((s, r) => s + sum(r.it.y26, 6, 7 + m), 0));
    const shift1 = rows.reduce((s, r) => s + r.it.y26[11], 0);
    const shift2 = rows.reduce((s, r) => s + r.it.y26[10] + r.it.y26[11], 0);
    return { rows, cum, shift1, shift2 };
  }

  /* Очередность производства по марже + сценарий мощности — формат
     Дашборд_факты_2026 v2.1, возвращён решением пользователя 17.07 (поздно).
     Очереди по марже ₽/шт: ≥2000 → 🥇 1-я · ≥800 → 🥈 2-я · <800 → 🥉 3-я.
     Мощность раздаётся сверху вниз по очереди (greedy).
     Улучшения аудита (минимальные):
     · 🔴🟡 наливаются не выше потолка спроса (⚖-реком. уважается через max);
     · позиция без маржи не выпадает из очереди — идёт в конец с «?»;
     · план/реком-ориентиры считает страница из totals(). */
  const TH1 = 2000, TH2 = 800;
  function prodQueue(mode) {                      // mode: 'unit' | 'vol'
    const L = items.filter(i => i.pH2 > 0).map(i => {
      const pour = (i.verdict === 'red' || i.verdict === 'amber')
        ? Math.min(i.pH2, Math.max(Math.round(i.expHigh || 0), i.recH2))
        : i.pH2;
      return { it: i, mgn: i.margin || 0, plan: i.pH2, pour,
               excess: i.pH2 - pour, vol: (i.margin || 0) * i.pH2, tier: null };
    });
    L.sort((a, b) => (a.mgn === 0 ? 1 : 0) - (b.mgn === 0 ? 1 : 0)
      || (mode === 'vol' ? b.vol - a.vol : b.mgn - a.mgn)
      || b.plan - a.plan);
    /* Медали по метрике режима — всегда монотонны порядку очереди:
       unit — пороги ₽/шт (как v2.1); vol — ABC/Парето по кумулятивной валовой марже
       (🥇 до 50% нарастающим · 🥈 до 80% · 🥉 хвост). Позиция без маржи → tier null. */
    if (mode === 'vol') {
      const tot = L.reduce((s, r) => s + r.vol, 0) || 1;
      let cum = 0;
      L.forEach(r => {
        if (r.mgn === 0) { r.tier = null; return; }
        cum += r.vol; const p = cum / tot;
        r.tier = p <= 0.5 ? 1 : p <= 0.8 ? 2 : 3;
      });
    } else {
      L.forEach(r => { r.tier = r.mgn ? (r.mgn >= TH1 ? 1 : r.mgn >= TH2 ? 2 : 3) : null; });
    }
    return L;
  }

  return { D, items, S, money, planOf, monOf, vOf, ratioOf, fmt, vf, VL, VE, isUnl, vlbl,
           totals, byVerdict, unlaunched, byCat, monthTotals, growth, launches, prodQueue };
})();
