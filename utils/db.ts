import { DB } from "sqlite/mod.ts";
import { Pond, PondCode } from "./types.ts";

const DB_PATH = Deno.env.get("DB_PATH") || "./data/saltworks.db";

let dbInstance: DB | null = null;

export function getDb(): DB {
  if (!dbInstance) {
    try {
      Deno.mkdirSync("./data", { recursive: true });
    } catch (_e) {
      // 目录已存在
    }
    dbInstance = new DB(DB_PATH);
    initTables(dbInstance);
    seedPonds(dbInstance);
  }
  return dbInstance;
}

function initTables(db: DB): void {
  db.execute(`
    CREATE TABLE IF NOT EXISTS ponds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (code IN ('A', 'B', 'C', 'D')),
      capacity_m3 REAL NOT NULL
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pond_id INTEGER NOT NULL,
      measured_at TEXT NOT NULL,
      baume_deg REAL NOT NULL CHECK (baume_deg >= 0 AND baume_deg <= 40),
      level_cm REAL NOT NULL,
      batch_tag TEXT NOT NULL,
      FOREIGN KEY (pond_id) REFERENCES ponds(id),
      UNIQUE(pond_id, measured_at)
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS harvest_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_tag TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      reason TEXT
    )
  `);

  db.execute(`CREATE INDEX IF NOT EXISTS idx_readings_batch ON readings(batch_tag)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_readings_pond_date ON readings(pond_id, measured_at)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_harvest_batch ON harvest_windows(batch_tag)`);
}

function seedPonds(db: DB): void {
  const existing = db.queryEntries<{ count: number }>("SELECT COUNT(*) as count FROM ponds")[0];
  if (existing.count > 0) return;

  const defaultPonds: Array<{ code: PondCode; capacity_m3: number }> = [
    { code: "A", capacity_m3: 5000 },
    { code: "B", capacity_m3: 4000 },
    { code: "C", capacity_m3: 3000 },
    { code: "D", capacity_m3: 2000 },
  ];

  for (const pond of defaultPonds) {
    db.query(
      "INSERT INTO ponds (code, capacity_m3) VALUES (?, ?)",
      [pond.code, pond.capacity_m3]
    );
  }
}

export function getPonds(db: DB): Pond[] {
  return db.queryEntries<Pond>("SELECT * FROM ponds ORDER BY code");
}

export function getPondByCode(db: DB, code: PondCode): Pond | undefined {
  return db.queryEntries<Pond>("SELECT * FROM ponds WHERE code = ?", [code])[0];
}

export function getPondById(db: DB, id: number): Pond | undefined {
  return db.queryEntries<Pond>("SELECT * FROM ponds WHERE id = ?", [id])[0];
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
