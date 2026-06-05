import { useEffect, useRef } from "preact/hooks";
import type { PondCode, PondReading, HarvestWindow } from "../utils/types.ts";

interface PondChartProps {
  timeline: {
    ponds: Record<PondCode, PondReading[]>;
    harvest_windows: HarvestWindow[];
    in_window: boolean;
  };
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

export default function PondChart({ timeline }: PondChartProps) {
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
      const sortedDates = Array.from(allDates).sort();

      if (sortedDates.length === 0) return;

      const xScale = (i: number) =>
        padding.left + (i / (sortedDates.length - 1 || 1)) * chartWidth;

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

        ctx.strokeStyle = style.line;
        ctx.lineWidth = 2;
        ctx.setLineDash(style.dash || []);
        ctx.beginPath();

        readings.forEach((r, i) => {
          const dateIndex = sortedDates.indexOf(r.date);
          if (dateIndex === -1) return;
          const x = xScale(dateIndex);
          const y = baumeScale(r.baume_deg);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        readings.forEach((r) => {
          const dateIndex = sortedDates.indexOf(r.date);
          if (dateIndex === -1) return;
          const x = xScale(dateIndex);
          const y = baumeScale(r.baume_deg);
          ctx.fillStyle = style.line;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      (["A", "B", "C", "D"] as PondCode[]).forEach((code) => {
        const readings = timeline.ponds[code];
        if (!readings || readings.length === 0) return;

        ctx.strokeStyle = POND_COLORS[code];
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();

        readings.forEach((r, i) => {
          const dateIndex = sortedDates.indexOf(r.date);
          if (dateIndex === -1) return;
          const x = xScale(dateIndex);
          const y = levelScale(r.level_cm);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
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
  }, [timeline]);

  return (
    <div ref={containerRef} class="chart-container">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
