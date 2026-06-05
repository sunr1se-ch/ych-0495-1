import { useState, useEffect, useCallback } from "preact/hooks";
import PondChart from "./PondChart.tsx";
import HypotheticalSidebar from "./HypotheticalSidebar.tsx";
import HarvestWindowList from "./HarvestWindowList.tsx";
import type { ReadingInput, PondCode, PondReading, HarvestWindow } from "../utils/types.ts";

interface DPondConditions {
  baume_ok_days: number;
  stable_level_days: number;
  latest_baume: number;
  latest_level_drop: number;
}

interface InitialSuggestion {
  message: string;
  d_pool_conditions: DPondConditions;
}

interface TimelineData {
  batch_tag: string;
  in_window: boolean;
  ponds: Record<PondCode, PondReading[]>;
  harvest_windows: HarvestWindow[];
  d_pool_conditions: DPondConditions;
}

interface Props {
  initialBatches: string[];
  initialBatch: string;
  initialInWindow: boolean;
  initialSuggestion: InitialSuggestion;
}

export default function DashboardApp(props: Props) {
  const [selectedBatch, setSelectedBatch] = useState(props.initialBatch);
  const [batches, setBatches] = useState<string[]>(props.initialBatches);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hypotheticalReadings, setHypotheticalReadings] = useState<ReadingInput[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem("hypotheticalReadings");
        return stored ? JSON.parse(stored) : [];
      } catch (_e) {
        return [];
      }
    }
    return [];
  });
  const [inWindow, setInWindow] = useState(props.initialInWindow);
  const [suggestion, setSuggestion] = useState(props.initialSuggestion);
  const [selectedWindowId, setSelectedWindowId] = useState<number | null>(null);
  const [zoomRange, setZoomRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("hypotheticalReadings", JSON.stringify(hypotheticalReadings));
    } catch (_e) {
      // 忽略存储错误
    }
  }, [hypotheticalReadings]);

  const fetchTimeline = useCallback(async (batch: string, hypo: ReadingInput[] = []) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (hypo.length > 0) {
        headers["X-Hypothetical-Readings"] = encodeURIComponent(JSON.stringify(hypo));
      }

      const res = await fetch(`/api/batches/${batch}/timeline`, { headers });
      if (!res.ok) throw new Error("获取数据失败");
      const data = await res.json();
      setTimeline(data);
      setInWindow(data.in_window);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline(selectedBatch, hypotheticalReadings);
  }, [selectedBatch, hypotheticalReadings, fetchTimeline]);

  const refreshBatches = async () => {
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      if (data.batches.length > 0) {
        setBatches(data.batches);
      }
    } catch (_e) {
      // 忽略错误
    }
  };

  const handleAddHypothetical = (reading: ReadingInput) => {
    setHypotheticalReadings((prev) => [...prev, reading]);
  };

  const handleRemoveHypothetical = (index: number) => {
    setHypotheticalReadings((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearHypothetical = () => {
    setHypotheticalReadings([]);
  };

  const formatDateShanghai = (date: Date | string): string => {
    const ASIA_SHANGHAI_OFFSET = 8 * 60;
    const parseShanghaiDate = (iso: string): Date => {
      const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        return new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5]),
          parseInt(match[6])
        );
      }
      const d = new Date(iso);
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      return new Date(utc + ASIA_SHANGHAI_OFFSET * 60000);
    };
    const d = typeof date === "string" ? parseShanghaiDate(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return formatDateShanghai(d);
  };

  const getLastDataDate = (): string => {
    if (!timeline) return formatDateShanghai(new Date());
    const allReadingDates: string[] = [];
    (["A", "B", "C", "D"] as PondCode[]).forEach((code) => {
      timeline.ponds[code]?.forEach((r) => allReadingDates.push(r.date));
    });
    return allReadingDates.sort().reverse()[0] || formatDateShanghai(new Date());
  };

  const handleSelectWindow = (window: HarvestWindow) => {
    const startDate = formatDateShanghai(window.opened_at);
    const endDate = window.closed_at
      ? formatDateShanghai(window.closed_at)
      : getLastDataDate();

    const zoomStart = addDays(startDate, -2);
    const zoomEnd = addDays(endDate, 2);

    setSelectedWindowId(window.id);
    setZoomRange({ start: zoomStart, end: zoomEnd });
  };

  const handleResetZoom = () => {
    setSelectedWindowId(null);
    setZoomRange(null);
  };

  const getLatestReading = (code: PondCode) => {
    if (!timeline) return null;
    const readings = timeline.ponds[code];
    if (!readings || readings.length === 0) return null;
    return readings[readings.length - 1];
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div class="page-header">
        <div>
          <h1>盐田阶梯蒸发池卤度批次追溯看板</h1>
          <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem;">
            {suggestion.message}
          </p>
        </div>
        <div class="controls">
          <label style="font-size: 0.875rem; color: var(--text-muted);">选择批次：</label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch((e.target as HTMLSelectElement).value)}
          >
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button class="secondary" onClick={refreshBatches}>
            刷新批次
          </button>
        </div>
      </div>

      {error && (
        <div class="alert error">
          {error}
        </div>
      )}

      {hypotheticalReadings.length > 0 && (
        <div class="alert success">
          📊 预览模式：当前显示包含 {hypotheticalReadings.length} 条假设录入数据
          <button
            class="secondary"
            style="margin-left: 1rem; padding: 0.25rem 0.75rem; font-size: 0.75rem;"
            onClick={handleClearHypothetical}
          >
            清除假设
          </button>
        </div>
      )}

      <div class="stat-grid">
        {(["A", "B", "C", "D"] as PondCode[]).map((code) => {
          const latest = getLatestReading(code);
          return (
            <div key={code} class={`stat-card ${code.toLowerCase()}`}>
              <div class="stat-label">{code}池 - 最新读数</div>
              <div class="stat-value">
                {latest ? `${latest.baume_deg.toFixed(1)}°Bé` : "--"}
              </div>
              <div class="stat-sub">
                {latest
                  ? `液面 ${latest.level_cm.toFixed(1)}cm · ${latest.date}`
                  : "暂无数据"}
              </div>
            </div>
          );
        })}
      </div>

      <div class="grid">
        <div class="main-content">
          <div class="card">
            <h2>四池蒸发曲线</h2>
            <div class="legend">
              <div class="legend-item">
                <span class="legend-dot a"></span>
                A池
              </div>
              <div class="legend-item">
                <span class="legend-dot b"></span>
                B池
              </div>
              <div class="legend-item">
                <span class="legend-dot c"></span>
                C池
              </div>
              <div class="legend-item">
                <span class="legend-dot d"></span>
                D池
              </div>
              <div class="legend-item" style="margin-left: auto;">
                <span class="legend-dot" style="background: #64748b; border-radius: 50%;"></span>
                实测数据
              </div>
              <div class="legend-item">
                <span style="width: 12px; height: 12px; display: inline-block; border: 2px solid #64748b; transform: rotate(45deg);"></span>
                假设数据
              </div>
            </div>
            {loading ? (
              <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                加载中...
              </div>
            ) : timeline ? (
              <PondChart
                timeline={timeline}
                hypotheticalReadings={hypotheticalReadings}
                zoomRange={zoomRange}
                onResetZoom={handleResetZoom}
              />
            ) : (
              <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                暂无数据，请先录入读数
              </div>
            )}
          </div>

          <div class="card">
            <h2>D池收卤条件判定</h2>
            {timeline && (
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                <div style="padding: 1rem; background: #f8fafc; border-radius: 8px;">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">连续波美度达标</div>
                  <div style="font-size: 1.5rem; font-weight: 700;">
                    {timeline.d_pool_conditions.baume_ok_days}
                    <span style="font-size: 0.875rem; color: var(--text-muted);">/2天</span>
                  </div>
                </div>
                <div style="padding: 1rem; background: #f8fafc; border-radius: 8px;">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">连续液面稳定</div>
                  <div style="font-size: 1.5rem; font-weight: 700;">
                    {timeline.d_pool_conditions.stable_level_days}
                    <span style="font-size: 0.875rem; color: var(--text-muted);">/2天</span>
                  </div>
                </div>
                <div style="padding: 1rem; background: #f8fafc; border-radius: 8px;">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">最新波美度</div>
                  <div style="font-size: 1.5rem; font-weight: 700;">
                    {timeline.d_pool_conditions.latest_baume.toFixed(1)}
                    <span style="font-size: 0.875rem; color: var(--text-muted);">°Bé</span>
                  </div>
                </div>
                <div style="padding: 1rem; background: #f8fafc; border-radius: 8px;">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">最新液面降幅</div>
                  <div style="font-size: 1.5rem; font-weight: 700;">
                    {timeline.d_pool_conditions.latest_level_drop.toFixed(1)}
                    <span style="font-size: 0.875rem; color: var(--text-muted);">cm</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div class="card">
            <h2>历史收卤窗口</h2>
            {timeline && timeline.harvest_windows.length > 0 ? (
              <HarvestWindowList
                windows={timeline.harvest_windows}
                selectedWindowId={selectedWindowId}
                onSelect={handleSelectWindow}
              />
            ) : (
              <div style="color: var(--text-muted); font-size: 0.875rem;">
                暂无历史收卤记录
              </div>
            )}
          </div>
        </div>

        <div class="sidebar">
          <HypotheticalSidebar
            selectedBatch={selectedBatch}
            hypotheticalReadings={hypotheticalReadings}
            onAdd={handleAddHypothetical}
            onRemove={handleRemoveHypothetical}
            onClear={handleClearHypothetical}
          />
        </div>
      </div>
    </div>
  );
}
