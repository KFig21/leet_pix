// Sleeper stat keys → our canonical scoring keys (which match the keys in the
// stat catalog in @leetpix/shared). Only mapped keys are kept. Keys that need
// arithmetic (exclusive FG/TD tiers, XP misses, shutouts) are derived below,
// not listed here.
export const SLEEPER_STAT_MAP: Record<string, string> = {
  // ── Offense ──────────────────────────────────────────────────────────────
  pass_yd: "passingYards",
  pass_td: "passingTd",
  pass_int: "interception",
  rush_yd: "rushingYards",
  rush_td: "rushingTd",
  rec: "reception",
  rec_yd: "receivingYards",
  rec_td: "receivingTd",
  fum_lost: "fumbleLost",
  // ── Bonuses (top long-TD tier; yardage milestones + 40–49 tiers derived) ───
  pass_td_50p: "passingTd50p",
  rec_td_50p: "receivingTd50p",
  // ── Kicking (XP made + FG miss; made-FG tiers derived to avoid stacking) ───
  xpm: "xpMade",
  fgmiss: "fgMiss",
  // ── Team defense (DST) ─────────────────────────────────────────────────────
  sack: "dstSack",
  int: "dstInt",
  fum_rec: "dstFumRec",
  ff: "dstForcedFumble",
  def_td: "dstTd",
  def_st_td: "dstSpecialTeamsTd",
  pts_allow_1_6: "dstPtsAllow1_6",
  pts_allow_7_13: "dstPtsAllow7_13",
  pts_allow_14_20: "dstPtsAllow14_20",
  pts_allow_21_27: "dstPtsAllow21_27",
  pts_allow_28_34: "dstPtsAllow28_34",
  pts_allow_35p: "dstPtsAllow35p",
  // ── Individual defensive players (IDP) ─────────────────────────────────────
  idp_tkl_solo: "idpTackleSolo",
  idp_tkl_ast: "idpTackleAst",
  idp_sack: "idpSack",
  idp_int: "idpInt",
  idp_ff: "idpForcedFumble",
  idp_fum_rec: "idpFumRec",
  idp_pass_def: "idpPassDefended",
  idp_def_td: "idpTd",
  idp_safe: "idpSafety",
  idp_tkl_loss: "idpTackleForLoss",
  idp_qb_hit: "idpQbHit",
  idp_blk_kick: "idpBlockedKick",
};

/** Normalize a raw Sleeper stat object to our canonical stat line. */
export function normalizeSleeperStats(
  raw: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const num = (k: string): number =>
    typeof raw[k] === "number" ? raw[k] : 0;
  // Keep the line sparse and never emit a negative derived count.
  const set = (k: string, v: number) => {
    if (v > 0) out[k] = v;
  };

  // 1. Direct 1:1 mappings.
  for (const [key, value] of Object.entries(raw)) {
    const canonical = SLEEPER_STAT_MAP[key];
    if (canonical && typeof value === "number" && value !== 0) out[canonical] = value;
  }

  // 2. Kicking — exclusive made-FG tiers (0–39 / 40–49 / 50+) so a made FG is
  //    counted once, at its full tier value (a 55-yarder is only 50+, never
  //    also 0–39). Sleeper's fgm_40_49 is already the exclusive 40–49 range and
  //    fgm_50p is 50+, so the 0–39 tier is the total minus both. XP misses =
  //    attempts − makes.
  set("fgMade50p", num("fgm_50p"));
  set("fgMade40_49", num("fgm_40_49"));
  set("fgMade0_39", num("fgm") - num("fgm_40_49") - num("fgm_50p"));
  set("xpMiss", num("xpa") - num("xpm"));

  // 3. Long-TD bonus tiers, exclusive 40–49 / 50+ (added on top of the base TD).
  //    Sleeper's *_td_40p is cumulative (includes 50+), so subtract for 40–49.
  set("passingTd40_49", num("pass_td_40p") - num("pass_td_50p"));
  set("receivingTd40_49", num("rec_td_40p") - num("rec_td_50p"));

  // 4. Yardage milestone bonuses — exclusive per-game tiers derived from the raw
  //    yards we already have (so we aren't limited to Sleeper's fixed flags; a
  //    420-yd passing game fires only the 400+ tier, matching ESPN's P300/P400).
  const inRange = (v: number, lo: number, hi: number) => (v >= lo && v < hi ? 1 : 0);
  const py = num("pass_yd");
  const ry = num("rush_yd");
  const rey = num("rec_yd");
  set("bonusPassYd300_399", inRange(py, 300, 400));
  set("bonusPassYd400p", py >= 400 ? 1 : 0);
  set("bonusRushYd100_199", inRange(ry, 100, 200));
  set("bonusRushYd200p", ry >= 200 ? 1 : 0);
  set("bonusRecYd100_199", inRange(rey, 100, 200));
  set("bonusRecYd200p", rey >= 200 ? 1 : 0);

  // 5. Team-defense shutout (Sleeper only buckets from 1–6 upward).
  if (typeof raw["pts_allow"] === "number" && raw["pts_allow"] === 0) {
    out["dstPtsAllow0"] = 1;
  }

  return out;
}

/**
 * Normalize an MLB boxscore batting line to our canonical baseball keys.
 * Singles are derived (hits minus extra-base hits). Only nonzero keys are kept.
 */
export function normalizeMlbBatting(
  b: Record<string, number>,
): Record<string, number> {
  const hits = b.hits ?? 0;
  const doubles = b.doubles ?? 0;
  const triples = b.triples ?? 0;
  const homeRuns = b.homeRuns ?? 0;
  const single = Math.max(hits - doubles - triples - homeRuns, 0);

  const out: Record<string, number> = {};
  const set = (k: string, v: number) => {
    if (v) out[k] = v;
  };
  set("single", single);
  set("double", doubles);
  set("triple", triples);
  set("homeRun", homeRuns);
  set("rbi", b.rbi ?? 0);
  set("run", b.runs ?? 0);
  set("stolenBase", b.stolenBases ?? 0);
  set("walk", b.baseOnBalls ?? 0);
  return out;
}
