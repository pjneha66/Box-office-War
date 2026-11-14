/* Rebuild festivals-module harness (pattern from test/rebuild-bizdeal.mjs): runs
   game/data.js + game/engine.js + game/pr.js + game/festivals.js in a VM sandbox
   with a stubbed localStorage. ui.js needs a DOM, so the two ui string helpers the
   desk renders with (tag, statrow) are stubbed verbatim.
   Checks: FESTIVAL_DESKS shape, the 6-festival calendar (weeks 6/18/33/36/40/44),
   board render with all festivals + fallback eligible projects when S.pr is absent,
   plan premiere through the real festivalAction (buzz +5, $2M spend, p.premiereFest),
   every gate (taste, phase, one-per-project, past edition, insufficient cash,
   unknown festival/project), tickFestivals → 0, then a 110-week drive with
   real premieres across festival weeks. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra != null ? "  → " + extra : ""));
  if (!cond) failures++;
}
function require(cond, msg) { if (!cond) throw new Error(msg); }
const btn = (attrs) => ({ getAttribute: (k) => { const v = attrs[k] != null ? attrs[k] : attrs[k.replace("data-", "")]; return v != null ? String(v) : null; } });
const badFlash = () => S().flash.some((f) => f.kind === "bad");

const ctx = vm.createContext({
  console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  render: () => {}, drainFlash: () => {}
});
for (const f of ["data.js", "engine.js", "pr.js", "festivals.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
ctx.newGame("Palme Test", "veteran");
const S = () => ctx.S;

/* ── desks & calendar shape ───────────────────────────────────── */
check("FESTIVAL_DESKS is a one-desk array in group 'Awards' (id fest-board, icon 🎪)",
  Array.isArray(ctx.FESTIVAL_DESKS) && ctx.FESTIVAL_DESKS.length === 1 &&
  ctx.FESTIVAL_DESKS[0].id === "fest-board" && ctx.FESTIVAL_DESKS[0].group === "Awards" &&
  ctx.FESTIVAL_DESKS[0].icon === "🎪" && typeof ctx.FESTIVAL_DESKS[0].render === "function");
check("calendar: 6 festivals at weeks 6/18/33/36/40/44 with 3 taste genres each",
  ctx.FESTIVALS.length === 6 &&
  JSON.stringify(ctx.FESTIVALS.map((f) => f.w)) === JSON.stringify([6, 18, 33, 36, 40, 44]) &&
  ctx.FESTIVALS.every((f) => f.name && f.em && f.genres.length === 3),
  ctx.FESTIVALS.map((f) => f.name + "@" + f.w).join(" "));
check("tickFestivals() → 0 (uniform no-op, no engine wiring needed)", ctx.tickFestivals() === 0);
check("festivalAction declines foreign ids (bridge falls through)", ctx.festivalAction("fest-bogus", btn({})) === false);

/* ── board renders all 6 festivals at week 1 (woy 1, none passed) ── */
let html = null;
try { html = ctx.FESTIVAL_DESKS[0].render(); } catch (e) { html = "THREW: " + e.message; }
const allNames = ["Sundance", "Cannes", "Venice", "TIFF", "Fantasia", "AFI Fest"].every((n) => html.indexOf(n) >= 0);
check("fest-board renders a clean body listing all six festivals",
  typeof html === "string" && allNames && html.indexOf("NaN") < 0 && html.indexOf("undefined") < 0,
  html && html.substring ? String(html.length) : html);

/* ── two real projects: drama (Sundance taste) + horror (Fantasia taste) ── */
function plantProject(genre) {
  const idea = S().ideas[0];
  const dir = S().market.find((t) => t.k === "dir" && !ctx.talentBusy(t));
  const act = S().market.find((t) => t.k === "actor" && !ctx.talentBusy(t));
  const r = ctx.greenlight(idea.id, { scale: "micro", bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 0 });
  require(!r.err, "greenlight failed: " + (r && r.err));
  const p = S().projects[S().projects.length - 1];
  p.genre = genre;                    /* test plants the taste it needs */
  p.phase = "post";                   /* and a premiere-eligible phase */
  return p;
}
const pDrama = plantProject("drama");
const pHorror = plantProject("horror");
S().studio.cash = 40;                 /* known balance for cost asserts */

/* ── plan premiere through the real action bridge ─────────────── */
const cashBefore = S().studio.cash, buzzBefore = pDrama.buzz;
const handled = ctx.festivalAction("fest-premiere", btn({ fest: "Sundance", id: pDrama.id }));
check("festivalAction handles fest-premiere (returns true)", handled === true);
check("premiere costs $2M through the real ledger", S().studio.cash === cashBefore - 2, ctx.fm(S().studio.cash - cashBefore));
check("premiere applies buzz +5 immediately (p.buzz)", pDrama.buzz === buzzBefore + 5, buzzBefore + " → " + pDrama.buzz);
check("premiere stored on the project (p.premiereFest)", pDrama.premiereFest === "Sundance");
check("premiere logged as news", S().news[0].txt.indexOf("premieres at Sundance") >= 0);
check("ledger row recorded", !S().weekTx || S().weekTx.rows.some((r) => r.k.indexOf("Festival premiere") >= 0));

