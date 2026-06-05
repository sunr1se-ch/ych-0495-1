import { DB } from "sqlite/mod.ts";
import { Reading, HarvestSuggestion, PondCode, ReadingInput } from "./types.ts";
import { getPondByCode, getPonds } from "./db.ts";
import {
  getReadingsForPondSince,
  getOpenHarvestWindow,
  openHarvestWindow,
  closeHarvestWindow,
  insertReading,
  getReadingsByBatchAndPond,
  getHarvestWindowsByBatch,
} from "./queries.ts";
import {
  daysAgo,
  dateOnly,
  parseAsOfDate,
  formatISO,
  formatDateShanghai,
  getBatchTag,
} from "./time.ts";

const BAUME_THRESHOLD = 26;
const LEVEL_DROP_THRESHOLD = 5;
const REQUIRED_CONSECUTIVE_DAYS = 2;

export interface WindowConditions {
  baume_ok_days: number;
  stable_level_days: number;
  latest_baume: number;
  latest_level_drop: number;
  in_window: boolean;
  readings: Reading[];
}

export function evaluateDPoolConditions(
  readings: Reading[],
  asOf: Date
): WindowConditions {
  const sorted = [...readings].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
  );

  if (sorted.length === 0) {
    return {
      baume_ok_days: 0,
      stable_level_days: 0,
      latest_baume: 0,
      latest_level_drop: 0,
      in_window: false,
      readings: [],
    };
  }

  const latestBaume = sorted[0].baume_deg;
  let latestLevelDrop = 0;

  if (sorted.length >= 2) {
    latestLevelDrop = sorted[1].level_cm - sorted[0].level_cm;
  }

  const asOfStr = dateOnly(asOf);
  const windowStart = daysAgo(asOf, 14);

  const relevantReadings = sorted.filter((r) => {
    const d = new Date(r.measured_at);
    return d >= windowStart && dateOnly(d) <= asOfStr;
  });

  let consecutiveBaumeOk = 0;
  let consecutiveStableLevel = 0;
  const dailyReadings = new Map<string, Reading>();

  for (const r of relevantReadings) {
    const day = dateOnly(new Date(r.measured_at));
    if (!dailyReadings.has(day)) {
      dailyReadings.set(day, r);
    }
  }

  const sortedDays = Array.from(dailyReadings.keys()).sort().reverse();

  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i];
    const r = dailyReadings.get(day)!;

    if (r.baume_deg >= BAUME_THRESHOLD) {
      consecutiveBaumeOk++;
    } else {
      break;
    }

    if (i < sortedDays.length - 1) {
      const prevDay = sortedDays[i + 1];
      const prevR = dailyReadings.get(prevDay)!;
      const drop = prevR.level_cm - r.level_cm;
      if (drop < LEVEL_DROP_THRESHOLD) {
        consecutiveStableLevel++;
      } else {
        break;
      }
    }
  }

  const inWindow =
    consecutiveBaumeOk >= REQUIRED_CONSECUTIVE_DAYS &&
    consecutiveStableLevel >= REQUIRED_CONSECUTIVE_DAYS;

  return {
    baume_ok_days: consecutiveBaumeOk,
    stable_level_days: consecutiveStableLevel,
    latest_baume: latestBaume,
    latest_level_drop: latestLevelDrop,
    in_window: inWindow,
    readings: relevantReadings,
  };
}

export function getHarvestSuggestion(
  db: DB,
  asOf?: string
): HarvestSuggestion {
  const asOfDate = parseAsOfDate(asOf);
  const asOfStr = formatISO(asOfDate);
  const batchTag = getBatchTag(asOfDate);

  const pondD = getPondByCode(db, "D");
  if (!pondD) {
    return {
      as_of: asOfStr,
      in_window: false,
      batch_tag: batchTag,
      d_pool_conditions: {
        baume_ok_days: 0,
        stable_level_days: 0,
        latest_baume: 0,
        latest_level_drop: 0,
      },
      message: "D池未初始化",
    };
  }

  const since = formatISO(daysAgo(asOfDate, 30));
  const readings = getReadingsForPondSince(db, pondD.id, since, asOfStr);

  const conditions = evaluateDPoolConditions(readings, asOfDate);

  let message = "";
  if (conditions.in_window) {
    message = `D池已连续${conditions.baume_ok_days}天波美度≥${BAUME_THRESHOLD}°Bé，连续${conditions.stable_level_days}天液面降幅<${LEVEL_DROP_THRESHOLD}cm/日，可收卤！`;
  } else if (conditions.baume_ok_days < REQUIRED_CONSECUTIVE_DAYS) {
    message = `波美度连续达标${conditions.baume_ok_days}/${REQUIRED_CONSECUTIVE_DAYS}天，当前${conditions.latest_baume.toFixed(1)}°Bé`;
  } else {
    message = `液面稳定性连续达标${conditions.stable_level_days}/${REQUIRED_CONSECUTIVE_DAYS}天，最新降幅${conditions.latest_level_drop.toFixed(1)}cm`;
  }

  return {
    as_of: asOfStr,
    in_window: conditions.in_window,
    batch_tag: batchTag,
    d_pool_conditions: {
      baume_ok_days: conditions.baume_ok_days,
      stable_level_days: conditions.stable_level_days,
      latest_baume: conditions.latest_baume,
      latest_level_drop: conditions.latest_level_drop,
    },
    message,
  };
}

