/* Contract harness for the Business & Industry module (game/biz.js).
   Mirrors test/rebuild-sim.mjs: data.js + engine.js + biz.js in a VM sandbox
   with a stubbed localStorage. ui.js is NOT loaded (it touches the DOM), so
   the two ui helpers biz.js calls inside desk renders (`tag`, `statrow`) and
   the optional post-action `render`/`drainFlash` calls are stubbed in the
   sandbox before those paths run. Everything else runs for real. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let pass = 0;
function check(label, cond) {
  if (!cond) throw new Error("ASSERT FAILED: " + label);
  pass++;
  console.log("  ✓ " + label);
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-9 : eps); }

const realRandom = Math.random;
function makeCtx() {
  const mem = {};
  return {
    console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
    Number, String, Object, Array, Promise,
    navigator: {},
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    }
  };
}

const ctx = makeCtx();
vm.createContext(ctx);
for (const f of ["data.js", "engine.js", "biz.js"])
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });

const S = () => ctx.S;
const btn = (attrs) => ({
  getAttribute: (k) => {
    const v = attrs[k] != null ? attrs[k] : attrs[k.replace("data-", "")];
    return v == null ? null : String(v);
  }
});
function withRandom(v, fn) {
  ctx.Math.random = typeof v === "function" ? v : () => v;
  try { fn(); } finally { ctx.Math.random = realRandom; }
}
function addCash(x) { S().studio.cash = Math.round((S().studio.cash + x) * 10) / 10; }
/* deterministic tickBiz: no quarterly review, no confidence bonus, no austerity */
function neutralizeBoard() {
  S().studio.week = Math.floor(S().studio.week / 52) * 52 + 10;
  S().studio.woy = 10;
  S().biz.board.conf = 60;
  S().biz.board.offer = null;
  S().biz.board.mandate = null;
}

