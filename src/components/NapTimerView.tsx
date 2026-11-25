import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Bell } from 'lucide-react';
import { Alarm, SleepSettings } from '../types/sleep';
import { formatTimeString, pad2 } from '../utils/sleepMath';

interface NapTimerViewProps {
  now: Date;
  settings: SleepSettings;
  onTriggerNapAlarm: (alarm: Alarm) => void;
}

interface NapPreset {
  id: string;
  title: string;
  durationMin: number;
  includeOnset: boolean;
  subtitle: string;
  science: string;
}

const NAP_PRESETS: NapPreset[] = [
  {
    id: 'power_20',
    title: 'Power Nap',
    durationMin: 20,
    includeOnset: true,
    subtitle: '20 min rest · Stage 2 alertness',
    science: 'Wakes you just before deep slow-wave sleep begins so you stay sharp with zero grogginess.',
  },
  {
    id: 'nasa_26',
    title: 'Precision Nap',
    durationMin: 26,
    includeOnset: true,
    subtitle: '26 min rest · Peak focus',
    science: 'Matches aviation fatigue-recovery research for reaction speed and afternoon vigilance.',
  },
  {
    id: 'full_cycle',
    title: 'Full Cycle Nap',
    durationMin: 90,
    includeOnset: true,
    subtitle: '1 complete 90m cycle · Deep + REM',
    science: 'Completes one full NREM and REM cycle for memory consolidation, creativity, and physical reset.',
  },
];

