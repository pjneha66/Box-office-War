/* Rebuild awards-module harness (pattern from test/rebuild-bizdeal.mjs): runs
   game/data.js + game/engine.js + game/pr.js + game/awards.js in a VM sandbox
   with a stubbed localStorage. ui.js needs a DOM, so the two ui string helpers
   the desk renders with (tag, statrow) are stubbed verbatim.
   Checks: extraAwardCategories against fake yearFilms (news, heat/skill bumps,
   $3M soundtrack bump, FYC payoff), guards for empty input, the year-end path
   through real advanceWeek() (engine yearAwards → extraAwardCategories with real
   releases), the Awards history desk, awardsAction, forecastAdjust_awards → 0. */
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

const ctx = vm.createContext({
  console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  /* ui.js helpers (ui.js itself can't load without a DOM); same behavior as ui.js */
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  render: () => {}, drainFlash: () => {}
});
for (const f of ["data.js", "engine.js", "pr.js", "awards.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
ctx.newGame("Trophy Test", "veteran");
ctx.prEnsure();                     /* pr.js is lazy-ensured — create S.pr up front */
const S = () => ctx.S;

/* ── desks & hooks shape ──────────────────────────────────────── */
check("AWARDS_DESKS is a one-desk array in group 'Awards' (id aw-hist, icon 🏆)",
  Array.isArray(ctx.AWARDS_DESKS) && ctx.AWARDS_DESKS.length === 1 &&
  ctx.AWARDS_DESKS[0].id === "aw-hist" && ctx.AWARDS_DESKS[0].group === "Awards" &&
  ctx.AWARDS_DESKS[0].icon === "🏆" && typeof ctx.AWARDS_DESKS[0].render === "function");
check("forecastAdjust_awards() → 0", ctx.forecastAdjust_awards() === 0);
check("awardsAction declines foreign actions (bridge falls through)", ctx.awardsAction("aw-bogus", null) === false);
check("extraAwardCategories([]) and (null) are safe no-ops",
  (ctx.extraAwardCategories([]), ctx.extraAwardCategories(null), S().aw.history.length === 0));

/* ── fake yearFilms: news + heat/skill bumps + soundtrack bump + FYC ── */
const actor = S().market.find((t) => t.k === "actor");
const dir = S().market.find((t) => t.k === "dir");
require(!!actor && !!dir, "market talent missing");
const fakeFilms = [
  { id: "fA", title: "The Aud Champ", genre: "drama", aud: 92, quality: 80, actId: actor.id, dirId: dir.id },
  { id: "fB", title: "Quality Champ", genre: "crime", aud: 71, quality: 93, actId: actor.id, dirId: dir.id }
];
S().pr.campaigns.fA = 3;           /* as if prFycBuy had run for film A */
const heat0 = actor.heat, skill0 = dir.skill, cash0 = S().studio.cash;
ctx.extraAwardCategories(fakeFilms);

const newsTxt = S().news.map((n) => n.txt).join(" | ");
check("Best Actor goes to the highest-aud film with a 'wins Best Actor' news line",
  newsTxt.indexOf("wins Best Actor") >= 0 && newsTxt.indexOf("The Aud Champ") >= 0);
check("lead gets heat +1 (engine's 0..3 cap)", actor.heat === Math.min(heat0 + 1, 3), heat0 + " → " + actor.heat);
check("Best Director goes to the highest-quality film with news",
  newsTxt.indexOf("wins Best Director") >= 0 && newsTxt.indexOf("Quality Champ") >= 0);
check("director gets skill +2 (engine's 97 cap)", dir.skill === Math.min(97, skill0 + 2), skill0 + " → " + dir.skill);
check("Best Original Song earns the studio $3M 'Soundtrack award bump'",
  S().studio.cash === cash0 + 3 && newsTxt.indexOf("oundtrack award bump") >= 0 &&
  (!S().weekTx || S().weekTx.rows.some((r) => r.k.indexOf("Soundtrack award bump") >= 0)),
  ctx.fm(S().studio.cash - cash0));
check("FYC payoff news logged for the campaigned film", newsTxt.indexOf("FYC paid off") >= 0);
check("all three winners recorded in S.aw.history (year stamped)",
  S().aw.history.length === 3 &&
  S().aw.history.map((h) => h.cat).join(",") === "Best Actor,Best Director,Best Original Song" &&
  S().aw.history.every((h) => h.y === S().studio.year));
check("no FYC payoff for the uncampaigned film's categories",
  (S().aw.history[1].film === "Quality Champ") && (S().pr.campaigns.fB == null));

/* ── desk render (history now populated) ──────────────────────── */
const desk = ctx.AWARDS_DESKS[0];
let html = null;
try { html = desk.render(); } catch (e) { html = "THREW: " + e.message; }
check("aw-hist desk renders a clean body listing winners",
  typeof html === "string" && html.length > 40 && html.indexOf("Best Actor") >= 0 &&
  html.indexOf("The Aud Champ") >= 0 && html.indexOf("NaN") < 0 && html.indexOf("undefined") < 0);

/* ── year-end integration: real release → engine yearAwards → hook ── */
const idea = S().ideas[0];
const dir2 = S().market.find((t) => t.k === "dir" && !ctx.talentBusy(t));
const act2 = S().market.find((t) => t.k === "actor" && !ctx.talentBusy(t));
const gr = ctx.greenlight(idea.id, { scale: "micro", bIdx: 0, dirId: dir2.id, actorId: act2.id, mktIdx: 0 });
require(!gr.err, "greenlight failed: " + (gr && gr.err));
let threw = null;
for (let w = 0; w < 54 && !threw; w++) {
  const st = S().studio;
  S().projects.forEach((p) => {
    if (p.phase === "ready" && !p.releaseWeek) ctx.setRelease(p, st.week + 2, 0);
  });
  try { ctx.advanceWeek(); } catch (e) { threw = e; }
  if (!isFinite(S().studio.cash)) threw = new Error("NaN cash at week " + st.week);
}
check("54 advanceWeek() calls incl. year boundary: no throw, cash finite", !threw, threw && threw.message);
check("test film actually released in year 1 (integration premise)", S().stats.releases >= 1, String(S().stats.releases));
check("week past the year-end awards (woy 52)", S().studio.week >= 53, "week " + S().studio.week);
check("engine yearAwards fed extraAwardCategories: 3 fresh winners at year end",
  S().aw.history.length === 6 && S().aw.history.slice(3).every((h) => h.y === 1),
  "history " + S().aw.history.length);
check("desk still renders clean after the live year-end pass", (() => {
  const h2 = ctx.AWARDS_DESKS[0].render();
  return typeof h2 === "string" && h2.indexOf("NaN") < 0 && h2.indexOf("undefined") < 0;
})());

console.log(failures ? "\n" + failures + " check(s) FAILED" : "\nall awards checks passed");
process.exit(failures ? 1 : 0);