export function evaluateAndUpdateHarvestWindow(
  db: DB,
  batchTag: string,
  asOf: Date
): { in_window: boolean; updated: boolean } {
  const pondD = getPondByCode(db, "D");
  if (!pondD) return { in_window: false, updated: false };

  const since = formatISO(daysAgo(asOf, 30));
  const readings = getReadingsForPondSince(db, pondD.id, since, formatISO(asOf));
  const conditions = evaluateDPoolConditions(readings, asOf);

  const openWindow = getOpenHarvestWindow(db, batchTag);

  if (conditions.in_window && !openWindow) {
    openHarvestWindow(
      db,
      batchTag,
      formatISO(asOf),
      `连续${conditions.baume_ok_days}天波美度≥${BAUME_THRESHOLD}°Bé，液面稳定`
    );
    return { in_window: true, updated: true };
  }

  if (!conditions.in_window && openWindow) {
    closeHarvestWindow(
      db,
      openWindow.id,
      formatISO(asOf),
      `条件不满足：波美度${conditions.latest_baume.toFixed(1)}°Bé，降幅${conditions.latest_level_drop.toFixed(1)}cm`
    );
    return { in_window: false, updated: true };
  }

  return { in_window: !!openWindow, updated: false };
}

export function addReadingAndEvaluate(
  db: DB,
  input: ReadingInput
): { reading: ReturnType<typeof insertReading>; in_window: boolean } {
  const reading = insertReading(db, input);
  const measurementDate = new Date(input.measured_at);
  const result = evaluateAndUpdateHarvestWindow(db, input.batch_tag, measurementDate);
  return { reading, in_window: result.in_window };
}

export function getBatchTimeline(db: DB, batchTag: string, hypotheticalReadings: ReadingInput[] = []) {
  const ponds = getPonds(db);
  const allReadings: Record<PondCode, Reading[]> = {} as Record<PondCode, Reading[]>;

  for (const pond of ponds) {
    const dbReadings = getReadingsByBatchAndPond(db, batchTag, pond.id);
    const hypoForPond = hypotheticalReadings
      .filter((r) => r.pond_code === pond.code)
      .map((r) => ({
        id: -1,
        pond_id: pond.id,
        measured_at: r.measured_at,
        baume_deg: r.baume_deg,
        level_cm: r.level_cm,
        batch_tag: r.batch_tag,
      } as Reading));

    const merged = [...dbReadings, ...hypoForPond].sort(
      (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
    );

    allReadings[pond.code as PondCode] = merged;
  }

  const dReadings = allReadings["D"] || [];
  const latestDate = dReadings.length > 0
    ? new Date(dReadings[dReadings.length - 1].measured_at)
    : new Date();

  const conditions = evaluateDPoolConditions(dReadings, latestDate);
  const harvestWindows = getHarvestWindowsByBatch(db, batchTag);

  return {
    batch_tag: batchTag,
    in_window: conditions.in_window,
    ponds: {
      A: allReadings["A"]?.map((r) => ({
        date: formatDateShanghai(r.measured_at),
        baume_deg: r.baume_deg,
        level_cm: r.level_cm,
      })) || [],
      B: allReadings["B"]?.map((r) => ({
        date: formatDateShanghai(r.measured_at),
        baume_deg: r.baume_deg,
        level_cm: r.level_cm,
      })) || [],
      C: allReadings["C"]?.map((r) => ({
        date: formatDateShanghai(r.measured_at),
        baume_deg: r.baume_deg,
        level_cm: r.level_cm,
      })) || [],
      D: allReadings["D"]?.map((r) => ({
        date: formatDateShanghai(r.measured_at),
        baume_deg: r.baume_deg,
        level_cm: r.level_cm,
      })) || [],
    },
    harvest_windows: harvestWindows,
    d_pool_conditions: {
      baume_ok_days: conditions.baume_ok_days,
      stable_level_days: conditions.stable_level_days,
      latest_baume: conditions.latest_baume,
      latest_level_drop: conditions.latest_level_drop,
    },
  };
}
