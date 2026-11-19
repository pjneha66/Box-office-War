/* test/rebuild-talent_agency.mjs — vm harness, 60 weeks. */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const storage = {};
globalThis.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

const code = readFileSync("game/data.js", "utf8") + "\n"
  + readFileSync("game/engine.js", "utf8") + "\n"
  + readFileSync("game/talent_agency.js", "utf8");
runInContext(code, createContext(globalThis));

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) { pass++; console.log("PASS:", msg); } else { fail++; console.log("FAIL:", msg); } }

newGame("Test Studio", "major", "std", "free");
ensureTalentAgency();

check(foundAgency(), "agency founded");
check(S.agency.founded === true && S.agency.commission_rate === 0.10, "state: founded + commission_rate 0.10");

const t = S.market.find(x => x.power >= 3 && !talentBusy(x));
check(!!t, "signable talent available");
if (t) {
  check(signClient(t.id), "sign client");
  check(S.agency.clients.indexOf(t.id) >= 0, "talent on roster");
  check(t.picDeal && t.picDeal.pics === 3, "3-picture deal");

  const fee = feeFor(t, 100);
  check(fee < t.fee, "agency discount applied to fee");

  const idea = S.ideas[0];
  const dir = S.market.find(x => x.k === "dir" && !talentBusy(x));
  if (idea && dir) {
    const r = greenlight(idea.id, { scale: "indie", bIdx: 1, dirId: dir.id, actorId: t.id, mktIdx: 1 });
    check(r.ok, "greenlight film with agency talent");
  }

  /* The film must actually reach theatres for the deal to count down:
     endTheatrical() is where picDeal.pics-- lives. Schedule the release the
     way the real UI does (setRelease once the project is ready), then run. */
  let guard = 0;
  while (guard++ < 40 && S.projects.some((p) => p.actId === t.id && p.phase !== "ready")) advanceWeek();
  const proj = S.projects.find((p) => p.actId === t.id);
  if (proj && proj.phase === "ready" && proj.releaseWeek == null) setRelease(proj, S.studio.week + 2, 1);
  /* setRelease() moves the project out of S.projects into the release queue,
     so wait on the film reaching "done" rather than on the project vanishing. */
  guard = 0;
  while (guard++ < 40) {
    const f = S.films.find((x) => x.actId === t.id);
    if (f && f.status === "done") break;
    advanceWeek();
  }
  check(t.picDeal == null || t.picDeal.pics < 3, "picDeal counts down after film run"
    + (t.picDeal ? " (pics " + t.picDeal.pics + ")" : " (fulfilled)"));

  const reps = tickTalentAgency();
  check(typeof reps === "number", "tickTalentAgency returns number");
}

console.log(pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
