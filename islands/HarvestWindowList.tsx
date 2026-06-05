import type { HarvestWindow } from "../utils/types.ts";

interface HarvestWindowListProps {
  windows: HarvestWindow[];
}

export default function HarvestWindowList({ windows }: HarvestWindowListProps) {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDuration = (opened: string, closed: string | null) => {
    if (!closed) return "进行中";
    const start = new Date(opened).getTime();
    const end = new Date(closed).getTime();
    const hours = Math.round((end - start) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}小时`;
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
  };

  const sortedWindows = [...windows].sort(
    (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
  );

  return (
    <div class="harvest-list">
      {sortedWindows.map((window) => (
        <div
          key={window.id}
          class={`harvest-item ${window.closed_at ? "closed" : ""}`}
        >
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="harvest-date">
                {window.closed_at ? (
                  <>
                    {formatDate(window.opened_at)} → {formatDate(window.closed_at)}
                  </>
                ) : (
                  <>
                    开启于 {formatDate(window.opened_at)}
                    <span style="margin-left: 0.5rem; color: var(--success); font-size: 0.75rem;">
                      ● 进行中
                    </span>
                  </>
                )}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                批次：{window.batch_tag} · 持续：{getDuration(window.opened_at, window.closed_at)}
              </div>
              <div class="harvest-reason">
                {window.reason}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
