import { useEffect, useRef } from "preact/hooks";
import type { PondCode, PondReading, HarvestWindow, ReadingInput } from "../utils/types.ts";

interface PondChartProps {
  timeline: {
    ponds: Record<PondCode, PondReading[]>;
    harvest_windows: HarvestWindow[];
    in_window: boolean;
  };
  hypotheticalReadings: ReadingInput[];
  zoomRange: { start: string; end: string } | null;
  onResetZoom: () => void;
}

const POND_COLORS: Record<PondCode, string> = {
  A: "#3b82f6",
  B: "#8b5cf6",
  C: "#ec4899",
  D: "#ef4444",
};

const POND_STYLES: Record<PondCode, { line: string; dash?: number[] }> = {
  A: { line: "#3b82f6" },
  B: { line: "#8b5cf6" },
  C: { line: "#ec4899" },
  D: { line: "#ef4444", dash: [5, 5] },
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

const isHypotheticalPoint = (
  pondCode: PondCode,
  reading: PondReading,
  hypotheticalReadings: ReadingInput[]
): boolean => {
  const readingDate = formatDateShanghai(reading.date);
  return hypotheticalReadings.some((h) => {
    const hypoDate = formatDateShanghai(h.measured_at);
    return (
      h.pond_code === pondCode &&
      hypoDate === readingDate &&
      Math.abs(h.baume_deg - reading.baume_deg) < 0.001 &&
      Math.abs(h.level_cm - reading.level_cm) < 0.001
    );
  });
};

const drawDiamond = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  filled: boolean
) => {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

export default function PondChart({ timeline, hypotheticalReadings, zoomRange, onResetZoom }: PondChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 400 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = "400px";
      drawChart(canvas, dpr);
    };

    const drawChart = (canvas: HTMLCanvasElement, dpr: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const padding = { top: 40, right: 60, bottom: 60, left: 60 };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cssWidth = width / dpr;
      const cssHeight = height / dpr;
      const chartWidth = cssWidth - padding.left - padding.right;
      const chartHeight = cssHeight - padding.top - padding.bottom;

      const allDates = new Set<string>();
      (["A", "B", "C", "D"] as PondCode[]).forEach((code) => {
        timeline.ponds[code]?.forEach((r) => allDates.add(r.date));
      });
      let sortedDates = Array.from(allDates).sort();

      if (zoomRange) {
        sortedDates = sortedDates.filter(
          (d) => d >= zoomRange.start && d <= zoomRange.end
        );
      }

      if (sortedDates.length === 0) return;

      const xScale = (i: number) =>
        padding.left + (i / (sortedDates.length - 1 || 1)) * chartWidth;

      const getDateX = (dateStr: string): number | null => {
        const idx = sortedDates.indexOf(dateStr);
        if (idx === -1) {
          if (dateStr < sortedDates[0]) return padding.left;
          if (dateStr > sortedDates[sortedDates.length - 1]) return padding.left + chartWidth;
          return null;
        }
        return xScale(idx);
      };

      const baumeMin = 0;
      const baumeMax = 40;
      const baumeScale = (v: number) =>
        padding.top + chartHeight - ((v - baumeMin) / (baumeMax - baumeMin)) * chartHeight;

      const allLevels = [];
      (["A", "B", "C", "D"] as PondCode[]).forEach((code) => {
        timeline.ponds[code]?.forEach((r) => allLevels.push(r.level_cm));
      });
      const levelMin = Math.max(0, Math.min(...allLevels) - 10);
      const levelMax = Math.max(...allLevels, 100) + 10;
      const levelScale = (v: number) =>
        padding.top + chartHeight - ((v - levelMin) / (levelMax - levelMin)) * chartHeight;

      const getLastDataDate = (): string => {
        const allReadingDates: string[] = [];
        (["A", "B", "C", "D"] as PondCode[]).forEach((code) => {
          timeline.ponds[code]?.forEach((r) => allReadingDates.push(r.date));
        });
        return allReadingDates.sort().reverse()[0] || sortedDates[sortedDates.length - 1];
      };

      const lastDataDate = getLastDataDate();

      timeline.harvest_windows.forEach((window) => {
        const startDate = formatDateShanghai(window.opened_at);
        const endDate = window.closed_at
          ? formatDateShanghai(window.closed_at)
          : lastDataDate;

        const startX = getDateX(startDate);
        const endX = getDateX(endDate);

        if (startX !== null && endX !== null && startX < endX) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
          ctx.fillRect(
            startX,
            padding.top,
            endX - startX,
            chartHeight
          );
          ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX, padding.top);
          ctx.lineTo(startX, padding.top + chartHeight);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(endX, padding.top);
          ctx.lineTo(endX, padding.top + chartHeight);
          ctx.stroke();
        }
      });

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const y = padding.top + (i / 8) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }

      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 8; i++) {
        const value = baumeMax - (i / 8) * (baumeMax - baumeMin);
        const y = padding.top + (i / 8) * chartHeight;
        ctx.fillText(`${value.toFixed(0)}°`, padding.left - 10, y);
      }

      ctx.fillStyle = "#0f766e";
      ctx.textAlign = "left";
      for (let i = 0; i <= 8; i++) {
        const value = levelMax - (i / 8) * (levelMax - levelMin);
        const y = padding.top + (i / 8) * chartHeight;
        ctx.fillText(`${value.toFixed(0)}cm`, padding.left + chartWidth + 10, y);
      }

      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const labelStep = Math.max(1, Math.floor(sortedDates.length / 10));
      sortedDates.forEach((date, i) => {
        if (i % labelStep === 0 || i === sortedDates.length - 1) {
          const x = xScale(i);
          ctx.fillText(date.slice(5), x, padding.top + chartHeight + 10);
        }
      });

      ctx.fillStyle = "#0f766e";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("波美度 (°Bé)", padding.left / 2, padding.top + chartHeight / 2);

      ctx.save();
      ctx.translate(padding.left + chartWidth + 45, padding.top + chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("液面 (cm)", 0, 0);
      ctx.restore();

      (["A", "B", "C", "D"] as PondCode[]).forEach((code) => {
        const readings = timeline.ponds[code];
        if (!readings || readings.length === 0) return;

        const style = POND_STYLES[code];

        for (let i = 1; i < readings.length; i++) {
          const prevR = readings[i - 1];
          const currR = readings[i];
          const prevIdx = sortedDates.indexOf(prevR.date);
          const currIdx = sortedDates.indexOf(currR.date);
          if (prevIdx === -1 || currIdx === -1) continue;

          const prevIsHypo = isHypotheticalPoint(code, prevR, hypotheticalReadings);
          const currIsHypo = isHypotheticalPoint(code, currR, hypotheticalReadings);
          const segmentIsHypo = prevIsHypo || currIsHypo;

          const x1 = xScale(prevIdx);
          const y1 = baumeScale(prevR.baume_deg);
          const x2 = xScale(currIdx);
          const y2 = baumeScale(currR.baume_deg);

          ctx.strokeStyle = style.line;
          ctx.lineWidth = 2;
          ctx.globalAlpha = segmentIsHypo ? 0.3 : 1;
          ctx.setLineDash(style.dash || []);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        readings.forEach((r) => {
          const dateIndex = sortedDates.indexOf(r.date);
          if (dateIndex === -1) return;
          const x = xScale(dateIndex);
          const y = baumeScale(r.baume_deg);
          const isHypo = isHypotheticalPoint(code, r, hypotheticalReadings);

          if (isHypo) {
            drawDiamond(ctx, x, y, 5, style.line, false);
          } else {
            ctx.fillStyle = style.line;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });

      (["A", "B", "C", "D"] as PondCode[]).forEach((code) => {
        const readings = timeline.ponds[code];
        if (!readings || readings.length === 0) return;

        for (let i = 1; i < readings.length; i++) {
          const prevR = readings[i - 1];
          const currR = readings[i];
          const prevIdx = sortedDates.indexOf(prevR.date);
          const currIdx = sortedDates.indexOf(currR.date);
          if (prevIdx === -1 || currIdx === -1) continue;

          const prevIsHypo = isHypotheticalPoint(code, prevR, hypotheticalReadings);
          const currIsHypo = isHypotheticalPoint(code, currR, hypotheticalReadings);
          const segmentIsHypo = prevIsHypo || currIsHypo;

          const x1 = xScale(prevIdx);
          const y1 = levelScale(prevR.level_cm);
          const x2 = xScale(currIdx);
          const y2 = levelScale(currR.level_cm);

          ctx.strokeStyle = POND_COLORS[code];
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = segmentIsHypo ? 0.15 : 0.4;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });

      const baumeThresholdY = baumeScale(26);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, baumeThresholdY);
      ctx.lineTo(padding.left + chartWidth, baumeThresholdY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#10b981";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("≥26°Bé 阈值线", padding.left + 5, baumeThresholdY - 8);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [timeline, zoomRange, hypotheticalReadings]);

  return (
    <div>
      {zoomRange && (
        <div style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem;">
          <button class="secondary" onClick={onResetZoom} style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">
            重置视口
          </button>
        </div>
      )}
      <div ref={containerRef} class="chart-container">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
