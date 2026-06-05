import { Handlers } from "$fresh/server.ts";
import { getDb } from "../../../utils/db.ts";
import { getHarvestSuggestion } from "../../../utils/harvest.ts";

export const handler: Handlers = {
  GET(req) {
    const url = new URL(req.url);
    const asOf = url.searchParams.get("as_of") || undefined;

    const db = getDb();
    const suggestion = getHarvestSuggestion(db, asOf);

    return new Response(JSON.stringify(suggestion), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
