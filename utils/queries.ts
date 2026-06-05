import { DB } from "sqlite/mod.ts";
import { Reading, ReadingInput, HarvestWindow, PondCode } from "./types.ts";
import { getPondByCode } from "./db.ts";

export function insertReading(db: DB, input: ReadingInput): Reading {
  const pond = getPondByCode(db, input.pond_code);
  if (!pond) {
    throw new Error(`Pond ${input.pond_code} not found`);
  }

  const existing = db.queryEntries<{ id: number }>(
    "SELECT id FROM readings WHERE pond_id = ? AND measured_at = ?",
    [pond.id, input.measured_at]
  );
  if (existing.length > 0) {
    throw new ConflictError("Reading already exists for this pond and time");
  }

  db.query(
    "INSERT INTO readings (pond_id, measured_at, baume_deg, level_cm, batch_tag) VALUES (?, ?, ?, ?, ?)",
    [pond.id, input.measured_at, input.baume_deg, input.level_cm, input.batch_tag]
  );

  const id = db.lastInsertRowId;
  return {
    id: Number(id),
    pond_id: pond.id,
    measured_at: input.measured_at,
    baume_deg: input.baume_deg,
    level_cm: input.level_cm,
    batch_tag: input.batch_tag,
  };
}

export function getReadingsByBatchAndPond(
  db: DB,
  batch_tag: string,
  pond_id: number
): Reading[] {
  return db.queryEntries<Reading>(
    "SELECT * FROM readings WHERE batch_tag = ? AND pond_id = ? ORDER BY measured_at",
    [batch_tag, pond_id]
  );
}

export function getDistinctBatches(db: DB): string[] {
  const rows = db.queryEntries<{ batch_tag: string }>(
    "SELECT DISTINCT batch_tag FROM readings ORDER BY batch_tag DESC"
  );
  return rows.map((r) => r.batch_tag);
}

export function getHarvestWindowsByBatch(db: DB, batch_tag: string): HarvestWindow[] {
  return db.queryEntries<HarvestWindow>(
    "SELECT * FROM harvest_windows WHERE batch_tag = ? ORDER BY opened_at",
    [batch_tag]
  );
}

export function getOpenHarvestWindow(db: DB, batch_tag: string): HarvestWindow | undefined {
  return db.queryEntries<HarvestWindow>(
    "SELECT * FROM harvest_windows WHERE batch_tag = ? AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1",
    [batch_tag]
  )[0];
}

export function openHarvestWindow(
  db: DB,
  batch_tag: string,
  opened_at: string,
  reason: string
): HarvestWindow {
  db.query(
    "INSERT INTO harvest_windows (batch_tag, opened_at, reason) VALUES (?, ?, ?)",
    [batch_tag, opened_at, reason]
  );
  const id = db.lastInsertRowId;
  return {
    id: Number(id),
    batch_tag,
    opened_at,
    closed_at: null,
    reason,
  };
}

export function closeHarvestWindow(
  db: DB,
  id: number,
  closed_at: string,
  reason: string
): void {
  db.query(
    "UPDATE harvest_windows SET closed_at = ?, reason = ? WHERE id = ?",
    [closed_at, reason, id]
  );
}

export function getReadingsForPondSince(
  db: DB,
  pond_id: number,
  since: string,
  as_of: string
): Reading[] {
  return db.queryEntries<Reading>(
    "SELECT * FROM readings WHERE pond_id = ? AND measured_at >= ? AND measured_at <= ? ORDER BY measured_at DESC",
    [pond_id, since, as_of]
  );
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
