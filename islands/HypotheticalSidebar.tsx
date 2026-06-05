import { useState } from "preact/hooks";
import type { ReadingInput, PondCode } from "../utils/types.ts";

interface HypotheticalSidebarProps {
  selectedBatch: string;
  hypotheticalReadings: ReadingInput[];
  onAdd: (reading: ReadingInput) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

export default function HypotheticalSidebar({
  selectedBatch,
  hypotheticalReadings,
  onAdd,
  onRemove,
  onClear,
}: HypotheticalSidebarProps) {
  const [pondCode, setPondCode] = useState<PondCode>("D");
  const [measuredAt, setMeasuredAt] = useState("");
  const [baumeDeg, setBaumeDeg] = useState("26");
  const [levelCm, setLevelCm] = useState("50");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    setMessage(null);

    const baume = parseFloat(baumeDeg);
    const level = parseFloat(levelCm);

    if (!measuredAt) {
      setMessage({ type: "error", text: "请选择测量时间" });
      return;
    }
    if (isNaN(baume) || baume < 0 || baume > 40) {
      setMessage({ type: "error", text: "波美度必须在 0-40 之间" });
      return;
    }
    if (isNaN(level) || level < 0) {
      setMessage({ type: "error", text: "液面必须大于 0" });
      return;
    }

    const reading: ReadingInput = {
      pond_code: pondCode,
      measured_at: new Date(measuredAt).toISOString(),
      baume_deg: baume,
      level_cm: level,
      batch_tag: selectedBatch,
    };

    onAdd(reading);
    setMessage({ type: "success", text: "假设数据已添加到预览（未落库）" });

    setTimeout(() => setMessage(null), 3000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div class="card">
      <h2 style="display: flex; align-items: center;">
        假设录入
        <span class="preview-badge">预览</span>
      </h2>
      <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">
        仅前端 session 预览，不写入数据库，用于模拟判定
      </p>

      {message && (
        <div class={`alert ${message.type}`} style="margin-bottom: 1rem;">
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label>盐池</label>
          <select value={pondCode} onChange={(e) => setPondCode((e.target as HTMLSelectElement).value as PondCode)}>
            <option value="A">A池</option>
            <option value="B">B池</option>
            <option value="C">C池</option>
            <option value="D">D池</option>
          </select>
        </div>

        <div class="form-group">
          <label>测量时间</label>
          <input
            type="datetime-local"
            value={measuredAt}
            onChange={(e) => setMeasuredAt((e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="form-group">
          <label>波美度 (°Bé)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="40"
            value={baumeDeg}
            onChange={(e) => setBaumeDeg((e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="form-group">
          <label>液面 (cm)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={levelCm}
            onChange={(e) => setLevelCm((e.target as HTMLInputElement).value)}
          />
        </div>

        <button type="submit" style="width: 100%;">
          添加到预览
        </button>
      </form>

      {hypotheticalReadings.length > 0 && (
        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label style="font-size: 0.875rem; font-weight: 500;">
              假设数据 ({hypotheticalReadings.length})
            </label>
            <button
              class="secondary"
              style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
              onClick={onClear}
            >
              清空
            </button>
          </div>
          <div class="hypothetical-list">
            {hypotheticalReadings.map((r, i) => (
              <div key={i} class="hypothetical-item">
                <span>
                  <strong>{r.pond_code}池</strong> {formatDate(r.measured_at)}
                  <br />
                  {r.baume_deg.toFixed(1)}°Bé · {r.level_cm.toFixed(1)}cm
                </span>
                <button onClick={() => onRemove(i)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
