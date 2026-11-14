/* Rebuild sim harness: runs the new game/engine.js in a VM sandbox with a stubbed
   localStorage, drives a scripted studio bot for N weeks and reports economy stats.
   Usage: node test/rebuild-sim.mjs [weeks] [runs] */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

function makeCtx() {
  const mem = {};
  return {
    console,
    Math,
    JSON,
    Date,
    isFinite,
    isNaN,
    parseInt,
    parseFloat,
    Number,
    String,
    Object,
    Array,
    Promise,
    navigator: {},
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    }
  };
}

function loadEngine(ctx) {
  const sandbox = vm.createContext(ctx);
  const files = ["data.js", "engine.js", "tv.js", "empire.js", "pr.js", "biz.js", "ott.js", "games.js", "library.js", "exhibition.js", "creative.js", "finance.js", "challenges.js", "i18n.js", "sound.js", "posters.js", "people.js", "media.js", "strategy.js", "meta.js", "tech.js", "events2.js", "bizdeal.js", "slots.js", "meta2.js", "crew.js", "mastery.js", "world.js", "licensing.js", "awards.js", "festivals.js"]
    .filter((f) => existsSync(path.join(gameDir, f)));
  loaded = files;
  for (const f of files) {
    vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), sandbox, { filename: f });
  }
}
let loaded = [];

function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function runCareer(weeks, origin) {
  const ctx = makeCtx();
  loadEngine(ctx);
  ctx.newGame("Bot Pictures", origin || "veteran");
  let errors = 0;
  let bankrupt = false;
  const rois = [];
  const openings = [];

  const botStep = () => {
    const S = ctx.S;
    if (!S || S.over) return;
    const st = S.studio;
    // Keep ~2 productions running; scale by cash so the studio can actually finish a film
    if (S.projects.filter((p) => !p.releaseWeek).length < 2) {
      const ideas = S.ideas.slice().sort((a, b) => b.script - a.script);
      const idea = ideas[0];
      if (idea) {
        const scale = st.cash > 340 && st.rep >= 55 ? "tentpole"
          : st.cash > 140 && st.rep >= 30 ? "mid"
          : st.cash > 45 ? "indie" : "micro";
        const budget = ctx.scaleOf(scale).budgets[1];
        const dir = S.market
          .filter((t) => t.k === "dir" && t.bookedUntil <= st.week && ctx.feeFor(t, budget) < budget * 0.3)
          .sort((a, b) => (b.skill + (b.fit.indexOf(idea.genre) >= 0 ? 10 : 0)) - (a.skill + (a.fit.indexOf(idea.genre) >= 0 ? 10 : 0)))[0]
          || S.market.filter((t) => t.k === "dir" && t.bookedUntil <= st.week).sort((a, b) => a.fee - b.fee)[0];
        const actor = S.market
          .filter((t) => t.k === "actor" && t.bookedUntil <= st.week && ctx.feeFor(t, budget) < budget * 0.35)
          .sort((a, b) => (b.power + b.skill / 100) - (a.power + a.skill / 100))[0]
          || S.market.filter((t) => t.k === "actor" && t.bookedUntil <= st.week).sort((a, b) => a.fee - b.fee)[0];
        if (dir && actor) {
          const r = ctx.greenlight(idea.id, { scale, bIdx: 1, dirId: dir.id, actorId: actor.id, mktIdx: 1 });
          if (r.err) errors++;
        }
      }
    }
    // Schedule ready films 2 weeks out, dodge the heaviest clash weeks when possible
    S.projects.forEach((p) => {
      if (p.phase === "ready" && !p.releaseWeek) {
        let wk = st.week + 2;
        for (let c = 0; c < 5; c++) {
          const cand = st.week + 2 + c;
          if (ctx.rivalWeightAt(cand) < ctx.rivalWeightAt(wk)) wk = cand;
        }
        const mktCost = Math.round(p.budget * ctx.scaleOf(p.scale).mktRate * ctx.MKT_TIERS[2].mult * 10) / 10;
        const tier = st.cash > mktCost + 20 ? 2 : 0; // Standard when flush, Whisper when tight
        const r = ctx.setRelease(p, wk, tier);
        if (r.err) errors++;
      }
    });
    if (st.cash < 5 && S.loans.length < 2) ctx.takeLoan();
    // exercise integrator-owned systems
    if (!S.agency.founded && st.cash > 140) ctx.foundAgency();
    if (S.agency.founded && S.agency.clients.length < 3) {
      const c = S.market.find((t) => t.power >= 4 && !ctx.talentBusy(t) && S.agency.clients.indexOf(t.id) < 0);
      if (c) ctx.signClient(c.id);
    }
    if (S.lot.writers < 4 && st.cash > 80) ctx.hireLotStaff("writers");
    if (S.lot.crew < 4 && st.cash > 80) ctx.hireLotStaff("crew");
  };

  for (let w = 1; w <= weeks; w++) {
    botStep();
    try {
      ctx.advanceWeek();
    } catch (e) {
      console.error("THREW at week", w, e.stack || e);
      return { threw: true, errors };
    }
    const S = ctx.S;
    if (!S) return { threw: true, errors };
    if (!isFinite(S.studio.cash)) { console.error("NaN cash at week", w); return { threw: true, errors }; }
    S.films.forEach((f) => {
      if (f.profit != null) {
        if (!isFinite(f.profit)) { console.error("NaN profit on", f.title); errors++; }
        rois.push(f.profit / Math.max(f.cost, 0.1));
      }
      if (f.opening != null && isFinite(f.opening)) openings.push(f.opening);
    });
    if (S.over) { bankrupt = true; break; }
  }

  const S = ctx.S;
  return {
    threw: false, errors, bankrupt,
    weeksPlayed: S ? S.studio.week : 0,
    cash: S ? Math.round(S.studio.cash) : 0,
    rep: S ? Math.round(S.studio.rep) : 0,
    releases: S ? S.stats.releases : 0,
    hits: S ? S.stats.hits : 0,
    flops: S ? S.stats.flops : 0,
    bestOpen: S ? Math.round(S.stats.bestOpen) : 0,
    bestWW: S ? Math.round(S.stats.bestWW) : 0,
    lifetime: S ? Math.round(S.studio.lifetime) : 0,
    catalog: S ? Math.round(S.studio.catalog) : 0,
    rivalsYtd: S ? S.rivals.map((r) => Math.round(r.ytd)) : [],
    medianROI: +median(rois).toFixed(2),
    hitRate: rois.length ? +(rois.filter((r) => r > 0).length / rois.length).toFixed(2) : 0,
    roiCount: rois.length,
    maxOpen: openings.length ? Math.round(Math.max(...openings)) : 0,
    systems: [S.tv ? "tv" : null, S.emp ? "emp" : null, S.pr ? "pr" : null, S.biz ? "biz" : null].filter(Boolean).join("+") || "none"
  };
}

