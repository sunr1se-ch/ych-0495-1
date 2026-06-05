import { getDb } from "../utils/db.ts";

const db = getDb();

const ponds = db.queryEntries("SELECT * FROM ponds");
console.log("已初始化的盐池：");
console.table(ponds);

console.log("\n数据库初始化完成！");