/* ── gates ────────────────────────────────────────────────────── */
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ fest: "Cannes", id: pDrama.id }));
check("gate: one premiere per project (second festival rejected)", badFlash(), S().flash.length && S().flash[0].txt);
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ fest: "Sundance", id: pHorror.id }));
check("gate: taste mismatch (horror ≠ Sundance drama/docs/romance)", badFlash());
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ fest: "Fantasia", id: pDrama.id }));
check("gate: drama ≠ Fantasia horror/scifi/action", badFlash());
pHorror.phase = "shoot";
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ fest: "Fantasia", id: pHorror.id }));
check("gate: phase must be post or ready", badFlash());
pHorror.phase = "post";
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ fest: "Sundance", id: "p999" }));
check("gate: unknown project rejected", badFlash());
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ id: pHorror.id }));
check("gate: unknown festival rejected", badFlash());
S().studio.week = 45;                 /* woy 45 — every edition has passed */
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ fest: "AFI Fest", id: pHorror.id }));
check("gate: past edition rejected (woy > festival week)", badFlash());
S().studio.week = 2;                  /* back inside the year */
S().studio.cash = 1;
S().flash.length = 0;
ctx.festivalAction("fest-premiere", btn({ fest: "Fantasia", id: pHorror.id }));
check("gate: insufficient cash rejected", badFlash());
S().studio.cash = 40;
const okPremiere = ctx.festPlanPremiere("Fantasia", pHorror.id);
check("eligible premiere still succeeds after all gates", okPremiere && okPremiere.ok === true && pHorror.premiereFest === "Fantasia" && pHorror.buzz === 5);

/* ── PR-submission display (guarded S.pr read) + fallback ─────── */
ctx.prEnsure();                     /* pr.js is lazy-ensured — create S.pr up front */
S().pr.fested[pDrama.id] = true;      /* as if prFestSubmit had run (TIFF w36 is in 34–38) */
const tiffHtml = ctx.FESTIVAL_DESKS[0].render();
check("TIFF card shows PR submissions from guarded S.pr.fested",
  tiffHtml.indexOf("PR submissions") >= 0 && tiffHtml.indexOf(pDrama.title) >= 0);
check("Sundance card (outside 34–38) does not claim PR submissions",
  (() => { const i = tiffHtml.indexOf("Sundance"); const seg = tiffHtml.substring(i, tiffHtml.indexOf("Cannes", i)); return seg.indexOf("PR submissions") < 0; })());
const prBak = S().pr;
const pFresh = plantProject("comedy"); /* fresh post/ready project so the fallback has a candidate (TIFF taste) */
delete S().pr;                        /* old-save shape: no PR namespace at all */
let noPr = null;
try { noPr = ctx.FESTIVAL_DESKS[0].render(); } catch (e) { noPr = "THREW: " + e.message; }
check("board renders without S.pr (fallback: eligible projects shown, no throw)",
  typeof noPr === "string" && noPr.indexOf("fest-premiere") >= 0 && noPr.indexOf("PR submissions") < 0);
S().pr = prBak;

/* ── 110-week drive with real premieres across festival weeks ─── */
let threw = null, premieres = 0, buzzed = 0;
for (let w = 0; w < 110 && !threw && !S().over; w++) {
  const st = S().studio;
  if (st.cash > 15 && S().projects.filter((p) => !p.releaseWeek).length < 2 && S().ideas.length) {
    const idea = S().ideas[0];
    const dir = S().market.find((t) => t.k === "dir" && !ctx.talentBusy(t));
    const act = S().market.find((t) => t.k === "actor" && !ctx.talentBusy(t));
    if (dir && act) ctx.greenlight(idea.id, { scale: "micro", bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 0 });
  }
  S().projects.forEach((p) => {
    if (p.phase === "ready" && !p.releaseWeek && st.cash > 10) ctx.setRelease(p, st.week + 2, 0);
  });
  for (const fest of ctx.FESTIVALS) {
    if (ctx.woyOf(st.week) === fest.w) {
      const cand = S().projects.find((p) => (p.phase === "post" || p.phase === "ready") && fest.genres.indexOf(p.genre) >= 0 && !p.premiereFest);
      if (cand && st.cash >= 10) {   /* keep a buffer — never premiere the studio broke */
        const r = ctx.festPlanPremiere(fest.name, cand.id);
        if (r.ok) { premieres++; buzzed += 5; }
      }
    }
  }
  if (st.cash < 10 && S().loans.length < 2) ctx.takeLoan();  /* engine's own emergency loan */
  try { ctx.advanceWeek(); } catch (e) { threw = e; }
  if (!isFinite(S().studio.cash)) threw = new Error("NaN cash at week " + st.week);
}
check("110-week drive (2 award years): no throw, cash finite, no bankruptcy", !threw && !S().over, threw && threw.message);
check("drive landed at least one real premiere", premieres >= 1, premieres + " premieres");
check("every premiéred project carries p.premiereFest and buzz ≥ 5",
  S().films.concat(S().projects).every((p) => !p.premiereFest || p.buzz >= 5));
check("desk renders clean at drive end (mixed past/upcoming editions)", (() => {
  const h3 = ctx.FESTIVAL_DESKS[0].render();
  return typeof h3 === "string" && h3.indexOf("NaN") < 0 && h3.indexOf("undefined") < 0 && h3.indexOf("Passed") >= 0;
})());

console.log(failures ? "\n" + failures + " check(s) FAILED" : "\nall festivals checks passed");
process.exit(failures ? 1 : 0);
