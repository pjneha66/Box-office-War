/* ═════════════════════════════════════════════════════════════════════════
   FAN-CONVENTIONS.JS — Studio Fan Club & Annual Comic-Con / Hall H Engine
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc (Fan Club & Convention Controller)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  function _getG(st){
    if(st) return st;
    if(typeof G !== "undefined") return G;
    if(typeof global !== "undefined" && global.G) return global.G;
    if(typeof window !== "undefined" && window.G) return window.G;
    return null;
  }

  function _getCashM(S){
    if(S && S.studio && typeof S.studio.cash === "number") return S.studio.cash;
    if(S && typeof S.cash === "number") return S.cash;
    return 0;
  }

  function _modCashM(S, deltaM){
    if(S && S.studio && typeof S.studio.cash === "number"){
      S.studio.cash = Math.round((S.studio.cash + deltaM) * 100) / 100;
    } else if(S && typeof S.cash === "number"){
      S.cash = Math.round((S.cash + deltaM) * 100) / 100;
    }
  }

  const FAN_TIERS = [
    { threshold: 0, title: "Local Cinephile Base", buzzMultiplier: 1.0 },
    { threshold: 100000, title: "Dedicated Studio Fandom", buzzMultiplier: 1.15 },
    { threshold: 500000, title: "Global Stan Base", buzzMultiplier: 1.30 },
    { threshold: 2000000, title: "Mega Cult Universe Fandom", buzzMultiplier: 1.50 }
  ];

  const CONVENTION_SCALES = {
    regional_expo: {
      id: "regional_expo",
      name: "Regional Pop Culture Expo",
      cost: 1.5, // $1.5M
      buzzBuff: 18,
      newFansMin: 25000,
      newFansMax: 60000,
      prestigeGain: 5,
      desc: "Studio booth and cast panel at regional entertainment expo."
    },
    comic_con_hall_h: {
      id: "comic_con_hall_h",
      name: "Comic-Con Hall H Mega Showcase",
      cost: 4.5, // $4.5M
      buzzBuff: 35,
      newFansMin: 80000,
      newFansMax: 180000,
      prestigeGain: 15,
      desc: "Packed 7,000-seat Hall H keynote with celebrity casts, exclusive teaser trailers, and viral social streams."
    },
    dedicated_studio_con: {
      id: "dedicated_studio_con",
      name: "Worldwide Studio D23-Style Expo",
      cost: 8.5, // $8.5M
      buzzBuff: 55,
      newFansMin: 200000,
      newFansMax: 450000,
      prestigeGain: 30,
      desc: "Sole-proprietor 3-day convention celebrating studio properties, games, merchandise, and next-decade slates."
    }
  };

  function initFanClub(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.fanClub){
      S.fanClub = {
        totalFans: 15000,
        weeklyBudget: 0.05, // default $0.05M ($50k/week)
        lastConventionWeek: null,
        conventionHistory: [],
        accumulatedBuzzBonus: 0
      };
    }
    return S.fanClub;
  }

  function setWeeklyBudget(budgetM, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initFanClub(S);
    const b = Math.max(0, Math.min(1.0, budgetM));
    S.fanClub.weeklyBudget = b;
    return { ok: true, weeklyBudget: b };
  }

  function advanceFanClubWeek(state){
    const S = _getG(state);
    if(!S) return null;
    initFanClub(S);

    const fc = S.fanClub;
    const budget = fc.weeklyBudget || 0;

    if(budget > 0){
      const cash = _getCashM(S);
      if(cash >= budget){
        _modCashM(S, -budget);
        const organicGrowth = Math.round(50 + (budget / 0.05) * 850);
        fc.totalFans = (fc.totalFans || 0) + organicGrowth;
      } else {
        fc.totalFans = Math.max(0, (fc.totalFans || 0) - 200);
      }
    }

    return {
      totalFans: fc.totalFans,
      weeklyBudget: fc.weeklyBudget
    };
  }

  function getCanHostConvention(state){
    const S = _getG(state);
    if(!S) return { canHost: false, cooldown: 52 };
    initFanClub(S);

    const currentWeek = S.week || 1;
    const last = S.fanClub.lastConventionWeek;
    if(last === null || last === undefined){
      return { canHost: true, cooldown: 0 };
    }
    const elapsed = currentWeek - last;
    const cooldown = Math.max(0, 52 - elapsed);
    return { canHost: cooldown === 0, cooldown };
  }

  function hostFanConvention(scaleId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initFanClub(S);

    const scale = CONVENTION_SCALES[scaleId];
    if(!scale) return { ok: false, msg: "Invalid convention scale: " + scaleId };

    const status = getCanHostConvention(S);
    if(!status.canHost){
      return { ok: false, msg: "Convention on cooldown. Please wait " + status.cooldown + " more weeks." };
    }

    const cash = _getCashM(S);
    if(cash < scale.cost){
      return { ok: false, msg: "Insufficient cash. Required: $" + scale.cost + "M" };
    }

    _modCashM(S, -scale.cost);

    const currentWeek = S.week || 1;
    S.fanClub.lastConventionWeek = currentWeek;

    const addedFans = Math.floor(Math.random() * (scale.newFansMax - scale.newFansMin + 1)) + scale.newFansMin;
    S.fanClub.totalFans = (S.fanClub.totalFans || 0) + addedFans;

    let buffedCount = 0;
    (S.films || []).forEach(f => {
      if(f.status === "in_production" || f.status === "post_production" || f.status === "scheduled" || f.status === "ready"){
        f.buzz = Math.min(100, (f.buzz || 40) + scale.buzzBuff);
        buffedCount++;
      }
    });

    if(S.studio && typeof S.studio.rep === "number"){
      S.studio.rep = Math.min(100, S.studio.rep + Math.round(scale.prestigeGain / 5));
    }

    const historyRecord = {
      week: currentWeek,
      scaleId: scale.id,
      scaleName: scale.name,
      cost: scale.cost,
      addedFans,
      buzzBuff: scale.buzzBuff,
      buffedFilms: buffedCount
    };
    S.fanClub.conventionHistory.push(historyRecord);

    if(typeof log === "function"){
      log("HOSTED " + scale.name + "! Converted +" + addedFans.toLocaleString() + " new fans. Boosted hype by +" + scale.buzzBuff + "% across unreleased slate.", "gold");
    }

    return {
      ok: true,
      data: historyRecord,
      msg: "Convention hosted with overwhelming fan acclaim!"
    };
  }

  function getFanClubTier(totalFans){
    let active = FAN_TIERS[0];
    for(let i = 0; i < FAN_TIERS.length; i++){
      if(totalFans >= FAN_TIERS[i].threshold){
        active = FAN_TIERS[i];
      }
    }
    return active;
  }

  function openFanClubModal(){
    const S = _getG();
    if(!S) return;
    initFanClub(S);

    const fc = S.fanClub;
    const tier = getFanClubTier(fc.totalFans || 0);
    const conStatus = getCanHostConvention(S);

    let h = "<h3>Studio Fan Club &amp; Annual Comic-Con Conventions</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Nurture a loyal fan base through weekly community budgets. Host an annual Comic-Con or Hall H showcase to trigger massive opening hype across all upcoming productions.</div>";

    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + (fc.totalFans || 0).toLocaleString() + "</div><div class='s-l'>Registered Fans</div></div>"+
      "<div class='stat'><div class='s-v'>" + tier.title + "</div><div class='s-l'>Fandom Tier</div></div>"+
      "<div class='stat'><div class='s-v'>$" + (fc.weeklyBudget ? (fc.weeklyBudget * 1000).toFixed(0) : "0") + "k/wk</div><div class='s-l'>Weekly Engagement</div></div>"+
      "<div class='stat'><div class='s-v' style='color:" + (conStatus.canHost ? "var(--good)" : "var(--gold)") + "'>" + (conStatus.canHost ? "READY" : conStatus.cooldown + " wks") + "</div><div class='s-l'>Convention Status</div></div>"+
    "</div>";

    h += "<div class='card' style='margin-bottom:14px'>"+
      "<div class='spread'><b>Weekly Community Engagement Budget</b><span>$" + ((fc.weeklyBudget || 0) * 1000).toFixed(0) + "k / week</span></div>"+
      "<div class='tiny muted' style='margin:4px 0'>Allocates weekly social media marketing, VIP screenings, and merchandise giveaways to grow audience base.</div>"+
      "<div class='row' style='gap:6px;margin-top:8px'>"+
        "<button class='btn btn-sm " + (fc.weeklyBudget === 0.025 ? "btn-primary" : "") + "' data-fcb='0.025'>$25k/wk</button>"+
        "<button class='btn btn-sm " + (fc.weeklyBudget === 0.1 ? "btn-primary" : "") + "' data-fcb='0.1'>$100k/wk</button>"+
        "<button class='btn btn-sm " + (fc.weeklyBudget === 0.35 ? "btn-primary" : "") + "' data-fcb='0.35'>$350k/wk</button>"+
        "<button class='btn btn-sm " + (fc.weeklyBudget === 0.75 ? "btn-primary" : "") + "' data-fcb='0.75'>$750k/wk</button>"+
      "</div>"+
    "</div>";

    h += "<div class='section-title'>Host Annual Fan Showcase / Convention</div><div class='grid g1' style='gap:8px'>";
    for(const key in CONVENTION_SCALES){
      const scale = CONVENTION_SCALES[key];
      h += "<div class='card spread'>"+
        "<div>"+
          "<b>" + scale.name + "</b>"+
          "<div class='tiny muted' style='margin:4px 0'>" + scale.desc + "</div>"+
          "<div class='tiny' style='color:var(--gold)'>Hype Buff: +" + scale.buzzBuff + "% buzz | New Fans: +" + (scale.newFansMin / 1000).toFixed(0) + "k-" + (scale.newFansMax / 1000).toFixed(0) + "k | Prestige: +" + scale.prestigeGain + "</div>"+
        "</div>"+
        "<div>"+
          (conStatus.canHost ? (
            "<button class='btn btn-sm btn-primary' data-hostcon='" + scale.id + "'>Host ($" + scale.cost + "M)</button>"
          ) : (
            "<button class='btn btn-sm' disabled>Cooldown (" + conStatus.cooldown + "w)</button>"
          ))+
        "</div>"+
      "</div>";
    }
    h += "</div>";

    if(typeof openModal === "function"){
      const v = openModal(h);
      if(v){
        v.querySelectorAll("[data-fcb]").forEach(btn => {
          btn.onclick = () => {
            setWeeklyBudget(+btn.dataset.fcb, S);
            if(typeof toast === "function") toast("Fan club budget updated", "good");
            openFanClubModal();
          };
        });
        v.querySelectorAll("[data-hostcon]").forEach(btn => {
          btn.onclick = () => {
            const res = hostFanConvention(btn.dataset.hostcon, S);
            if(res.ok){
              if(typeof toast === "function") toast(res.msg, "good");
              openFanClubModal();
              if(typeof render === "function") render();
            } else {
              if(typeof toast === "function") toast(res.msg, "bad");
            }
          };
        });
      }
    }
  }

  const FanConventionsAPI = {
    CONVENTION_SCALES,
    FAN_TIERS,
    initFanClub,
    setWeeklyBudget,
    advanceFanClubWeek,
    getCanHostConvention,
    hostFanConvention,
    getFanClubTier,
    openFanClubModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = FanConventionsAPI;
  }
  global.FanConventions = FanConventionsAPI;
  global.openFanClubModal = openFanClubModal;
})(typeof window !== "undefined" ? window : global);