try {
  /* ── module shape ─────────────────────────────────────────────── */
  console.log("module shape");
  for (const fn of ["tickBiz", "bizAction", "bizOpenMult", "bizQualityBonus", "bizIntlBonus",
    "bizLocationMods", "espAnnounceWindow", "presaleShare", "ensure",
    "imprintOpeningMult", "imprintCriticBonus", "espionageSuppression",
    "bizEspOp", "bizFileEsg", "bizBuyImprint", "bizSellPresale", "bizInsure"])
    check("defines " + fn + "()", typeof ctx[fn] === "function");
  check("defines BIZ_DESKS array", Array.isArray(ctx.BIZ_DESKS) && ctx.BIZ_DESKS.length >= 8);
  check("desk ids unique", new Set(ctx.BIZ_DESKS.map((d) => d.id)).size === ctx.BIZ_DESKS.length);
  check("every desk has icon/name/desc/render", ctx.BIZ_DESKS.every((d) => d.icon && d.name && d.desc && typeof d.render === "function"));
  check("wave-3 tables exist (tiers/regions/terms/targets/imprints/ops)",
    ctx.BIZ_INS_TIERS.length === 3 && ctx.BIZ_REGIONS.length === 4 && ctx.BIZ_TERMS.length === 4
    && ctx.BIZ_ESG_TARGETS.length === 3 && ctx.BIZ_IMPRINTS.length === 3 && ctx.BIZ_OPS.intel && ctx.BIZ_OPS.leak);

  /* ── new game + lazy ensure ───────────────────────────────────── */
  ctx.newGame("Biz Test", "veteran");
  ctx.ensure();
  console.log("state namespace");
  const b0 = S().biz;
  check("S.biz exists after ensure()", !!b0);
  check("board defaults {conf:60}", b0.board && b0.board.conf === 60 && b0.board.mandate === null);
  check("chains default rel 50, no imax", b0.chains.rel === 50 && b0.chains.imax === false && b0.chains.eventWk === 0);
  check("esp level 0, stock 10, programs off", b0.esp.level === 0 && b0.stock.last === 10 && !b0.programs.esg && !b0.programs.press && !b0.programs.loc && !b0.programs.label);
  check("bonds/insurance/locations/presales/restored/esgQueue arrays", [b0.bonds, b0.insurance, b0.locations, b0.presales, b0.restored, b0.esgQueue].every((a) => Array.isArray(a)));
  check("wave-3 state: tier maps, presale cfg, pledge, imprints, esp intel/suppression",
    b0.insTiers && Object.keys(b0.insTiers).length === 0 && b0.insTitles && b0.presaleCfg
    && b0.esgPledge === null && b0.imprints && Object.keys(b0.imprints.owned).length === 0
    && b0.imprints.active === null && b0.esp.intel && b0.esp.suppressed
    && Object.keys(b0.esp.intel).length === 0 && Object.keys(b0.esp.suppressed).length === 0);

  /* hook baselines before any purchases */
  check("bizOpenMult baseline (rel 50) = 1.085", near(ctx.bizOpenMult({ genre: "action" }), 0.96 + 50 / 400));
  check("bizQualityBonus 0 without label", ctx.bizQualityBonus({ genre: "drama" }) === 0);
  check("bizIntlBonus 0 without localization", ctx.bizIntlBonus() === 0);
  check("espAnnounceWindow 8 at level 0", ctx.espAnnounceWindow() === 8);
  check("bizLocationMods null without location", ctx.bizLocationMods({ genre: "drama" }) === null);
  check("presaleShare 0 without presale", ctx.presaleShare({}) === 0 && ctx.presaleShare({ presale: 0 }) === 0 && ctx.presaleShare({ presale: 0.15 }) === 0.15);
  check("imprint hooks neutral without an active imprint", ctx.imprintOpeningMult({ genre: "horror" }) === 1 && ctx.imprintOpeningMult({ genre: "drama" }) === 1 && ctx.imprintCriticBonus({ genre: "drama" }) === 0);
  check("espionageSuppression neutral for an untouched rival", ctx.espionageSuppression("Nobody Studios") === 1);
  check("bizAction ignores foreign actions", ctx.bizAction("loan", btn({})) === false && ctx.bizAction("biz-nope", btn({})) === false);

  /* ── sim driver ───────────────────────────────────────────────── */
  let autoBiz = false;
  let simWeeks = 0;
  const moved = { bondIssue: 0, bondRepay: 0, premiere: 0, presale: 0, mandate: 0, insure: 0, location: 0, revPresale: 0, espOp: 0, imprint: 0, esgFile: 0 };
  function botStep() {
    const s = S();
    if (!s || s.over) return;
    const st = s.studio;
    const unscheduled = s.projects.filter((p) => !p.releaseWeek).length;
    if (unscheduled < 2 && st.cash > 45) {
      const idea = s.ideas.slice().sort((a, b) => b.script - a.script)[0];
      if (idea) {
        const scale = st.cash > 140 ? "mid" : st.cash > 45 ? "indie" : "micro";
        const budget = ctx.scaleOf(scale).budgets[1];
        const dir = s.market.filter((t) => t.k === "dir" && t.bookedUntil <= st.week)
          .sort((a, b) => ctx.feeFor(a, budget) - ctx.feeFor(b, budget))[0];
        const act = s.market.filter((t) => t.k === "actor" && t.bookedUntil <= st.week)
          .sort((a, b) => ctx.feeFor(a, budget) - ctx.feeFor(b, budget))[0];
        if (dir && act) ctx.greenlight(idea.id, { scale: scale, bIdx: 1, dirId: dir.id, actorId: act.id, mktIdx: 1 });
      }
    }
    s.projects.forEach((p) => {
      if (p.phase === "ready" && !p.releaseWeek) {
        const mkt = Math.round(p.budget * ctx.scaleOf(p.scale).mktRate * ctx.MKT_TIERS[0].mult * 10) / 10;
        if (st.cash > mkt + 5) ctx.setRelease(p, st.week + 2, 0);
      }
    });
    if (!autoBiz) return;
    const biz = s.biz;
    if (biz.board.offer && biz.board.offer.length && !biz.board.mandate && ctx.bizAction("biz-board-pick", btn({ idx: "0" }))) moved.mandate++;
    s.projects.forEach((p) => {
      if (!p.insured && ["pre", "shoot", "post"].indexOf(p.phase) >= 0 && st.cash > p.budget * 0.2 && ctx.bizAction("biz-insure", btn({ id: p.id, tier: "basic" }))) moved.insure++;
      if (!p.location && ["pre", "shoot"].indexOf(p.phase) >= 0 && st.cash > 30 && ctx.bizAction("biz-loc-assign", btn({ id: p.id, loc: "tokyo" }))) moved.location++;
      if (["shoot", "post", "ready"].indexOf(p.phase) >= 0 && (p.presale || 0) + 0.15 <= 0.25 && ctx.bizAction("biz-presale", btn({ id: p.id, share: "0.15" }))) moved.presale++;
      if (["shoot", "post", "ready"].indexOf(p.phase) >= 0 && (p.revShare || 0) + 0.15 <= 0.25 && st.cash > 20 && ctx.bizAction("biz-presale", btn({ id: p.id, share: "0.15", type: "rev", region: "apac" }))) moved.revPresale++;
    });
    if (st.cash > 25 && ctx.bizAction("biz-esp-op", btn({ rival: s.rivals[0].name, op: "intel" }))) moved.espOp++;
    if (!biz.imprints.owned.prestige && st.cash > 130 && ctx.bizAction("biz-imprint", btn({ key: "prestige" }))) moved.imprint++;
    else if (biz.imprints.owned.genre && biz.imprints.active !== "genre" && st.cash > 40 && ctx.bizAction("biz-imprint", btn({ key: "genre" }))) moved.imprint++;
    if (!biz.esgPledge && st.cash > 60 && ctx.bizAction("biz-esg-file", btn({ target: "25" }))) moved.esgFile++;
    if (st.cash > 160 && ctx.bizBondsOutstanding() + 10 <= ctx.bizRating().cap && ctx.bizAction("biz-bond-issue", btn({}))) moved.bondIssue++;
    if (biz.bonds.length && st.cash > biz.bonds[0].amt + 80 && ctx.bizAction("biz-bond-repay", btn({}))) moved.bondRepay++;
    if (st.cash > 40 && ctx.bizAction("biz-premiere", btn({}))) moved.premiere++;
    if (st.cash < 5 && s.loans.length < 2) ctx.takeLoan();
  }
  function week(n) {
    for (let i = 0; i < (n || 1); i++) {
      simWeeks++;
      botStep();
      ctx.advanceWeek(); /* engine calls tickBiz() internally after its own systems */
      const st = S().studio, bz = S().biz;
      if (!isFinite(st.cash)) {
        console.log("  ! weekTx rows at week " + st.week + ": " + JSON.stringify(S().weekTx.rows));
        throw new Error("cash not finite at studio week " + st.week);
      }
      if (!bz || !isFinite(bz.chains.rel) || !isFinite(bz.board.conf) || !isFinite(bz.stock.last))
        throw new Error("biz fields not finite at studio week " + st.week);
      if (S().over) throw new Error("studio went bankrupt at week " + st.week);
    }
  }

  /* ── (1) credit & bonds ───────────────────────────────────────── */
  console.log("credit & bonds");
  week(3);
  const rat = ctx.bizRating();
  check("rating BBB at start (score " + ctx.bizScore().toFixed(1) + ")", rat.name === "BBB" && rat.cap === 50 && rat.rate === 0.006);
  const savedRep = S().studio.rep, savedCash = S().studio.cash;
  S().studio.rep = 100; S().studio.cash = 500;
  check("rating AA at rep 100 (AAA needs score 80, max is 70)", ctx.bizRating().name === "AA");
  S().studio.rep = 0; S().studio.cash = -30;
  check("rating CCC with rep 0 and negative cash, cap 0", ctx.bizRating().name === "CCC" && ctx.bizRating().cap === 0);
  S().studio.rep = savedRep; S().studio.cash = savedCash;

  let c0 = S().studio.cash;
  check("bond issue accepted", ctx.bizAction("biz-bond-issue", btn({})) === true);
  check("bond recorded {amt:10, rate:0.006}", S().biz.bonds.length === 1 && S().biz.bonds[0].amt === 10 && S().biz.bonds[0].rate === 0.006);
  check("issue earns $10M", near(S().studio.cash, c0 + 10));
  for (let i = 0; i < 4; i++) ctx.bizAction("biz-bond-issue", btn({}));
  check("bond cap: 5×10 = $50M outstanding at BBB", ctx.bizBondsOutstanding() === 50);
  check("6th issue rejected by cap", ctx.bizIssueBond() === false && ctx.bizBondsOutstanding() === 50);
  c0 = S().studio.cash;
  const rawInt = ctx.bizBondInterest();
  check("weekly interest = 50×0.6% = $0.3M spent", near(rawInt, 0.3, 1e-9) && near(c0 - S().studio.cash, Math.round(rawInt * 10) / 10));
  for (let i = 0; i < 5; i++) ctx.bizAction("biz-bond-repay", btn({}));
  check("repay oldest clears all five", S().biz.bonds.length === 0);
  ctx.bizAction("biz-bond-issue", btn({}));
  S().studio.cash = 5;
  check("repay rejected without cash", ctx.bizRepayBond() === false && S().biz.bonds.length === 1 && S().studio.cash === 5);
  addCash(200);
  ctx.bizAction("biz-bond-repay", btn({}));

  /* ── (2) board ────────────────────────────────────────────────── */
  console.log("board");
  S().studio.week = 12; S().studio.woy = 12;
  week(1); /* week 13 → quarterly review */
  check("quarterly offer of 3 mandates at woy 13", S().biz.board.offer && S().biz.board.offer.length === 3);
  S().biz.board.offer = [{ kind: "rep" }];
  const repAtPick = S().studio.rep;
  check("mandate pick accepted", ctx.bizAction("biz-board-pick", btn({ idx: "0" })) === true);
  const m0 = S().biz.board.mandate;
  check("mandate stored {kind rep, target rep+8, due week+13}", m0 && m0.kind === "rep" && m0.target === Math.round(repAtPick + 8) && m0.due === S().studio.week + 13 && S().biz.board.offer === null);
  const confPre = S().biz.board.conf;
  m0.due = S().studio.week + 1;
  week(1); /* drift −0.5 then miss −12 */
  check("missed mandate: conf −12 after drift, mandate cleared",
    S().biz.board.mandate === null && near(S().biz.board.conf, Math.max(5, Math.min(100, Math.max(5, Math.min(100, confPre - 0.5)) - 12))));

  S().biz.board.offer = [{ kind: "cash" }];
  ctx.bizAction("biz-board-pick", btn({ idx: "0" }));
  const cashTarget = S().biz.board.mandate.target;
  check("cash mandate target = cash+40", near(cashTarget, Math.round((S().studio.cash + 40) * 10) / 10, 1e-6));
  S().studio.cash = cashTarget + 5;
  S().biz.board.mandate.due = S().studio.week;
  c0 = S().studio.cash;
  const confPre2 = S().biz.board.conf;
  ctx.tickBiz(); /* direct tick: drift −0.5, met +12, earn 8 */
  check("met mandate earns $8M bonus", near(S().studio.cash - c0, 8));
  check("met mandate: conf +12 after drift, cleared", S().biz.board.mandate === null && near(S().biz.board.conf, Math.max(5, Math.min(100, confPre2 - 0.5 + 12))));

  S().biz.board.conf = 90;
  S().studio.week = 26; S().studio.woy = 26;
  c0 = S().studio.cash;
  ctx.tickBiz(); /* woy 26 quarterly: offer + confidence bonus */
  check("conf ≥ 85 pays $5M quarterly bonus", near(S().studio.cash - c0, 5));
  check("quarterly offer regenerated at woy 26", S().biz.board.offer && S().biz.board.offer.length === 3);
  S().biz.board.offer = null;

  /* ── (3) insurance tiers ──────────────────────────────────────── */
  console.log("insurance tiers");
  /* greenlight two extra micro productions so all three tiers can be exercised */
  for (let gi = 0; gi < 2; gi++) {
    const ideaG = S().ideas[gi];
    const dirG = S().market.filter((t) => t.k === "dir" && t.bookedUntil <= S().studio.week)[0];
    const actG = S().market.filter((t) => t.k === "actor" && t.bookedUntil <= S().studio.week)[0];
    if (ideaG && dirG && actG) ctx.greenlight(ideaG.id, { scale: "micro", bIdx: 0, dirId: dirG.id, actorId: actG.id, mktIdx: 1 });
  }
  const cands = S().projects.filter((p) => !p.insured && ["pre", "shoot", "post"].indexOf(p.phase) >= 0);
  const pIns = cands[0], pKey = cands[1], pFull = cands[2];
  check("three productions available to insure", !!pIns && !!pKey && !!pFull);
  const premB = Math.round(pIns.budget * 0.025 * 10) / 10;
  c0 = S().studio.cash;
  check("basic tier bought", ctx.bizAction("biz-insure", btn({ id: pIns.id, tier: "basic" })) === true);
  check("p.insured + p.insTier 'basic', premium 2.5% of budget spent", pIns.insured === true && pIns.insTier === "basic" && near(c0 - S().studio.cash, premB));
  check("tier map + title map recorded for film claims", S().biz.insTiers[pIns.id] === "basic" && S().biz.insTitles[pIns.id] === pIns.title);
  check("insurance list records the project", S().biz.insurance.indexOf(pIns.id) >= 0);
  check("re-insuring rejected", ctx.bizInsure(pIns.id, "keystar") === false);
  check("unknown tier rejected", ctx.bizInsure(pKey.id, "gold") === false && !pKey.insured);
  const premK = Math.round(pKey.budget * 0.035 * 10) / 10;
  c0 = S().studio.cash;
  check("keystar tier bought, premium 3.5%", ctx.bizAction("biz-insure", btn({ id: pKey.id, tier: "keystar" })) === true && pKey.insTier === "keystar" && near(c0 - S().studio.cash, premK) && S().biz.insTiers[pKey.id] === "keystar");
  const premF = Math.round(pFull.budget * 0.05 * 10) / 10;
  c0 = S().studio.cash;
  check("full tier bought, premium 5%", ctx.bizAction("biz-insure", btn({ id: pFull.id, tier: "full" })) === true && pFull.insTier === "full" && near(c0 - S().studio.cash, premF) && S().biz.insTiers[pFull.id] === "full");
  S().studio.cash = 0.1; pFull.insured = false; /* force the insufficient-cash path */
  check("premium rejected without cash", ctx.bizInsure(pFull.id, "full") === false && !pFull.insured && S().studio.cash === 0.1);
  pFull.insured = true;
  addCash(300);

  /* ── (3b) insurance claims (wrap refund · keystar · full flop) ── */
  console.log("insurance claims");
  neutralizeBoard();
  pIns.overrun = 2; pIns.phase = "ready"; pIns.quality = 60; pIns.qPreview = 60; delete pIns.claimed; /* driver: skip phases like the ESG section does */
  const refundExp = Math.round(2 * pIns.budget * 0.015 * 0.85 * 10) / 10;
  c0 = S().studio.cash;
  ctx.tickBiz(); /* deterministic here: no bonds, no programs, esp level 0, no mandate */
  check("basic wrap refund = 85% of accumulated overrun costs", near(S().studio.cash - c0, refundExp) && pIns.claimed === true);
  c0 = S().studio.cash;
  ctx.tickBiz();
  check("wrap refund paid once (claimed flag)", near(S().studio.cash - c0, 0));

  pKey.scandal = true;
  neutralizeBoard();
  S().pending = { type: "scandal", projectId: pKey.id, title: pKey.title, fee: 3 };
  ctx.tickBiz();
  check("keystar clears the scandal weekly and waives the fee", pKey.scandal === false && S().pending === null);
  check("keystar news line logged", S().news.some((n) => n.txt.indexOf("KeyStar") === 0 && n.txt.indexOf("scandal") > 0));

  S().biz.insTiers["pFakeFull"] = "full";
  S().biz.insTitles["pFakeFull"] = "Bond Buster";
  S().films.unshift({ id: "f8801", title: "Bond Buster", genre: "drama", status: "done", cost: 40, profit: -30, insured: true, ww: 9, dom: 6, restored: false });
  neutralizeBoard();
  c0 = S().studio.cash;
  ctx.tickBiz();
  const fFake = S().films.find((f) => f.id === "f8801");
  check("full bond tops up the flop claim by 20% of cost (engine pays 20%, total 40%)", near(S().studio.cash - c0, 8));
  check("film tier resolved via tier map + title match", fFake.bizTier === "full" && fFake.bizPaid === true);
  c0 = S().studio.cash;
  ctx.tickBiz();
  check("full-bond claim paid once", near(S().studio.cash - c0, 0));

  /* ── (4) locations ────────────────────────────────────────────── */
  console.log("locations");
  const pLoc = S().projects.find((p) => ["pre", "shoot"].indexOf(p.phase) >= 0 && !p.location);
  check("a pre/shoot production exists", !!pLoc);
  c0 = S().studio.cash;
  check("tokyo assigned", ctx.bizAction("biz-loc-assign", btn({ id: pLoc.id, loc: "tokyo" })) === true);
  check("$1M legal fees spent, p.location set", near(c0 - S().studio.cash, 1) && pLoc.location === "tokyo");
  const mods = ctx.bizLocationMods(pLoc);
  check("bizLocationMods(tokyo) = craft 2, intl +0.05, costMult 1", mods && mods.craft === 2 && mods.intlBonus === 0.05 && mods.costMult === 1 && mods.rebate === 0);
  check("re-assign rejected", ctx.bizAssignLocation(pLoc.id, "nz") === false);
  const pLoc2 = S().projects.find((p) => ["pre", "shoot"].indexOf(p.phase) >= 0 && !p.location);
  if (pLoc2) {
    ctx.bizAction("biz-loc-assign", btn({ id: pLoc2.id, loc: "iceland" }));
    const m2 = ctx.bizLocationMods(pLoc2);
    check("iceland mods: 20% rebate capped at $15M", m2 && m2.rebate === 0.2 && m2.rebateCap === 15);
  } else console.log("  – (no second production for iceland check; pool verified via tokyo)");

  /* ── (5) theater chains ───────────────────────────────────────── */
  console.log("theater chains");
  const rel0 = S().biz.chains.rel;
  c0 = S().studio.cash;
  check("premiere hosted", ctx.bizAction("biz-premiere", btn({})) === true);
  const relP = S().biz.chains.rel;
  check("premiere: $2M, relations +8, cooldown stamped", near(c0 - S().studio.cash, 2) && near(relP, Math.min(100, rel0 + 8)) && S().biz.chains.eventWk === S().studio.week);
  check("premiere cooldown blocks immediate re-host", ctx.bizHostPremiere() === false);
  check("IMAX locked below rel 60", S().biz.chains.rel < 60 && ctx.bizImaxDeal() === false);
  week(8); /* ride out the cooldown; rel drifts −0.5/wk toward 50 */
  const rel1 = S().biz.chains.rel;
  check("relations drift down 0.5/wk toward 50", rel1 < relP && rel1 >= 50);
  check("premiere again after cooldown", ctx.bizAction("biz-premiere", btn({})) === true);
  check("relations now ≥ 60", S().biz.chains.rel >= 60);
  c0 = S().studio.cash;
  check("IMAX deal signed", ctx.bizAction("biz-imax", btn({})) === true && S().biz.chains.imax === true);
  check("IMAX costs $30M", near(c0 - S().studio.cash, 30));
  const relNow = S().biz.chains.rel;
  check("bizOpenMult with IMAX ×1.06 on action", near(ctx.bizOpenMult({ genre: "action" }), (0.96 + relNow / 400) * 1.06));
  check("bizOpenMult no IMAX bonus on drama", near(ctx.bizOpenMult({ genre: "drama" }), 0.96 + relNow / 400));
  check("bizOpenMult no IMAX bonus on docs", near(ctx.bizOpenMult({ genre: "docs" }), 0.96 + relNow / 400));

  /* ── (6) territory pre-sales: MG ──────────────────────────────── */
  console.log("territory pre-sales (MG)");
  const pSell = S().projects.find((p) => !p.releaseWeek) || S().projects[0];
  check("a project exists to pre-sell", !!pSell);
  pSell.phase = "post"; /* driver: jump to a pre-sellable phase */
  const wwProj = ctx.scaleOf(pSell.scale).openBase * ctx.genreOf(pSell.genre).mass * 2.5;
  const mg15 = Math.round(wwProj * ctx.genreOf(pSell.genre).intl * 0.15 * 0.35 * 10) / 10;
  c0 = S().studio.cash;
  check("15% pre-sale accepted", ctx.bizAction("biz-presale", btn({ id: pSell.id, share: "0.15" })) === true);
  check("MG = projectedWW × intl × share × 0.35 earned", near(S().studio.cash - c0, mg15));
  check("p.presale recorded", near(pSell.presale, 0.15));
  check("presales ledger row written", S().biz.presales.length === 1 && near(S().biz.presales[0].mg, mg15));
  check("25% pre-sale rejected past the 25% cap", ctx.bizSellPresale(pSell.id, 0.25) === false);
  check("second 15% also rejected", ctx.bizSellPresale(pSell.id, 0.15) === false);
  check("presaleShare hook reads film.presale", ctx.presaleShare({ presale: 0.25 }) === 0.25 && ctx.presaleShare({}) === 0);

  /* ── (6b) territory pre-sales: rev-share ──────────────────────── */
  console.log("territory pre-sales (rev-share)");
  check("defaults: 52wk term, no localization", ctx.bizPresaleCfg(pSell.id).term === 52 && ctx.bizPresaleCfg(pSell.id).loc === false);
  const fitAPAC = ctx.BIZ_REGIONS.find((r) => r.id === "apac").loves.indexOf(pSell.genre) >= 0 ? 1.3 : 0.7;
  const up25 = Math.round(wwProj * ctx.genreOf(pSell.genre).intl * 0.25 * 0.2 * fitAPAC * 10) / 10;
  c0 = S().studio.cash;
  check("rev-share deal accepted (APAC 25%)", ctx.bizAction("biz-presale", btn({ id: pSell.id, share: "0.25", type: "rev", region: "apac" })) === true);
  check("p.revShare set on the project (0.25)", near(pSell.revShare, 0.25));
  check("upfront = projectedWW × intl × share × 20% × region fit × term", near(S().studio.cash - c0, up25));
  check("ledger row type 'rev' with region/term/loc", (() => { const r = S().biz.presales[S().biz.presales.length - 1]; return r.type === "rev" && r.region === "apac" && r.term === 52 && r.loc === false; })());
  check("rev cap: another rev deal rejected past 25%", ctx.bizSellPresale(pSell.id, 0.15, "rev", "eu") === false);
  check("unknown region rejected", ctx.bizSellPresale(pSell.id, 0.15, "rev", "mars") === false);

  pSell.revShare = 0;
  check("term config → 104wk", ctx.bizAction("biz-presale-cfg", btn({ id: pSell.id, key: "term", val: "104" })) === true && ctx.bizPresaleCfg(pSell.id).term === 104);
  const up104 = Math.round(wwProj * ctx.genreOf(pSell.genre).intl * 0.15 * 0.2 * fitAPAC * 1.3 * 10) / 10;
  c0 = S().studio.cash;
  ctx.bizAction("biz-presale", btn({ id: pSell.id, share: "0.15", type: "rev", region: "apac" }));
  check("104wk term scales the upfront ×1.3", near(S().studio.cash - c0, up104) && near(pSell.revShare, 0.15));

  pSell.revShare = 0;
  ctx.bizAction("biz-presale-cfg", btn({ id: pSell.id, key: "term", val: "13" }));
  const up13 = Math.round(wwProj * ctx.genreOf(pSell.genre).intl * 0.15 * 0.2 * fitAPAC * 0.6 * 10) / 10;
  c0 = S().studio.cash;
  ctx.bizAction("biz-presale", btn({ id: pSell.id, share: "0.15", type: "rev", region: "apac" }));
  check("13wk term scales the upfront ×0.6", near(S().studio.cash - c0, up13));

  pSell.revShare = 0;
  ctx.bizAction("biz-presale-cfg", btn({ id: pSell.id, key: "term", val: "52" }));
  ctx.bizAction("biz-presale-cfg", btn({ id: pSell.id, key: "loc", val: "1" }));
  check("localization toggled on", ctx.bizPresaleCfg(pSell.id).loc === true);
  const upLoc = Math.round(wwProj * ctx.genreOf(pSell.genre).intl * 0.15 * 0.2 * fitAPAC * 1.25 * 10) / 10;
  c0 = S().studio.cash;
  ctx.bizAction("biz-presale", btn({ id: pSell.id, share: "0.15", type: "rev", region: "apac" }));
  check("localization: offer ×1.25 and $0.8M fee", near(S().studio.cash - c0, Math.round((upLoc - 0.8) * 10) / 10) && near(pSell.revShare, 0.15));
  pSell.revShare = 0;
  ctx.bizAction("biz-presale-cfg", btn({ id: pSell.id, key: "loc", val: "0" }));

  const genreOrig = pSell.genre;
  pSell.genre = "action"; /* APAC loves action → fit 1.3 */
  const upFitHi = Math.round(wwProj / ctx.genreOf(genreOrig).mass * ctx.genreOf("action").mass * ctx.genreOf("action").intl * 0.15 * 0.2 * 1.3 * 10) / 10;
  c0 = S().studio.cash;
  ctx.bizAction("biz-presale", btn({ id: pSell.id, share: "0.15", type: "rev", region: "apac" }));
  check("favored genre (action in APAC) boosts the offer ×1.3", near(S().studio.cash - c0, upFitHi));
  pSell.revShare = 0;
  pSell.genre = "drama"; /* APAC does not love drama → fit 0.7 */
  const upFitLo = Math.round(wwProj / ctx.genreOf(genreOrig).mass * ctx.genreOf("drama").mass * ctx.genreOf("drama").intl * 0.15 * 0.2 * 0.7 * 10) / 10;
  c0 = S().studio.cash;
  ctx.bizAction("biz-presale", btn({ id: pSell.id, share: "0.15", type: "rev", region: "apac" }));
  check("unfavored genre (drama in APAC) cuts the offer ×0.7", near(S().studio.cash - c0, upFitLo));
  pSell.revShare = 0;
  pSell.genre = genreOrig;

  /* ── (7) espionage ────────────────────────────────────────────── */
  console.log("espionage");
  addCash(150);
  c0 = S().studio.cash;
  for (let i = 0; i < 3; i++) check("espionage level " + (i + 1) + " built", ctx.bizAction("biz-esp-build", btn({})) === true);
  check("levels cost 10+25+50 = $85M", near(c0 - S().studio.cash, 85) && S().biz.esp.level === 3);
  check("4th level rejected (max 3)", ctx.bizEspBuild() === false && S().biz.esp.level === 3);
  check("espAnnounceWindow = 8 + 3×3 = 17", ctx.espAnnounceWindow() === 17);
  const repPre = S().studio.rep;
  withRandom(0.01, () => ctx.bizEspTick()); /* op fires, operatives caught */
  check("caught passive operation costs 2 rep", near(S().studio.rep, Math.max(0, repPre - 2)));
  const ideasPre = S().ideas.length;
  withRandom(0.05, () => ctx.bizEspTick()); /* op fires, not caught, steal branch */
  check("stolen script lands on the desk", S().ideas.length === ideasPre + 1 && S().biz.esp.lastIntel === S().studio.week);
  const q = [0.06, 0.9, 0.9, 0.5]; let qi = 0;
  withRandom(() => q[qi++ % q.length], () => ctx.bizEspTick()); /* op, clean, intel branch */
  check("intel news names a rival slot", S().news[0].txt.indexOf("Espionage:") === 0 && S().news[0].txt.indexOf("will open") > 0 && S().biz.esp.lastIntel === S().studio.week);

  /* ── (7b) espionage active missions ───────────────────────────── */
  console.log("espionage missions");
  const BIZ0 = ctx.BIZ_OPS;
  const riv = S().rivals[0];
  riv.slots.push(
    { week: S().studio.week + 5, title: "Fake Op Alpha", genre: "action", openEst: 10, quality: 61, announced: false, done: false },
    { week: S().studio.week + 6, title: "Fake Op Beta", genre: "scifi", openEst: 10, quality: 62, announced: false, done: false },
    { week: S().studio.week + 7, title: "Fake Op Gamma", genre: "drama", openEst: 10, quality: 63, announced: false, done: false }
  );
  S().studio.cash = 0.2;
  check("mission rejected without cash", ctx.bizEspOp(riv.name, "intel") === false && S().studio.cash === 0.2);
  addCash(30);
  const repM0 = S().studio.rep;
  c0 = S().studio.cash;
  withRandom(0.01, () => ctx.bizEspOp(riv.name, "intel"));
  check("intel mission caught (5% risk): rep −4, cost spent", near(S().studio.rep, Math.max(0, repM0 - 4)) && near(c0 - S().studio.cash, Math.round(BIZ0.intel.cost * 10) / 10));
  S().studio.rep = repM0;
  c0 = S().studio.cash;
  withRandom(0.9, () => ctx.bizEspOp(riv.name, "intel"));
  const stored = S().biz.esp.intel[riv.name];
  check("clean intel run stores 3 slots with title/week/quality", Array.isArray(stored) && stored.length === 3 && stored.every((s) => s.title && s.week > S().studio.week && typeof s.quality === "number"));
  check("intel news reveals a quality score", S().news[0].txt.indexOf("Espionage:") === 0 && S().news[0].txt.indexOf("Q") > 0);
  check("intel costs $0.65M (rounded to 0.1 by the ledger)", near(c0 - S().studio.cash, Math.round(BIZ0.intel.cost * 10) / 10));
  c0 = S().studio.cash;
  withRandom(0.9, () => ctx.bizEspOp(riv.name, "leak"));
  check("counter-PR leak sets the suppression flag, cost spent", S().biz.esp.suppressed[riv.name] === true && near(c0 - S().studio.cash, Math.round(BIZ0.leak.cost * 10) / 10));
  check("espionageSuppression returns 0.78 once, then 1 and clears", ctx.espionageSuppression(riv.name) === 0.78 && ctx.espionageSuppression(riv.name) === 1 && !S().biz.esp.suppressed[riv.name]);
  const repM1 = S().studio.rep;
  withRandom(0.05, () => ctx.bizEspOp(riv.name, "leak")); /* caught: 10% risk */
  check("leak caught (10% risk): rep −4", near(S().studio.rep, Math.max(0, repM1 - 4)));
  S().biz.esp.suppressed[riv.name] = true;
  c0 = S().studio.cash;
  check("leak while already suppressed rejected", ctx.bizEspOp(riv.name, "leak") === false && S().studio.cash === c0);
  delete S().biz.esp.suppressed[riv.name];
  check("unknown rival rejected", ctx.bizEspOp("Mars Films", "intel") === false);
  check("unknown op rejected", ctx.bizEspOp(riv.name, "sabotage") === false);

  /* ── (8) industry programs ────────────────────────────────────── */
  console.log("industry programs");
  addCash(100);
  c0 = S().studio.cash;
  for (const k of ["esg", "press", "loc", "label"]) check("program " + k + " bought", ctx.bizAction("biz-prog", btn({ key: k })) === true);
  check("programs cost 15+10+20+25 = $70M", near(c0 - S().studio.cash, 70));
  check("re-buy rejected", ctx.bizBuyProgram("esg") === false);
  check("bizIntlBonus = 0.03 with localization", ctx.bizIntlBonus() === 0.03);
  check("bizQualityBonus +3 drama/crime/docs, 0 otherwise",
    ctx.bizQualityBonus({ genre: "drama" }) === 3 && ctx.bizQualityBonus({ genre: "crime" }) === 3 && ctx.bizQualityBonus({ genre: "docs" }) === 3 && ctx.bizQualityBonus({ genre: "action" }) === 0 && ctx.bizQualityBonus({ genre: "romance" }) === 0);
  /* ESG rebate lifecycle on a fresh greenlight */
  const idea = S().ideas[0];
  const dir = S().market.filter((t) => t.k === "dir" && t.bookedUntil <= S().studio.week)[0];
  const act = S().market.filter((t) => t.k === "actor" && t.bookedUntil <= S().studio.week)[0];
  const gl = ctx.greenlight(idea.id, { scale: "micro", bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 1 });
  check("ESG test project greenlit", !gl.err);
  const pEsg = S().projects[S().projects.length - 1];
  ctx.tickBiz();
  check("project flagged esgMarked and queued", pEsg.esgMarked === true && S().biz.esgQueue.some((q2) => q2.title === pEsg.title && q2.budget === pEsg.budget));
  pEsg.phase = "ready"; pEsg.quality = 60; pEsg.qPreview = 60; /* driver: skip the production phases */
  check("release scheduled (whisper campaign)", ctx.setRelease(pEsg, S().studio.week + 2, 0).ok === true);
  const buzzPre = pEsg.buzz;
  week(1); /* advanceWeek ticks biz internally — press office bumps scheduled projects */
  check("press office: +1 buzz per week once scheduled", pEsg.buzz === buzzPre + 1 && pEsg.releaseWeek > S().studio.week);
  const esgTitle = pEsg.title, esgBudget = pEsg.budget;
  botStep();
  simWeeks++;
  ctx.advanceWeek(); /* release week — engine's internal tickBiz pays the rebate */
  const fEsg = S().films.find((f) => f.title === esgTitle);
  check("film released and matched by ESG queue", !!fEsg && fEsg.esgPaid === true && !S().biz.esgQueue.some((q2) => q2.title === esgTitle));
  const rebateRow = S().weekTx.rows.find((r) => r.k.indexOf("ESG rebate") === 0 && r.k.indexOf(esgTitle) > 0);
  check("ESG rebate = 3% of budget in the week ledger", !!rebateRow && near(rebateRow.v, Math.round(esgBudget * 0.03 * 10) / 10));

  /* ── (8b) ESG pledges ─────────────────────────────────────────── */
  console.log("esg pledges");
  addCash(20);
  check("invalid pledge target rejected", ctx.bizFileEsg(99) === false);
  c0 = S().studio.cash;
  check("pledge filed (target 25)", ctx.bizAction("biz-esg-file", btn({ target: "25" })) === true);
  check("filing costs $3M, due week+52, catalog baseline stored",
    near(c0 - S().studio.cash, 3) && S().biz.esgPledge.target === 25 && S().biz.esgPledge.due === S().studio.week + 52 && typeof S().biz.esgPledge.startCatalog === "number");
  check("second filing rejected while a pledge is open", ctx.bizFileEsg(45) === false);
  const repP0 = S().studio.rep;
  neutralizeBoard();
  S().biz.esgPledge.startCatalog = S().studio.catalog; /* growth 0 → miss */
  S().biz.esgPledge.due = S().studio.week;
  c0 = S().studio.cash;
  withRandom(0.5, () => ctx.tickBiz()); /* 0.5 suppresses every chance() roll */
  check("missed pledge: rep −3, no grant, pledge cleared", near(S().studio.rep, Math.max(0, repP0 - 3)) && S().biz.esgPledge === null);
  ctx.bizFileEsg(45);
  neutralizeBoard();
  S().biz.esgPledge.startCatalog = S().studio.catalog - 100; /* growth 100 ≥ 45×2 → met */
  S().biz.esgPledge.due = S().studio.week;
  const repP1 = S().studio.rep;
  c0 = S().studio.cash;
  withRandom(0.5, () => ctx.tickBiz());
  check("met pledge: grant target×0.8 ($36M) + rep +2", near(S().studio.cash - c0, 36) && near(S().studio.rep, Math.min(100, repP1 + 2)) && S().biz.esgPledge === null);

  /* ── (8c) studio imprints ─────────────────────────────────────── */
  console.log("imprints");
  addCash(120);
  check("prestige baseline critic bonus before purchase", ctx.imprintCriticBonus({ genre: "drama" }) === 0);
  c0 = S().studio.cash;
  check("Prestige Classics bought ($30M)", ctx.bizAction("biz-imprint", btn({ key: "prestige" })) === true);
  check("prestige active + owned, $30M spent", S().biz.imprints.active === "prestige" && S().biz.imprints.owned.prestige === true && near(c0 - S().studio.cash, 30));
  check("imprintCriticBonus +4 on drama/crime/docs only",
    ctx.imprintCriticBonus({ genre: "drama" }) === 4 && ctx.imprintCriticBonus({ genre: "crime" }) === 4 && ctx.imprintCriticBonus({ genre: "docs" }) === 4
    && ctx.imprintCriticBonus({ genre: "action" }) === 0 && ctx.imprintCriticBonus({ genre: "romance" }) === 0);
  check("bizQualityBonus stacks label program + imprint (3+4)", ctx.bizQualityBonus({ genre: "drama" }) === 7);
  check("imprintOpeningMult neutral under prestige", ctx.imprintOpeningMult({ genre: "horror" }) === 1);
  c0 = S().studio.cash;
  check("Genre Label bought while prestige active ($25M + $5M switch)",
    ctx.bizAction("biz-imprint", btn({ key: "genre" })) === true && near(c0 - S().studio.cash, 30) && S().biz.imprints.active === "genre");
  check("genre imprint ×1.035 on horror/thriller/action/scifi only",
    ctx.imprintOpeningMult({ genre: "horror" }) === 1.035 && ctx.imprintOpeningMult({ genre: "thriller" }) === 1.035
    && ctx.imprintOpeningMult({ genre: "action" }) === 1.035 && ctx.imprintOpeningMult({ genre: "scifi" }) === 1.035
    && ctx.imprintOpeningMult({ genre: "drama" }) === 1 && ctx.imprintOpeningMult({ genre: "comedy" }) === 1);
  check("critic bonus off while prestige inactive", ctx.imprintCriticBonus({ genre: "drama" }) === 0 && ctx.bizQualityBonus({ genre: "drama" }) === 3);
  c0 = S().studio.cash;
  check("Family Tree bought while genre active ($20M + $5M switch)",
    ctx.bizAction("biz-imprint", btn({ key: "family" })) === true && near(c0 - S().studio.cash, 25) && S().biz.imprints.active === "family");
  check("family imprint ×1.025 on every genre", ctx.imprintOpeningMult({ genre: "drama" }) === 1.025 && ctx.imprintOpeningMult({ genre: "horror" }) === 1.025 && ctx.imprintOpeningMult({ genre: "docs" }) === 1.025);
  check("re-buying the active imprint rejected", ctx.bizBuyImprint("family") === false);
  c0 = S().studio.cash;
  check("switching back to an owned prestige costs $5M",
    ctx.bizAction("biz-imprint", btn({ key: "prestige" })) === true && near(c0 - S().studio.cash, 5) && S().biz.imprints.active === "prestige");
  S().studio.cash = 2;
  check("imprint switch rejected without cash", ctx.bizBuyImprint("family") === false && S().biz.imprints.active === "prestige");
  addCash(300);

  /* ── (9) stock ────────────────────────────────────────────────── */
  console.log("stock");
  const prev = S().biz.stock.last;
  const st = S().studio;
  const expect = Math.round((8 + st.rep / 8 + Math.min(st.cash, 300) / 50 + st.catalog / 200) * 10) / 10;
  ctx.bizStockTick();
  check("stock price matches formula", S().biz.stock.last === expect && isFinite(expect));
  if (Math.abs(expect - prev) >= 2)
    check("≥$2 move produced a news line", S().news[0].txt.indexOf("BOW shares") === 0);

  /* ── (10) restoration ─────────────────────────────────────────── */
  console.log("restoration");
  S().films.unshift({ id: "f90001", title: "Vintage Classic", genre: "drama", status: "done", ww: 80, dom: 40, restored: false });
  S().films.unshift({ id: "f90002", title: "Small Flop", genre: "horror", status: "done", ww: 12, dom: 8, restored: false });
  const cat0 = S().studio.catalog;
  c0 = S().studio.cash;
  check("restoration of WW $80M film accepted", ctx.bizAction("biz-restore", btn({ id: "f90001" })) === true);
  check("restore costs $6M, catalog +8, film marked", near(c0 - S().studio.cash, 6) && near(S().studio.catalog, cat0 + 8) && S().films.find((f) => f.id === "f90001").restored === true && S().biz.restored.indexOf("f90001") >= 0);
  check("re-restore rejected", ctx.bizRestore("f90001") === false);
  check("film under $50M WW rejected", ctx.bizRestore("f90002") === false);
  S().films.unshift({ id: "f90003", title: "Second Classic", genre: "action", status: "done", ww: 60, dom: 30, restored: false });
  S().studio.cash = 5;
  check("insufficient-cash rejection on restore", ctx.bizRestore("f90003") === false && S().studio.cash === 5 && S().films[0].restored === false);
  addCash(400);

  /* ── desks render ─────────────────────────────────────────────── */
  console.log("desks");
  ctx.tag = (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>";
  ctx.statrow = (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>";
  ctx.render = () => {};
  ctx.drainFlash = () => {};
  for (const d of ctx.BIZ_DESKS) {
    const html = d.render();
    check("desk " + d.id + " renders non-empty body", typeof html === "string" && html.length > 40 && html.indexOf("<") === 0);
  }
  const insHtml = ctx.BIZ_DESKS.find((d) => d.id === "biz-insurance").render();
  check("insurance desk offers all three tiers", insHtml.indexOf("Basic") > 0 && insHtml.indexOf("KeyStar") > 0 && insHtml.indexOf("Full bond") > 0);
  const espHtml = ctx.BIZ_DESKS.find((d) => d.id === "biz-espionage").render();
  check("espionage desk lists active missions per rival", espHtml.indexOf("data-action=\"biz-esp-op\"") > 0 && espHtml.indexOf("data-op=\"leak\"") > 0);
  const preHtml = ctx.BIZ_DESKS.find((d) => d.id === "biz-presales").render();
  check("presales desk offers MG and rev-share by region", preHtml.indexOf("data-type=\"rev\"") > 0 && preHtml.indexOf("biz-presale-cfg") > 0);
  const progHtml = ctx.BIZ_DESKS.find((d) => d.id === "biz-programs").render();
  check("programs desk offers ESG pledge targets and imprints", progHtml.indexOf("biz-esg-file") > 0 && progHtml.indexOf("biz-imprint") > 0 && progHtml.indexOf("Prestige Classics") > 0);

  /* ── long run: everything together, ≥60 weeks ─────────────────── */
  console.log("long run");
  autoBiz = true;
  while (S().studio.week < 85) week(1);
  check("drove 60+ real advanceWeek() calls (" + simWeeks + " sims, studio week " + S().studio.week + ")", simWeeks >= 60);
  check("studio never went bankrupt", !S().over && isFinite(S().studio.cash));
  check("at least one film released", S().stats.releases >= 1);
  check("biz namespace intact at end", !!S().biz && Array.isArray(S().biz.bonds));
  check("board conf clamped in [5,100]", S().biz.board.conf >= 5 && S().biz.board.conf <= 100);
  check("relations clamped in [0,100]", S().biz.chains.rel >= 0 && S().biz.chains.rel <= 100);
  check("espionage still level 3, window 17", S().biz.esp.level === 3 && ctx.espAnnounceWindow() === 17);
  check("all four programs still on", S().biz.programs.esg && S().biz.programs.press && S().biz.programs.loc && S().biz.programs.label);
  check("bonds outstanding finite", isFinite(ctx.bizBondsOutstanding()));
  check("income/decay cycle moved: stock price left its $10 seed", S().biz.stock.last !== 10);
  check("systems exercised in the long run",
    moved.bondIssue >= 1 && moved.premiere >= 1 && moved.presale >= 1 && moved.mandate >= 1 && moved.insure >= 1 && moved.location >= 1);
  check("wave-3 systems exercised in the long run", moved.revPresale >= 1 && moved.espOp >= 1 && moved.imprint >= 1 && moved.esgFile >= 1);
  check("tier resolved on a released insured film (film→project tier match)", S().films.some((f) => f.bizTier));
  check("rev-share deals recorded in the ledger", S().biz.presales.some((r) => r.type === "rev"));
  check("an imprint is active at the end", !!S().biz.imprints.active);
  check("esp intel captured on at least one rival", Object.keys(S().biz.esp.intel).length >= 1);
  check("esg pledge state sane at end (resolved or still open)", S().biz.esgPledge === null || S().biz.esgPledge.due > S().studio.week);
  console.log("  – long-run activity: " + JSON.stringify(moved) + " presales ledger " + S().biz.presales.length + " · policies " + S().biz.insurance.length + " · esg rebates " + S().films.filter((f) => f.esgPaid).length + " · rev deals " + S().biz.presales.filter((r) => r.type === "rev").length);

  console.log("\nPASS — " + pass + " checks green");
} catch (e) {
  console.error("\nFAIL after " + pass + " green checks: " + e.message);
  console.error(e.stack);
  process.exitCode = 1;
}