export const NapTimerView: React.FC<NapTimerViewProps> = ({
  now,
  settings,
  onTriggerNapAlarm,
}) => {
  const [selectedId, setSelectedId] = useState<string>('full_cycle');
  const [includeOnset, setIncludeOnset] = useState<boolean>(true);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [totalSec, setTotalSec] = useState<number>(0);

  const selectedPreset =
    NAP_PRESETS.find((p) => p.id === selectedId) ?? NAP_PRESETS[2];

  const effectiveDurationMin =
    selectedPreset.id === 'full_cycle'
      ? settings.cycleLengthMinutes
      : selectedPreset.durationMin;

  const plannedTotalMin =
    effectiveDurationMin + (includeOnset ? settings.fallAsleepMinutes : 0);

  const targetEndRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning || targetEndRef.current === null) return;
    const interval = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((targetEndRef.current! - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        window.clearInterval(interval);
        setIsRunning(false);
        targetEndRef.current = null;
        const finishDate = new Date();
        onTriggerNapAlarm({
          id: `nap-${Date.now()}`,
          hour: finishDate.getHours(),
          minute: finishDate.getMinutes(),
          enabled: false,
          label: `${selectedPreset.title} Complete`,
          cycles: selectedPreset.id === 'full_cycle' ? 1 : null,
          cycleDurationMin: settings.cycleLengthMinutes,
          sleepDurationMin: effectiveDurationMin,
          repeatDays: [],
          tone: settings.defaultTone,
          fadeInSeconds: settings.defaultFadeInSeconds,
          snoozeMinutes: 5,
          createdAt: Date.now(),
        });
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [isRunning, onTriggerNapAlarm, selectedPreset, settings, effectiveDurationMin]);

  const handleSelectPreset = (id: string) => {
    setSelectedId(id);
    setIsRunning(false);
    setRemainingSec(null);
    targetEndRef.current = null;
  };

  const handleStartOrResume = () => {
    const startFromSec = remainingSec !== null ? remainingSec : plannedTotalMin * 60;
    if (remainingSec === null) {
      setTotalSec(startFromSec);
      setRemainingSec(startFromSec);
    }
    targetEndRef.current = Date.now() + startFromSec * 1000;
    setIsRunning(true);
  };

  const handlePause = () => {
    if (targetEndRef.current !== null) {
      const left = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
      setRemainingSec(left);
    }
    targetEndRef.current = null;
    setIsRunning(false);
  };

  const handleReset = () => {
    targetEndRef.current = null;
    setIsRunning(false);
    setRemainingSec(null);
  };

  const displaySec = remainingSec !== null ? remainingSec : plannedTotalMin * 60;
  const hrs = Math.floor(displaySec / 3600);
  const mins = Math.floor((displaySec % 3600) / 60);
  const secs = displaySec % 60;

  const progress =
    remainingSec !== null && totalSec > 0
      ? Math.min(1, Math.max(0, 1 - remainingSec / totalSec))
      : 0;

  const wakeTimeDate = new Date(now.getTime() + displaySec * 1000);
  const radius = 88;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Nap preset selector */}
      <div className="lg:col-span-5 space-y-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F6FA] tracking-tight">
            Cycle-Safe Naps
          </h1>
          <p className="text-sm text-[#8E99AD] mt-1">
            Avoid mid-deep sleep grogginess by capping naps at 20 minutes or completing one full {settings.cycleLengthMinutes}-minute cycle.
          </p>
        </div>

        <div className="space-y-2.5">
          {NAP_PRESETS.map((preset) => {
            const active = preset.id === selectedId;
            const minsVal =
              preset.id === 'full_cycle'
                ? settings.cycleLengthMinutes
                : preset.durationMin;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`w-full text-left rounded-2xl p-4 border transition-colors ${
                  active
                    ? 'bg-[#1A2130] border-[#F5A524]/45'
                    : 'bg-[#131822] border-white/[0.07] hover:bg-[#171E2B]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-base font-semibold text-[#F4F6FA]">
                    {preset.title}
                  </span>
                  <span
                    className={`font-mono text-sm font-medium tabular-nums ${
                      active ? 'text-[#F5A524]' : 'text-[#9BA5B7]'
                    }`}
                  >
                    {minsVal} min
                  </span>
                </div>
                <p className="text-xs text-[#9BA5B7] mt-1">{preset.subtitle}</p>
                <p className="text-xs text-[#6E7A91] mt-2 leading-relaxed">
                  {preset.science}
                </p>
              </button>
            );
          })}
        </div>

        {/* Include fall-asleep buffer toggle */}
        <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#F4F6FA]">
              Add fall-asleep buffer
            </p>
            <p className="text-xs text-[#8E99AD] mt-0.5 tabular-nums">
              Adds +{settings.fallAsleepMinutes} min before nap timer begins
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={includeOnset}
            onClick={() => {
              setIncludeOnset((v) => !v);
              handleReset();
            }}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              includeOnset ? 'bg-[#F5A524]' : 'bg-[#263042]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-[#0B0E14] transition-transform ${
                includeOnset ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Right: Active live countdown ring */}
      <div className="lg:col-span-7 rounded-3xl bg-[#131822] border border-white/[0.07] p-6 sm:p-8 flex flex-col items-center justify-center">
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="6"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#F5A524"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-medium text-[#8E99AD] mb-1">
              {selectedPreset.title}
            </span>
            <span className="font-display text-4xl sm:text-5xl font-semibold text-[#F4F6FA] tabular-nums tracking-tight">
              {hrs > 0
                ? `${hrs}:${pad2(mins)}:${pad2(secs)}`
                : `${pad2(mins)}:${pad2(secs)}`}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[#F5A524] mt-2 tabular-nums">
              <Bell className="w-3.5 h-3.5" />
              <span>
                Wake at{' '}
                {formatTimeString(
                  wakeTimeDate.getHours(),
                  wakeTimeDate.getMinutes(),
                  settings.use24Hour
                )}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#8E99AD] mt-5 tabular-nums text-center">
          {effectiveDurationMin} min sleep
          {includeOnset ? ` · +${settings.fallAsleepMinutes} min to fall asleep` : ' · Instant start'}
        </p>

        {/* Controls */}
        <div className="mt-6 flex items-center gap-3 w-full max-w-xs">
          {isRunning ? (
            <button
              type="button"
              onClick={handlePause}
              className="flex-1 min-h-[48px] px-5 rounded-2xl bg-[#1E2636] hover:bg-[#273146] text-[#F4F6FA] font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartOrResume}
              className="flex-1 min-h-[48px] px-5 rounded-2xl bg-[#F5A524] hover:bg-[#FBB53E] active:scale-[0.98] text-[#0B0E14] font-semibold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              {remainingSec !== null ? 'Resume Nap' : 'Start Nap Alarm'}
            </button>
          )}

          {remainingSec !== null && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset nap timer"
              className="min-h-[48px] min-w-[48px] rounded-2xl bg-[#1A2130] hover:bg-[#242D40] text-[#9BA5B7] hover:text-[#F4F6FA] flex items-center justify-center transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
