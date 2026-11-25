import React from 'react';
import { CycleOption } from '../types/sleep';
import { formatTimeString } from '../utils/sleepMath';

interface HypnogramChartProps {
  selectedCycles: number;
  maxCycles?: number;
  cycleLengthMinutes: number;
  fallAsleepMinutes: number;
  options: CycleOption[];
  use24Hour: boolean;
  mode: 'sleep_now' | 'wake_at' | 'bed_at';
  onSelectCycle: (cycles: number) => void;
}

/**
 * Generates realistic ultradian sleep wave coordinates across N 90-minute cycles.
 * Early cycles go deeper into Slow-Wave Sleep (SWS); later cycles have longer REM
 * phases and gentler dips, rising to a shallow boundary at the end of every cycle.
 */
export const HypnogramChart: React.FC<HypnogramChartProps> = ({
  selectedCycles,
  maxCycles = 6,
  cycleLengthMinutes,
  fallAsleepMinutes,
  options,
  use24Hour,
  mode,
  onSelectCycle,
}) => {
  const width = 620;
  const height = 196;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Y levels: 0 = Awake (top), 1 = Deep (bottom)
  const yForDepth = (d: number) => padTop + d * plotH;

  // Onset occupies ~6% of horizontal axis
  const onsetWidth = Math.min(34, plotW * 0.065);
  const cycleWidth = (plotW - onsetWidth) / maxCycles;

  // Build smooth SVG path across all maxCycles
  const points: { x: number; y: number }[] = [];
  points.push({ x: padLeft, y: yForDepth(0.06) });
  points.push({ x: padLeft + onsetWidth, y: yForDepth(0.28) });

  for (let c = 0; c < maxCycles; c++) {
    const startX = padLeft + onsetWidth + c * cycleWidth;
    // Early cycles plunge deeper into SWS (depth ~0.95), later cycles stay lighter (~0.52)
    const maxDepth = Math.max(0.5, 0.96 - c * 0.085);
    const remHeight = Math.max(0.16, 0.24 - c * 0.014);

    // Descent into Light -> Deep
    points.push({ x: startX + cycleWidth * 0.22, y: yForDepth(maxDepth * 0.72) });
    points.push({ x: startX + cycleWidth * 0.44, y: yForDepth(maxDepth) });
    // Ascent into REM plateau
    points.push({ x: startX + cycleWidth * 0.72, y: yForDepth(remHeight + 0.14) });
    points.push({ x: startX + cycleWidth * 0.88, y: yForDepth(remHeight) });
    // Shallow cycle boundary (ideal refresh wake window)
    points.push({ x: startX + cycleWidth, y: yForDepth(0.11) });
  }

  // Catmull-Rom to cubic Bezier smoothing
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Clip active curve up to selectedCycles
  const selectedEndX = padLeft + onsetWidth + selectedCycles * cycleWidth;
  const fullPath = buildSmoothPath(points);
  const areaPath = `${fullPath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const optionByCycle = new Map(options.map((o) => [o.cycles, o]));
  const selectedOpt = optionByCycle.get(selectedCycles);

  const stageLines = [
    { label: 'Awake', depth: 0.08 },
    { label: 'REM', depth: 0.25 },
    { label: 'Light', depth: 0.52 },
    { label: 'Deep', depth: 0.92 },
  ];

  return (
    <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#F4F6FA] tracking-tight">
            90-Minute Sleep Architecture
          </h3>
          <p className="text-xs text-[#8E99AD] mt-0.5">
            Tap any cycle peak to wake at light sleep instead of deep slow-wave sleep
          </p>
        </div>
        {selectedOpt && (
          <div className="text-xs text-[#9BA5B7] tabular-nums">
            <span className="text-[#F5A524] font-semibold">
              {selectedOpt.cycles} {selectedOpt.cycles === 1 ? 'cycle' : 'cycles'}
            </span>
            <span className="mx-1.5 text-[#556075]" aria-hidden="true">·</span>
            <span>
              {mode === 'wake_at' ? 'Bed ' : 'Wake '}
              {formatTimeString(selectedOpt.targetHour, selectedOpt.targetMinute, use24Hour)}
            </span>
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Sleep hypnogram showing ${selectedCycles} cycles of ${cycleLengthMinutes} minutes`}
        >
          <defs>
            <linearGradient id="activeWaveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5A524" stopOpacity="0.22" />
              <stop offset="55%" stopColor="#8DA2FB" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#8DA2FB" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="activeWaveStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8DA2FB" />
              <stop offset="78%" stopColor="#B8C4F8" />
              <stop offset="100%" stopColor="#F5A524" />
            </linearGradient>
            <clipPath id="selectedCycleClip">
              <rect x={padLeft} y={0} width={Math.max(0, selectedEndX - padLeft)} height={height} />
            </clipPath>
          </defs>

          {/* Horizontal stage guide lines */}
          {stageLines.map((stage) => {
            const y = yForDepth(stage.depth);
            return (
              <g key={stage.label}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 4"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#6E7A91"
                  fontSize="10"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {stage.label}
                </text>
              </g>
            );
          })}

          {/* Sleep onset subtle marker */}
          <line
            x1={padLeft + onsetWidth}
            y1={padTop}
            x2={padLeft + onsetWidth}
            y2={padTop + plotH}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="2 3"
          />
          <text
            x={padLeft + onsetWidth / 2}
            y={padTop + plotH + 16}
            textAnchor="middle"
            fill="#6E7A91"
            fontSize="9.5"
            fontFamily="JetBrains Mono, monospace"
          >
            +{fallAsleepMinutes}m
          </text>

          {/* Inactive full wave backdrop */}
          <path
            d={fullPath}
            fill="none"
            stroke="rgba(141, 162, 251, 0.22)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Active selected sleep duration fill & curve */}
          <g clipPath="url(#selectedCycleClip)">
            <path d={areaPath} fill="url(#activeWaveFill)" />
            <path
              d={fullPath}
              fill="none"
              stroke="url(#activeWaveStroke)"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>

          {/* Interactive cycle boundary markers */}
          {Array.from({ length: maxCycles }, (_, idx) => {
            const cycleNum = idx + 1;
            const cx = padLeft + onsetWidth + cycleNum * cycleWidth;
            const cy = yForDepth(0.11);
            const isSelected = cycleNum === selectedCycles;
            const isAvailable = optionByCycle.has(cycleNum);
            const hrs = ((cycleNum * cycleLengthMinutes) / 60).toFixed(1).replace(/\.0$/, '');

            return (
              <g
                key={cycleNum}
                onClick={() => isAvailable && onSelectCycle(cycleNum)}
                className={isAvailable ? 'cursor-pointer' : 'opacity-40'}
              >
                {/* Vertical boundary guide */}
                <line
                  x1={cx}
                  y1={cy + 6}
                  x2={cx}
                  y2={padTop + plotH}
                  stroke={isSelected ? 'rgba(245, 165, 36, 0.45)' : 'rgba(255,255,255,0.05)'}
                  strokeWidth={isSelected ? 1.5 : 1}
                  strokeDasharray={isSelected ? '3 3' : '2 4'}
                />

                {/* Generous invisible hit area */}
                <circle cx={cx} cy={cy} r={22} fill="transparent" />

                {/* Outer glow ring when selected */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill="rgba(245, 165, 36, 0.2)"
                    stroke="rgba(245, 165, 36, 0.55)"
                    strokeWidth="1.2"
                  />
                )}

                {/* Marker dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 5 : 3.5}
                  fill={isSelected ? '#F5A524' : isAvailable ? '#9BA5B7' : '#3A4458'}
                  stroke="#0B0E14"
                  strokeWidth="1.5"
                />

                {/* Top cycle label */}
                <text
                  x={cx}
                  y={14}
                  textAnchor="middle"
                  fill={isSelected ? '#F5A524' : '#7A869E'}
                  fontSize="10"
                  fontWeight={isSelected ? 600 : 500}
                  fontFamily="JetBrains Mono, monospace"
                >
                  C{cycleNum}
                </text>

                {/* Bottom duration label */}
                <text
                  x={cx}
                  y={padTop + plotH + 16}
                  textAnchor="middle"
                  fill={isSelected ? '#F4F6FA' : '#7A869E'}
                  fontSize="10"
                  fontWeight={isSelected ? 600 : 400}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {hrs}h
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
