/* game/talent_agency.js — thin layer reusing engine.js agency system.
   Reuses: S.agency, foundAgency(), signClient(), upgradeDeal(), dropClient(),
   isAgencyClient(), feeFor() 0.9x agency discount, tickMine() commissions,
   endTheatrical() picDeal countdown, vAgencyDesk() UI desk (id talent-agency). */
function ensureTalentAgency() {
  if (S && S.agency && S.agency.commission_rate == null) S.agency.commission_rate = 0.10;
}
function tickTalentAgency() {
  if (!S || !S.agency || !S.agency.founded) return 0;
  var g = 0, i, t, f, hit;
  for (i = 0; i < S.agency.clients.length; i++) {
    t = findTalent(S.agency.clients[i]);
    if (!t) continue;
    hit = false;
    for (f = 0; f < S.films.length; f++) {
      if ((S.films[f].actId === t.id || S.films[f].dirId === t.id)
          && S.films[f].status === "done" && S.films[f].profit > 0
          && S.studio.week - S.films[f].releaseWeek <= 4) { hit = true; break; }
    }
    if (hit) { S.studio.rep = clamp(S.studio.rep + 1, 0, 100); g++; }
  }
  return g;
}
function talentAgencyAction(a, id) {
  var fn = { found: foundAgency, sign: signClient, upgrade: upgradeDeal, drop: dropClient }[a];
  return fn ? fn(id) : false;
}
if (typeof S !== "undefined" && S && S.agency) ensureTalentAgency();
