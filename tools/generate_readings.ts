import { getDb } from "../utils/db.ts";
import { addReadingAndEvaluate } from "../utils/harvest.ts";
import { formatISO, getBatchTag } from "../utils/time.ts";
import type { PondCode } from "../utils/types.ts";

const db = getDb();

const BATCH_TAG = getBatchTag(new Date());
const DAYS = 10;

function generateBaume(code: PondCode, day: number): number {
  const base = { A: 5, B: 10, C: 15, D: 22 };
  const dailyIncrease = { A: 0.5, B: 0.8, C: 1.0, D: 1.2 };
  const value = base[code] + day * dailyIncrease[code] + (Math.random() - 0.5) * 0.5;
  return Math.min(40, Math.max(0, value));
}

function generateLevel(code: PondCode, day: number): number {
  const base = { A: 100, B: 90, C: 80, D: 70 };
  const dailyDrop = { A: 2, B: 2.5, C: 3, D: 2 };
  const value = base[code] - day * dailyDrop + (Math.random() - 0.5) * 1;
  return Math.max(0, value);
}

console.log(`生成 ${DAYS} 天的测试数据，批次：${BATCH_TAG}`);
console.log("D池最后3天数据将满足收卤条件（波美度≥26，液面降幅<5cm）");

const today = new Date();

for (let day = 0; day < DAYS; day++) {
  const date = new Date(today);
  date.setDate(date.getDate() - (DAYS - 1 - day));
  date.setHours(8, 0, 0, 0);

  const measuredAt = formatISO(date);

  for (const code of ["A", "B", "C", "D"] as PondCode[]) {
    let baume = generateBaume(code, day);
    let level = generateLevel(code, day);

    if (code === "D" && day >= DAYS - 3) {
      baume = 26.5 + Math.random() * 1;
    }
    if (code === "D" && day >= DAYS - 2) {
      level = 60 - (DAYS - 1 - day) * 2;
    }

    try {
      const result = addReadingAndEvaluate(db, {
        pond_code: code,
        measured_at: measuredAt,
        baume_deg: Math.round(baume * 10) / 10,
        level_cm: Math.round(level * 10) / 10,
        batch_tag: BATCH_TAG,
      });
      console.log(`✓ ${code}池 ${measuredAt.slice(0, 10)}: ${result.reading.baume_deg}°Bé, ${result.reading.level_cm}cm`);
      if (code === "D" && result.in_window) {
        console.log(`  🎯 D池进入可收卤窗口！`);
      }
    } catch (e) {
      console.log(`- ${code}池 ${measuredAt.slice(0, 10)}: 已存在，跳过`);
    }
  }
  console.log("---");
}

console.log("\n测试数据生成完成！");
console.log(`访问 http://localhost:8000/dashboard 查看看板`);
