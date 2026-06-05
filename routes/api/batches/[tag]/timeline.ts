import { Handlers, PageProps } from "$fresh/server.ts";
import { getDb } from "../../utils/db.ts";
import { getBatchTimeline, evaluateDPoolConditions } from "../../utils/harvest.ts";
import { getReadingsByBatchAndPond, getHarvestWindowsByBatch } from "../../utils/queries.ts";
import { PondCode } from "../../utils/types.ts";
import { formatDateShanghai } from "../../utils/time.ts";
import { getPonds } from "../../utils/db.ts";

interface BatchTimelineParams {
  tag: string;
}

export const handler: Handlers = {
  GET(_req, ctx: PageProps<unknown, BatchTimelineParams>) {
    const tag = ctx.params.tag;
    const db = getDb();

    const hypotheticalHeader = _req.headers.get("X-Hypothetical-Readings");
    let hypotheticalReadings = [];
    if (hypotheticalHeader) {
      try {
        hypotheticalReadings = JSON.parse(decodeURIComponent(hypotheticalHeader));
      } catch (_e) {
        // 忽略无效的假设数据
      }
    }

    const timeline = getBatchTimeline(db, tag, hypotheticalReadings);

    return new Response(JSON.stringify(timeline), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
