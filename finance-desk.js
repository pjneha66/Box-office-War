/* ═════════════════════════════════════════════════════════════════════════
   FINANCE-DESK.JS — Treasury Desk data layer (Box Office War v38.0)
   ─────────────────────────────────────────────────────────────────────────
   One honest source of truth for every number the Finance tab prints.

   Why this module exists
   ──────────────────────
   The pre-v38 Finance view aggregated the ledger by *bucket* instead of by
   *category*, and it mixed signs inside a bucket:

       rev.merch   += Math.max(0, cats.empire)
       exp.studio  += Math.min(0, cats.studio + cats.empire)

   A single +$30M franchise week therefore landed in revenue *and* cancelled
   out $30M of studio spend, so the desk reported +$115M of profit on a week
   that actually made +$85M. Ten cash categories the engine really writes
   (games, licensing, insurance, training, store, post, nft, legal, expansion,
   comic) were in no bucket at all and simply vanished from the split.

   Every routine here aggregates **per category, per week, split by sign** and
   then rolls the categories into buckets. That makes one invariant hold by
   construction, and `ledgerTrail()` asserts it:

       revenue − expense === Σ weekNet(included weeks)      (financing excluded)

   `financing` is balance-sheet money (loans, IPO, secondary offerings). The
   engine already excludes it from `weekNet()`; this layer does too, but keeps
   it visible as its own total so the desk can show "raised" separately from
   "earned".

   Design rules (matching gamestudio-desk.js)
   ─────────────────────────────────────────
     • Pure and dependency-light: every function takes the state `G`
       explicitly. No DOM, no HTML, no `fmtM` — that lives in the view layer
       (ui.js). The whole module unit-tests in plain Node.
     • Money is in $M (millions), the game's native unit.
     • Nothing is invented. Where the engine does not model something, this
       layer says so rather than printing a plausible constant.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function (global) {
  /* ─────────────────────────── tiny numeric toolkit ─────────────────────── */
  const num = (v, d) => (Number.isFinite(v) ? v : (d || 0));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = (v) => Math.round(num(v, 0) * 10) / 10;
  const round2 = (v) => Math.round(num(v, 0) * 100) / 100;

  function _getG(st) {
    if (st && typeof st === "object" && (st.studio || st.week !== undefined)) return st;
    try { if (typeof G !== "undefined" && G) return G; } catch (e) {}
    if (global && global.G) return global.G;
    if (typeof window !== "undefined" && window.G) return window.G;
    return null;
  }
  const _studio = (G) => (G && G.studio) || { cash: 0, debt: 0, rep: 25, overhead: 0 };

  /* ═══════════════════════════════════════════════════════════════════════
     1. CATEGORY REGISTRY
     Every `earn()`/`spend()` category the engine actually writes, with the
     bucket it rolls up into. A category missing from here used to disappear
     from the Finance tab entirely — `unknownCategory()` now catches that so a
     future category degrades loudly instead of silently.
     ═══════════════════════════════════════════════════════════════════════ */
  const BUCKETS = {
    theatrical:  { id: "theatrical",  label: "Box office",              icon: "🎬", side: "rev" },
    streaming:   { id: "streaming",   label: "Streaming & broadcast",   icon: "📺", side: "rev" },
    licensing:   { id: "licensing",   label: "Licensing & home video",  icon: "📚", side: "rev" },
    empire:      { id: "empire",      label: "Franchise, parks & merch",icon: "🏰", side: "rev" },
    games:       { id: "games",       label: "Game studio",             icon: "🎮", side: "rev" },
    music:       { id: "music",       label: "Music & soundtrack",      icon: "🎵", side: "rev" },
    otherrev:    { id: "otherrev",    label: "Other income",            icon: "❔", side: "rev" },
    production:  { id: "production",  label: "Production & development",icon: "🎥", side: "exp" },
    marketing:   { id: "marketing",   label: "Marketing (P&A)",         icon: "📣", side: "exp" },
    talent:      { id: "talent",      label: "Talent & fees",           icon: "🌟", side: "exp" },
    overhead:    { id: "overhead",    label: "Overhead & payroll",      icon: "🏛", side: "exp" },
    interest:    { id: "interest",    label: "Interest & coupons",      icon: "🏦", side: "exp" },
    investment:  { id: "investment",  label: "Studio & empire builds",  icon: "🏗", side: "exp" },
    otherexp:    { id: "otherexp",    label: "Other costs",             icon: "❕", side: "exp" }
  };
  const BUCKET_ORDER_REV = ["theatrical", "streaming", "licensing", "empire", "games", "music", "otherrev"];
  const BUCKET_ORDER_EXP = ["production", "marketing", "talent", "overhead", "interest", "investment", "otherexp"];

  /* `mixed: true` marks categories the engine both earns and spends. They are
     split by sign *per week per category* — never netted against a sibling.
     `expBucket` declares where that category's *cost* side belongs, so a
     franchise park build never hides inside "Other costs". */
  const CATEGORIES = {
    /* ── revenue ── */
    theatrical:  { label: "Box office rentals",   icon: "🎬", bucket: "theatrical" },
    streaming:   { label: "Streaming deals",      icon: "📺", bucket: "streaming" },
    streamer:    { label: "Own-platform subs",    icon: "📱", bucket: "streaming" },
    pay1:        { label: "Pay-1 TV",             icon: "📡", bucket: "streaming" },
    pvod:        { label: "Premium VOD",          icon: "🏠", bucket: "licensing" },
    video:       { label: "Home video / DTV",     icon: "📀", bucket: "licensing" },
    series:      { label: "Series licences",      icon: "🎞", bucket: "licensing" },
    library:     { label: "Library licensing",    icon: "📚", bucket: "licensing" },
    licensing:   { label: "Rights licensing",     icon: "📜", bucket: "licensing" },
    presales:    { label: "Intl pre-sales",       icon: "🌍", bucket: "otherrev" },
    incentives:  { label: "Production incentives",icon: "🧾", bucket: "otherrev" },
    cofinance:   { label: "Co-finance in",        icon: "🤝", bucket: "otherrev" },
    nft:         { label: "Collectibles",         icon: "🖼", bucket: "otherrev" },
    /* v38.0: the second census. These were reaching the ledger from the linear
       TV, territory-royalty, concessions, game-publishing and guild systems and
       were being reported as "(unmapped)" — and worse, silently dropped from
       the profit figure (see _rollBuckets). */
    linearTv:    { label: "Linear TV & syndication", icon: "📡", bucket: "streaming" },
    boxoffice:   { label: "Territory royalties",  icon: "🌍", bucket: "licensing" },
    merch:       { label: "Concessions & merch",  icon: "🍿", bucket: "empire" },
    game_revenue:{ label: "Game royalties",       icon: "🕹", bucket: "games" },
    game_sales:  { label: "Game sales",           icon: "🎮", bucket: "games" },
    /* ── mixed (revenue or cost depending on the week) ── */
    empire:      { label: "Franchise & parks",    icon: "🏰", bucket: "empire",  expBucket: "investment", mixed: true },
    games:       { label: "Game studio",          icon: "🎮", bucket: "games",   expBucket: "production", mixed: true },
    music:       { label: "Soundtrack & label",   icon: "🎵", bucket: "music",   expBucket: "otherexp",   mixed: true },
    stage:       { label: "Stage division",       icon: "🎭", bucket: "empire",  expBucket: "investment", mixed: true },
    insurance:   { label: "Insurance",            icon: "🛡", bucket: "otherrev",expBucket: "otherexp",   mixed: true },
    other:       { label: "Other",                icon: "❓", bucket: "otherrev",expBucket: "otherexp",   mixed: true },
    /* ── costs ── */
    production:  { label: "Production spend",     icon: "🎥", bucket: "production" },
    development: { label: "Development",          icon: "📝", bucket: "production" },
    post:        { label: "Post & re-edit",       icon: "✂️", bucket: "production" },
    marketing:   { label: "Marketing (P&A)",      icon: "📣", bucket: "marketing" },
    talent:      { label: "Talent & fees",        icon: "🌟", bucket: "talent" },
    overhead:    { label: "Overhead",             icon: "🏛", bucket: "overhead" },
    training:    { label: "Training",             icon: "🎓", bucket: "overhead" },
    interest:    { label: "Interest",             icon: "🏦", bucket: "interest" },
    studio:      { label: "Studio investment",    icon: "🏗", bucket: "investment" },
    expansion:   { label: "Expansion",            icon: "🧱", bucket: "investment" },
    store:       { label: "Studio store",         icon: "🛍", bucket: "investment" },
    comic:       { label: "Comics & publishing",  icon: "💥", bucket: "investment" },
    legal:       { label: "Legal & crises",       icon: "⚖️", bucket: "otherexp" },
    guild_dues:  { label: "Guild dues",           icon: "🤝", bucket: "talent" },
    anti_piracy: { label: "Anti-piracy enforcement", icon: "🛡", bucket: "otherexp" },
    /* Balance-sheet money. Listed so it renders with a real label and icon
       rather than "(unmapped)", but every P&L path short-circuits on
       FINANCING_CAT before it can reach a bucket — exactly like weekNet(). */
    financing:   { label: "Financing flows",      icon: "🏦", bucket: "otherrev", financing: true }
  };
  /* Balance-sheet money. Deliberately outside the P&L, exactly like weekNet(). */
  const FINANCING_CAT = "financing";

  const unknownCategory = (k) => ({ label: String(k), icon: "❓", bucket: "otherexp", unknown: true });
  const categoryOf = (k) => CATEGORIES[k] || unknownCategory(k);
  const categoryLabel = (k) => {
    const c = categoryOf(k);
    return (c.icon ? c.icon + " " : "") + c.label + (c.unknown ? " (unmapped)" : "");
  };
  /* Every distinct category present in the ledger, so the desk's filter chips
     are built from real data rather than a hardcoded list. */
  function categoriesPresent(G) {
    const g = _getG(G); if (!g) return [];
    const seen = new Set();
    const tx = g.weekTx || {};
    Object.keys(tx).forEach((k) => { if (num(tx[k])) seen.add(k); });
    (g.txHistory || []).forEach((w) => Object.keys((w && w.cats) || {}).forEach((k) => { if (num(w.cats[k])) seen.add(k); }));
    return [...seen].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     2. TRAILING LEDGER — the honest rollup
     ═══════════════════════════════════════════════════════════════════════ */
  /* Per category, per week, split by sign. Nothing is netted across
     categories, so revenue can never cancel somebody else's cost. */
  function _foldWeeks(weeks) {
    const byCat = {};                      /* cat -> {rev, exp} */
    const ensure = (k) => (byCat[k] || (byCat[k] = { rev: 0, exp: 0 }));
    (weeks || []).forEach((w) => {
      const cats = (w && w.cats) || {};
      Object.keys(cats).forEach((k) => {
        const v = num(cats[k], 0);
        if (!v) return;
        if (k === FINANCING_CAT) { ensure(FINANCING_CAT).rev += Math.max(0, v); ensure(FINANCING_CAT).exp += Math.min(0, v); return; }
        const slot = ensure(k);
        if (v > 0) slot.rev += v; else slot.exp += v;
      });
    });
    return byCat;
  }
  /* Resolve the bucket a category's `side` posts to.
     This is the guard that makes the P&L impossible to short by a category.
     `unknownCategory()` deliberately names an expense bucket, so an unmapped
     category that EARNED money used to be written to `rev["otherexp"]` — a key
     that is not in BUCKET_ORDER_REV and therefore never summed into R. The
     money left the profit figure entirely and only the reconciliation warning
     caught it. Declared buckets are still honoured when their side matches, so
     a park build remains an investment and game spend remains production. */
  function _bucketFor(meta, side) {
    const wantRev = side === "rev";
    const fallback = wantRev ? "otherrev" : "otherexp";
    const declared = wantRev
      ? meta.bucket
      : ((BUCKETS[meta.bucket] && BUCKETS[meta.bucket].side === "exp")
          ? meta.bucket
          : (meta.expBucket || fallback));
    const b = BUCKETS[declared];
    /* If the declared bucket is missing or sits on the other side, the money
       still has to land on THIS side's catch-all — never on a key that is not
       summed into the totals. */
    if (!b || b.side !== side) return fallback;
    return declared;
  }

  function _rollBuckets(byCat) {
    const rev = {}, exp = {};
    BUCKET_ORDER_REV.forEach((b) => (rev[b] = 0));
    BUCKET_ORDER_EXP.forEach((b) => (exp[b] = 0));
    const catRows = [];
    Object.keys(byCat).forEach((k) => {
      const meta = categoryOf(k), slot = byCat[k];
      /* Balance-sheet money stays out of the P&L entirely, matching weekNet().
         Keyed off the category's own `financing` marker as well as the constant
         so a future financing-style category cannot leak into profit. */
      if (k === FINANCING_CAT || meta.financing) return;
      /* A mixed category can post to a revenue bucket and still incur cost;
         each side lands in the bucket that matches its sign, so the buckets
         keep their side and the totals keep reconciling. */
      if (slot.rev) {
        const rb = _bucketFor(meta, "rev");
        rev[rb] = num(rev[rb], 0) + slot.rev;
      }
      if (slot.exp) {
        const eb = _bucketFor(meta, "exp");
        exp[eb] = num(exp[eb], 0) + slot.exp;
      }
      catRows.push({ cat: k, label: categoryLabel(k), rev: round1(slot.rev), exp: round1(slot.exp), net: round1(slot.rev + slot.exp), unknown: !!meta.unknown });
    });
    return { rev, exp, catRows };
  }

  /* Trailing ledger over the last `weeks` snapshots (the engine keeps 12). */
  function ledgerTrail(G, weeks) {
    const g = _getG(G);
    const hist = (g && g.txHistory) || [];
    const n = clamp(Math.round(num(weeks, hist.length || 12)) || hist.length || 12, 1, Math.max(1, hist.length));
    const slice = hist.slice(-n);
    const byCat = _foldWeeks(slice);
    const rolled = _rollBuckets(byCat);

    const fin = byCat[FINANCING_CAT] || { rev: 0, exp: 0 };
    const R = round1(BUCKET_ORDER_REV.reduce((a, b) => a + num(rolled.rev[b]), 0));
    const E = round1(-BUCKET_ORDER_EXP.reduce((a, b) => a + num(rolled.exp[b]), 0));   /* positive magnitude */
    const P = round1(R - E);
    const netSum = round1(slice.reduce((a, w) => a + num(w && w.net, 0), 0));
    const raised = round1(fin.rev), repaid = round1(-fin.exp);

    const buckets = {
      rev: BUCKET_ORDER_REV.map((b) => ({ id: b, label: BUCKETS[b].label, icon: BUCKETS[b].icon, amount: round1(rolled.rev[b]) })).filter((b) => Math.abs(b.amount) >= 0.05),
      exp: BUCKET_ORDER_EXP.map((b) => ({ id: b, label: BUCKETS[b].label, icon: BUCKETS[b].icon, amount: round1(-rolled.exp[b]) })).filter((b) => Math.abs(b.amount) >= 0.05)
    };

    return {
      weeks: slice.length,
      rev: buckets.rev, exp: buckets.exp,
      categories: rolled.catRows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
      R, E, P,
      margin: R > 0 ? round1((P / R) * 1000) / 10 : null,
      financing: { raised, repaid, net: round1(raised - repaid) },
      /* The reconciliation the pre-v38 desk failed. `delta` must be ~0. */
      reconcile: { reported: P, ledgerNet: netSum, delta: round1(P - netSum), ok: Math.abs(P - netSum) < 0.15 },
      unmapped: rolled.catRows.filter((r) => r.unknown).map((r) => r.cat)
    };
  }

  /* One week's P&L, already split, with financing kept apart. */
  function ledgerWeek(G) {
    const g = _getG(G);
    const tx = (g && g.weekTx) || {};
    const inc = [], cost = [];
    let financing = 0;
    Object.keys(tx).forEach((k) => {
      const v = num(tx[k], 0);
      if (Math.abs(v) < 0.05) return;
      if (k === FINANCING_CAT) { financing = round1(v); return; }
      const row = { cat: k, label: categoryLabel(k), amount: round1(v) };
      (v > 0 ? inc : cost).push(row);
    });
    inc.sort((a, b) => b.amount - a.amount);
    cost.sort((a, b) => a.amount - b.amount);
    const net = round1(inc.reduce((a, r) => a + r.amount, 0) + cost.reduce((a, r) => a + r.amount, 0));
    return { income: inc, costs: cost, financing, net, empty: !inc.length && !cost.length && !financing };
  }

  /* Net-by-week series for the sparkline bars. */
  function ledgerSeries(G, weeks) {
    const g = _getG(G);
    const hist = ((g && g.txHistory) || []).slice(-(clamp(Math.round(num(weeks, 12)) || 12, 1, 52)));
    return hist.map((w) => ({ week: num(w && w.week, 0), net: round1(w && w.net) }));
  }

  /* Transaction rows for the searchable ledger, newest first. */
  function ledgerRows(G, opts) {
    const g = _getG(G);
    const o = opts || {};
    const q = String(o.q || "").trim().toLowerCase();
    const cat = o.cat && o.cat !== "all" ? String(o.cat) : null;
    const side = o.side || "all";                       /* all | in | out */
    const limit = clamp(Math.round(num(o.limit, 120)) || 120, 1, 600);
    const hist = (g && g.txHistory) || [];
    const rows = [];
    for (let i = hist.length - 1; i >= 0; i--) {
      const w = hist[i] || {};
      const cats = w.cats || {};
      Object.keys(cats).forEach((k) => {
        const v = num(cats[k], 0);
        if (Math.abs(v) < 0.05) return;
        if (k === FINANCING_CAT && side !== "all" && o.hideFinancing) return;
        if (cat && k !== cat) return;
        if (side === "in" && v < 0) return;
        if (side === "out" && v > 0) return;
        const meta = categoryOf(k);
        const label = categoryLabel(k);
        if (q && !label.toLowerCase().includes(q) && !k.toLowerCase().includes(q)) return;
        rows.push({ week: num(w.week, 0), cat: k, label, icon: meta.icon, amount: round1(v), financing: k === FINANCING_CAT });
      });
    }
    const total = rows.length;
    return { rows: rows.slice(0, limit), total, truncated: total > limit, matchedCats: [...new Set(rows.map((r) => r.cat))] };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     3. COMMITTED OBLIGATIONS — what the studio already owes
     ═══════════════════════════════════════════════════════════════════════ */
  /* ── engine function resolution ──────────────────────────────────────────
     The desk reads the engine's own rate/valuation functions so the two can
     never disagree. In the browser these are classic-script globals; under a
     Node test harness the host calls `attachEngine({...})` to inject them.
     Every lookup degrades to a declared fallback rather than throwing. */
  const _injected = {};
  function attachEngine(map) { Object.assign(_injected, map || {}); return API; }
  function engineFn(name) {
    if (typeof _injected[name] === "function") return _injected[name];
    if (global && typeof global[name] === "function") return global[name];
    return null;
  }
  function _engine(name, fallback) {
    const fn = typeof name === "function" ? name : engineFn(name);
    try { if (typeof fn === "function") { const v = fn(); return Number.isFinite(v) ? v : fallback; } } catch (e) {}
    return fallback;
  }
  function ledgerCommit(G) {
    const g = _getG(G); if (!g) return null;
    const st = _studio(g);
    const week = num(g.week, 1);
    let prod = 0, mkt = 0;
    const projects = [];
    (g.projects || []).forEach((p) => {
      if (!p) return;
      const remain = Math.max(0, num(p.budget) - num(p.spent));
      const due = (p.releaseWeek && p.releaseWeek >= week) ? Math.max(0, num(p.marketing) - num(p.marketingPaid)) : 0;
      prod += remain; mkt += due;
      if (remain > 0.05 || due > 0.05) projects.push({ title: String(p.title || "Untitled"), phase: String(p.phase || ""), remain: round1(remain), mktDue: round1(due), releaseWeek: num(p.releaseWeek, 0) || null });
    });
    const seriesRows = [];
    /* The pre-v38 desk only counted series in the "shoot" phase and carried a
       dead `mktDue += 0` no-op. Every unfinished phase burns cash. */
    (g.series || []).forEach((s) => {
      if (!s || s.status === "ended") return;
      const active = ["pre", "shoot", "post"].indexOf(s.phase) >= 0;
      if (!active) return;
      const remain = Math.max(0, num(s.budget) - num(s.spent));
      if (remain <= 0.05) return;
      prod += remain;
      seriesRows.push({ title: String(s.title || "Untitled"), phase: String(s.phase || ""), remain: round1(remain) });
    });

    const bankDebt = round1(num(st.debt));
    const mezz = round1(num(st.mezzDebt) || num(g.mezz));
    const investor = round1(num(g.investorDebt));
    const bonds = (g.bonds && g.bonds.activeBonds) || [];
    const bondPrincipal = round1(bonds.reduce((a, b) => a + num(b && b.principal), 0));
    const bondCoupon = round2(bonds.reduce((a, b) => a + num(b && b.weeklyCoupon), 0));

    /* Read the engine's own rate functions so the desk and the weekly tick can
       never disagree. The pre-v38 view hardcoded 0.0018 here, which ignored
       the CFO's 30% discount and contradicted the run-rate on the same page. */
    const bankRate = _engine("interestRate", 0.0018);
    const mezzRate = 0.005;
    const bankInterest = round2(bankDebt * bankRate);
    const mezzInterest = round2(mezz * mezzRate);
    const investorWeekly = investor > 0 ? 2.5 : 0;      /* engine retires $2.5M/wk */
    const overhead = round2(_engine("weeklyOverhead", num(st.overhead)));
    const interest = round2(bankInterest + mezzInterest + bondCoupon);

    const debtTotal = round1(bankDebt + mezz + investor + bondPrincipal);
    const limit = round1(_engine("maxDebt", 150));
    const headroom = round1(limit - bankDebt);

    /* Mezzanine capacity.
       The pre-v38 desk offered a slider hardcoded min=10 max=200 while
       mezzanineLoan() has no cap at all — so the ceiling was invented, it bore
       no relation to the studio's size, and a $3M indie was offered the same
       $200M of emergency money as a major. Rule used here: mezzanine is a
       junior tranche and may reach half the SENIOR facility, which the engine
       already sizes from catalogue value and committed production budgets
       (maxDebt()). That keeps it expensive-but-available for a real studio and
       out of reach for one that cannot service it. */
    const mezzCapTotal = round1(_engine("mezzCapTotal", limit * 0.5));
    /* Prefer the engine's own headroom so the desk and mezzanineLoan() can never
       disagree about what is available; the local rule is only the fallback for
       builds that predate mezzCap(). */
    const mezzHeadroom = round1(Math.max(0, _engine("mezzCap", mezzCapTotal - mezz)));
    const mezzSlider = mezzHeadroom >= 10
      ? (() => {
          const max = Math.max(10, Math.floor(mezzHeadroom / 10) * 10);
          return { min: 10, max, step: 10, value: clamp(50, 10, max) };
        })()
      : null;

    return {
      prod: round1(prod), mkt: round1(mkt),
      projects: projects.sort((a, b) => b.remain - a.remain),
      series: seriesRows.sort((a, b) => b.remain - a.remain),
      debt: { bank: bankDebt, mezz, investor, bonds: bondPrincipal, total: debtTotal },
      rates: { bank: bankRate, mezz: mezzRate, bondCoupon },
      weekly: { overhead, interest, bankInterest, mezzInterest, bondCoupon, investor: investorWeekly, burn: round2(overhead + interest + investorWeekly) },
      credit: { limit, headroom, used: limit > 0 ? clamp(bankDebt / limit, 0, 1) : 0 },
      mezz: {
        capTotal: mezzCapTotal,
        drawn: mezz,
        headroom: mezzHeadroom,
        slider: mezzSlider,
        rate: mezzRate,
        /* the reason is stated on screen, so the cap is never a mystery */
        note: mezzSlider
          ? "Capped at half the " + _money(limit) + " senior facility — " + _money(mezz) + " drawn, " + _money(mezzHeadroom) + " left."
          : (mezz > 0
              ? "Mezzanine is capped at half the " + _money(limit) + " senior facility (" + _money(mezzCapTotal) + "). You have drawn " + _money(mezz) + ", so the tranche is full."
              : "No mezzanine capacity: half of the " + _money(limit) + " senior facility is under " + _money(10) + ". Grow the catalogue or the bank line first."),
        weeklyCostAt: (amt) => round2(num(amt) * mezzRate)
      },
      investorWeeksLeft: investor > 0 ? Math.ceil(investor / 2.5) : 0
    };
  }

  /* Balance-sheet money: what the studio owns minus what it owes. */
  function balanceSheet(G) {
    const g = _getG(G); if (!g) return null;
    const st = _studio(g);
    const c = ledgerCommit(g) || {};
    const catalog = round1(_engine("catalogValue", 0));
    const cash = round1(num(st.cash));
    const debt = round1(num((c.debt || {}).total));
    const marketCap = g.public ? round1(_engine("marketCap", 0)) : null;
    const equity = round1(cash + catalog - debt);
    return {
      cash, catalog, debt, equity, marketCap,
      netCash: round1(cash - debt),
      leverage: equity !== 0 ? round2(debt / Math.max(1, equity)) : null,
      listed: !!g.public
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     4. DEBT MATURITY LADDER
     The pre-v38 "maturity schedule" printed "Due Year N+1 · balloon
     settlement" for mezzanine debt that the engine never actually matures.
     This ladder only lists instruments with a real settlement mechanic, and
     says plainly when one rolls indefinitely.
     ═══════════════════════════════════════════════════════════════════════ */
  function maturityLadder(G) {
    const g = _getG(G); if (!g) return [];
    const st = _studio(g);
    const week = num(g.week, 1);
    const out = [];
    if (num(st.debt) > 0.05) {
      out.push({
        id: "bank", name: "Bank credit facility", principal: round1(st.debt),
        weeklyCost: round2(num(st.debt) * _engine("interestRate", 0.0018)),
        maturesWeek: null, maturity: "Revolving — rolls weekly, callable at par",
        kind: "revolver"
      });
    }
    const mezz = num(st.mezzDebt) || num(g.mezz);
    if (mezz > 0.05) {
      out.push({
        id: "mezz", name: "Mezzanine loan", principal: round1(mezz), weeklyCost: round2(mezz * 0.005),
        maturesWeek: null, maturity: "No fixed maturity — interest only until you repay",
        kind: "mezzanine"
      });
    }
    const inv = num(g.investorDebt);
    if (inv > 0.05) {
      const wks = Math.ceil(inv / 2.5);
      out.push({
        id: "investor", name: "Investor buyout", principal: round1(inv), weeklyCost: 2.5,
        maturesWeek: week + wks, maturity: "Auto-retires $" + 2.5 + "M/wk — clear in ~" + wks + " week" + (wks === 1 ? "" : "s"),
        kind: "investor"
      });
    }
    ((g.bonds && g.bonds.activeBonds) || []).forEach((b, i) => {
      if (!b) return;
      const left = clamp(Math.round(num(b.weeksRemaining)), 0, 9999);
      out.push({
        id: "bond_" + i, name: String(b.seriesName || "Corporate notes"), principal: round1(num(b.principal)),
        weeklyCost: round2(num(b.weeklyCoupon)), grade: String(b.creditGrade || ""),
        maturesWeek: week + left, maturity: left > 0 ? "Balloon in " + left + " week" + (left === 1 ? "" : "s") : "At maturity",
        kind: "bond"
      });
    });
    /* nearest settlement first; perpetuals last */
    out.sort((a, b) => {
      if (a.maturesWeek == null && b.maturesWeek == null) return b.principal - a.principal;
      if (a.maturesWeek == null) return 1;
      if (b.maturesWeek == null) return -1;
      return a.maturesWeek - b.maturesWeek;
    });
    return out;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     5. RUNWAY & COVENANTS — treasury alerts
     ═══════════════════════════════════════════════════════════════════════ */
  /* Weeks of cash left at the current fixed burn, ignoring future revenue.
     Deliberately pessimistic and labelled as such in the view. */
  function runway(G) {
    const g = _getG(G); if (!g) return null;
    const st = _studio(g);
    const c = ledgerCommit(g);
    const burn = num(c && c.weekly && c.weekly.burn, 0);
    const cash = num(st.cash);
    const trail = ledgerTrail(g, 4);
    const actualBurn = trail.weeks > 0 ? round2(Math.max(0, (trail.E - trail.R) / trail.weeks)) : 0;
    const rate = Math.max(burn, actualBurn);
    return {
      cash: round1(cash),
      fixedBurn: round2(burn),
      trailingBurn: actualBurn,
      weeks: rate > 0.05 ? Math.max(0, Math.floor(cash / rate)) : Infinity,
      /* a film in production burns far more than the fixed run-rate */
      productionBurn: round2(num(c && c.prod, 0)),
      insolvent: cash <= 0
    };
  }

  /* Honest treasury alerts. Each one names the number that triggered it. */
  function covenantChecks(G) {
    const g = _getG(G); if (!g) return [];
    const st = _studio(g);
    const c = ledgerCommit(g); if (!c) return [];
    const out = [];
    const cash = num(st.cash), headroom = num(c.credit.headroom);
    const run = runway(g);
    if (cash < 0) out.push({ level: "critical", title: "Overdrawn treasury", detail: "Cash is " + _money(cash) + ". The studio cannot meet payroll — take mezzanine money or sell an asset this week." });
    else if (run && Number.isFinite(run.weeks) && run.weeks <= 2) out.push({ level: "critical", title: "Runway under 3 weeks", detail: "At the current " + _money(run.fixedBurn) + "/wk fixed burn, cash covers ~" + run.weeks + " week" + (run.weeks === 1 ? "" : "s") + ". Revenue is not counted here." });
    else if (run && Number.isFinite(run.weeks) && run.weeks <= 6) out.push({ level: "warn", title: "Thin runway", detail: "~" + run.weeks + " weeks of cash at the fixed burn of " + _money(run.fixedBurn) + "/wk." });
    if (headroom < 0) out.push({ level: "critical", title: "Credit facility overdrawn", detail: "Bank debt " + _money(c.debt.bank) + " exceeds the " + _money(c.credit.limit) + " limit by " + _money(-headroom) + ". The bank will not extend more." });
    else if (headroom < 20) out.push({ level: "warn", title: "Little credit headroom", detail: "Only " + _money(headroom) + " left on a " + _money(c.credit.limit) + " facility." });
    if (num(c.debt.mezz) > 0.05) out.push({ level: "warn", title: "Mezzanine debt outstanding", detail: _money(c.debt.mezz) + " at 0.5%/wk (" + _money(c.weekly.mezzInterest) + "/wk) — roughly 26% a year. Retire it first." });
    if (num(c.weekly.interest) > 0.05 && num(c.weekly.overhead) > 0 && c.weekly.interest > c.weekly.overhead) out.push({ level: "warn", title: "Interest exceeds overhead", detail: "Debt service " + _money(c.weekly.interest) + "/wk is larger than the " + _money(c.weekly.overhead) + "/wk studio run-rate." });
    if (num(c.prod) > 0 && cash < num(c.prod) * 0.35) out.push({ level: "info", title: "Committed production exceeds cover", detail: _money(c.prod) + " of production is still to spend against " + _money(cash) + " of cash. Pre-sales or co-finance would de-risk it." });
    const trail = ledgerTrail(g, 4);
    if (trail.weeks >= 3 && trail.P < 0) out.push({ level: "warn", title: "Trailing loss", detail: "The last " + trail.weeks + " weeks netted " + _money(trail.P) + " (" + trail.margin + "% margin)." });
    if (!out.length) out.push({ level: "ok", title: "Treasury healthy", detail: "Cash " + _money(cash) + ", headroom " + _money(headroom) + ", no covenant breached." });
    return out;
  }
  function _money(v) {
    const n = num(v, 0);
    const s = Math.abs(n) >= 1000 ? (Math.abs(n) / 1000).toFixed(2) + "B" : Math.abs(n).toFixed(1) + "M";
    return (n < 0 ? "−$" : "$") + s;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     6. CREDIT RATING — read from the bond market, never hardcoded
     The pre-v38 Kairo banner printed "AAA Investment" and "+34.8% RoIC" as
     string literals for every studio, including a bankrupt one.
     ═══════════════════════════════════════════════════════════════════════ */
  function creditRating(G) {
    const g = _getG(G); if (!g) return null;
    let tier = null;
    try {
      const rate = engineFn("getStudioCreditRating")
        || (global && global.BondMarketModule && typeof global.BondMarketModule.getStudioCreditRating === "function"
            ? global.BondMarketModule.getStudioCreditRating : null);
      if (typeof rate === "function") tier = rate(g);
    } catch (e) { tier = null; }
    const st = _studio(g);
    const trail = ledgerTrail(g, 12);
    const bs = balanceSheet(g) || {};
    if (!tier) {
      /* The bond module is not loaded — derive the same thresholds locally so
         the desk still tells the truth instead of falling back to a literal. */
      const eq = num(st.cash) - (num(st.debt) + num(st.mezzDebt)), rep = num(st.rep, 25);
      tier = (eq >= 150 && rep >= 70) ? { grade: "AAA", coupon: 0.045, name: "Prime Investment Grade" }
        : (eq >= 80 && rep >= 55) ? { grade: "AA", coupon: 0.060, name: "High Grade Investment" }
        : (eq >= 20 && rep >= 40) ? { grade: "BBB", coupon: 0.085, name: "Medium Grade Corporate" }
        : (eq >= -10 && rep >= 25) ? { grade: "BB", coupon: 0.125, name: "Speculative High-Yield" }
        : { grade: "CCC", coupon: 0.180, name: "Substantial Risk / Distressed" };
    }
    return {
      grade: String(tier.grade || "BBB"), name: String(tier.name || ""),
      coupon: num(tier.coupon, 0.085),
      marginPct: trail.R > 0 ? round1((trail.P / trail.R) * 1000) / 10 : null,
      /* A trailing 12-week return on book equity. Deliberately NOT labelled
         "RoIC" — the engine has no annualised invested-capital figure, and the
         pre-v38 banner printed a hardcoded "+34.8% RoIC" for every studio. */
      roeTrailPct: num(bs.equity) > 0 ? round1((trail.P / bs.equity) * 1000) / 10 : null,
      bookEquity: round1(num(bs.equity)),
      investmentGrade: ["AAA", "AA", "BBB"].indexOf(String(tier.grade)) >= 0
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     7. STRESS TEST — deterministic shocks over the engine's own forecast
     Takes the itemised forecast rows the engine already produces and re-runs
     them under a shock. No new economy, no invented coefficients: the shock is
     applied to the labelled revenue/cost items and the arithmetic is shown.
     ═══════════════════════════════════════════════════════════════════════ */
  const STRESS_PRESETS = [
    { id: "base",     label: "As forecast",        rev: 0,     exp: 0,     note: "The engine's own 12-week projection, unshocked." },
    { id: "softopen", label: "Soft openings −25%", rev: -0.25, exp: 0,     note: "Every rental and licence line lands a quarter light." },
    { id: "flop",     label: "Slate flops −50%",   rev: -0.50, exp: 0,     note: "Half the projected revenue disappears; costs are already committed." },
    { id: "overrun",  label: "Cost overrun +20%",  rev: 0,     exp: 0.20,  note: "Burns, P&A and overhead all run a fifth over." },
    { id: "squeeze",  label: "Credit squeeze",     rev: -0.25, exp: 0.20,  note: "Light revenue into rising costs — the classic bust." }
  ];
  /* Classify a forecast item as revenue or cost from its signed amount, so the
     shock lands on the right side. */
  function _isRevenueItem(item) { return num(item && item.amt) > 0; }
  function stressForecast(G, opts) {
    const g = _getG(G); if (!g) return null;
    const o = opts || {};
    const preset = STRESS_PRESETS.find((p) => p.id === o.preset) || STRESS_PRESETS[0];
    const revShock = Number.isFinite(o.rev) ? o.rev : preset.rev;
    const expShock = Number.isFinite(o.exp) ? o.exp : preset.exp;
    let rows = [];
    const fc = engineFn("cashflowForecast");
    try { rows = (typeof fc === "function" ? fc() : []) || []; } catch (e) { rows = []; }
    if (!rows.length) return { preset: preset.id, rows: [], ok: false, reason: "The forecast engine returned no rows." };

    let cash = num(_studio(g).cash);
    let min = cash, insolventWeek = null;
    const out = rows.map((r, i) => {
      /* Prefer the exact split the forecast carries. Older builds only exposed
         the display-filtered `items`, so fall back to re-deriving it and
         carrying the residue, which keeps the shocked run anchored to the
         engine's own net either way. */
      let rev, cost;
      if (Number.isFinite(r && r.rev) && Number.isFinite(r && r.cost)) {
        rev = num(r.rev); cost = num(r.cost);
      } else {
        const items = (r && r.items) || [];
        rev = items.filter(_isRevenueItem).reduce((a, x) => a + num(x.amt), 0);
        cost = items.filter((x) => !_isRevenueItem(x)).reduce((a, x) => a + num(x.amt), 0);
      }
      const residue = num(r && r.net) - (rev + cost);
      const shocked = rev * (1 + revShock) + cost * (1 + expShock) + residue;
      cash += shocked;
      if (cash < min) min = cash;
      if (insolventWeek == null && cash < 0) insolventWeek = num(r && r.w, i + 1);
      return { week: num(r && r.w, i + 1), net: round1(shocked), cash: round1(cash), rev: round1(rev * (1 + revShock)), cost: round1(cost * (1 + expShock)) };
    });
    return {
      preset: preset.id, presetLabel: preset.label, note: preset.note,
      revShock, expShock, rows: out, ok: true,
      endCash: round1(cash), minCash: round1(min), insolventWeek,
      totalNet: round1(out.reduce((a, r) => a + r.net, 0))
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     8. DESK STATE — persisted on G.finState, mirroring G.libState
     ═══════════════════════════════════════════════════════════════════════ */
  const SECTIONS = [
    ["ledger", "Ledger"],
    ["capital", "Capital & debt"],
    ["forecast", "Forecast & risk"],
    ["equity", "Equity & markets"],
    ["deals", "M&A vault"],
    ["analysis", "Analysis lab"],
    ["board", "Board & people"],
    ["invest", "Investments"]
  ];
  const LEDGER_RANGES = [[4, "4 weeks"], [8, "8 weeks"], [12, "12 weeks"]];

  function ensure(G) {
    const g = _getG(G);
    const base = { sub: "ledger", q: "", cat: "all", side: "all", weeks: 12, stress: "base", currency: null };
    if (!g) return base;
    if (!g.finState || typeof g.finState !== "object") g.finState = {};
    const s = g.finState;
    if (!SECTIONS.some((x) => x[0] === s.sub)) s.sub = "ledger";
    if (typeof s.q !== "string") s.q = "";
    if (typeof s.cat !== "string" || !s.cat) s.cat = "all";
    if (["all", "in", "out"].indexOf(s.side) < 0) s.side = "all";
    if (!LEDGER_RANGES.some((r) => r[0] === s.weeks)) s.weeks = 12;
    if (!STRESS_PRESETS.some((p) => p.id === s.stress)) s.stress = "base";
    return s;
  }
  const subOf = (G) => ensure(G).sub;

  /* ═══════════════════════════════════════════════════════════════════════
     9. PUBLIC API
     ═══════════════════════════════════════════════════════════════════════ */
  const API = {
    version: "38.0",
    BUCKETS, BUCKET_ORDER_REV, BUCKET_ORDER_EXP, CATEGORIES, FINANCING_CAT,
    SECTIONS, LEDGER_RANGES, STRESS_PRESETS,
    ensure, subOf,
    categoryOf, categoryLabel, categoriesPresent,
    attachEngine, engineFn,
    ledgerTrail, ledgerWeek, ledgerSeries, ledgerRows, ledgerCommit,
    balanceSheet, maturityLadder, runway, covenantChecks, creditRating,
    stressForecast,
    /* exported for the regression suite */
    _internals: { foldWeeks: _foldWeeks, rollBuckets: _rollBuckets, money: _money }
  };
  global.FinanceDesk = API;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
