import { Handlers } from "$fresh/server.ts";
import { getDb } from "../../utils/db.ts";
import { getDistinctBatches } from "../../utils/queries.ts";

export const handler: Handlers = {
  GET(_req) {
    const db = getDb();
    const batches = getDistinctBatches(db);

    return new Response(JSON.stringify({ batches }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
