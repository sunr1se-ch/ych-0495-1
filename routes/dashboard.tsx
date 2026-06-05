import { Handlers, PageProps } from "$fresh/server.ts";
import DashboardApp from "../islands/DashboardApp.tsx";
import { getDb } from "../utils/db.ts";
import { getDistinctBatches } from "../utils/queries.ts";
import { getHarvestSuggestion } from "../utils/harvest.ts";
import { getBatchTag, nowInShanghai } from "../utils/time.ts";

interface DashboardData {
  batches: string[];
  currentBatch: string;
  inWindow: boolean;
  suggestion: {
    message: string;
    d_pool_conditions: {
      baume_ok_days: number;
      stable_level_days: number;
      latest_baume: number;
      latest_level_drop: number;
    };
  };
}

export const handler: Handlers = {
  GET(_req, ctx) {
    const db = getDb();
    const batches = getDistinctBatches(db);
    const currentBatch = getBatchTag(nowInShanghai());
    const suggestion = getHarvestSuggestion(db);

    const data: DashboardData = {
      batches: batches.length > 0 ? batches : [currentBatch],
      currentBatch,
      inWindow: suggestion.in_window,
      suggestion: {
        message: suggestion.message,
        d_pool_conditions: suggestion.d_pool_conditions,
      },
    };

    return ctx.render(data);
  },
};

export default function Dashboard(props: PageProps<DashboardData>) {
  const { data } = props;

  return (
    <div>
      {data.inWindow && (
        <div class="banner">
          🎯 D池已进入可收卤窗口！波美度≥26°Bé且液面稳定，建议及时收卤
        </div>
      )}
      <div class="container">
        <DashboardApp
          initialBatches={data.batches}
          initialBatch={data.currentBatch}
          initialInWindow={data.inWindow}
          initialSuggestion={data.suggestion}
        />
      </div>
    </div>
  );
}
