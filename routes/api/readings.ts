import { Handlers } from "$fresh/server.ts";
import { getDb } from "../../utils/db.ts";
import { addReadingAndEvaluate } from "../../utils/harvest.ts";
import { ConflictError } from "../../utils/queries.ts";
import { ReadingInput } from "../../utils/types.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const input = (await req.json()) as ReadingInput;

      if (!input.pond_code || !input.measured_at || !input.batch_tag) {
        return new Response(
          JSON.stringify({ error: "缺少必填字段: pond_code, measured_at, batch_tag" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!["A", "B", "C", "D"].includes(input.pond_code)) {
        return new Response(
          JSON.stringify({ error: "pond_code 必须是 A, B, C, D 之一" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (input.baume_deg < 0 || input.baume_deg > 40) {
        return new Response(
          JSON.stringify({ error: "baume_deg 必须在 0-40 之间" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const db = getDb();
      const result = addReadingAndEvaluate(db, input);

      return new Response(
        JSON.stringify({
          success: true,
          reading: result.reading,
          in_window: result.in_window,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      if (e instanceof ConflictError) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