const weeks = parseInt(process.argv[2] || "300", 10);
const runs = parseInt(process.argv[3] || "6", 10);
console.log(`Simulating ${runs} careers × ${weeks} weeks…`);
let totalROI = [], totalHit = 0, bank = 0, threw = 0;
const origins = ["indie", "veteran", "major"];
for (let i = 0; i < runs; i++) {
  const r = runCareer(weeks, origins[i % origins.length]);
  if (r.threw) threw++;
  if (r.bankrupt) bank++;
  if (r.roiCount) totalROI.push(r.medianROI);
  totalHit += r.hitRate || 0;
  console.log(`  run ${i + 1} [${origins[i % origins.length]}] wk=${r.weeksPlayed} cash=${r.cash}M rep=${r.rep} rel=${r.releases} hits=${r.hits} flops=${r.flops} bestOpen=${r.bestOpen}M bestWW=${r.bestWW}M medROI=${r.medianROI} hitRate=${r.hitRate} bankrupt=${r.bankrupt} threw=${r.threw} errors=${r.errors} sys=${r.systems}`);
}
console.log(`\nAggregate: median-of-medians ROI=${median(totalROI).toFixed(2)} · avg hitRate=${(totalHit / runs).toFixed(2)} · bankruptcies=${bank}/${runs} · engine exceptions=${threw} · modules=${loaded.join(",") || "none"}`);
