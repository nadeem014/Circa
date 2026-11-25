import React from 'react';
import { BellRing, Sun, Moon } from 'lucide-react';
import { Alarm } from '../types/sleep';
import { formatDuration, formatTimeParts } from '../utils/sleepMath';

interface RingingOverlayProps {
  alarm: Alarm;
  now: Date;
  use24Hour: boolean;
  cycleLengthMinutes: number;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

export const RingingOverlay: React.FC<RingingOverlayProps> = ({
  alarm,
  now,
  use24Hour,
  cycleLengthMinutes,
  onDismiss,
  onSnooze,
}) => {
  const { timeText, period } = formatTimeParts(now.getHours(), now.getMinutes(), use24Hour);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between px-6 py-12 bg-[#090B10] text-[#F4F6FA] overflow-hidden"
      role="alertdialog"
      aria-modal="true"
      aria-label={`Alarm ringing: ${alarm.label || 'Wake up'}`}
    >
      {/* Subtle sunrise radial illumination */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 34%, rgba(245, 165, 36, 0.22) 0%, rgba(245, 165, 36, 0.05) 38%, rgba(9, 11, 16, 0) 70%)',
        }}
      />

      {/* Top context */}
      <div className="relative z-10 text-center space-y-2 mt-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F5A524]/15 border border-[#F5A524]/30 text-[#F5A524] mb-2">
          <BellRing className="w-7 h-7" />
        </div>
        <p className="text-base font-semibold text-[#F4F6FA]">
          {alarm.label || 'Cycle Complete — Time to Wake'}
        </p>
        {alarm.cycles && (
          <p className="text-sm text-[#9BA5B7] tabular-nums">
            {alarm.cycles} complete {alarm.cycles === 1 ? 'cycle' : 'cycles'} ·{' '}
            {formatDuration(alarm.sleepDurationMin ?? alarm.cycles * alarm.cycleDurationMin)} sleep
          </p>
        )}
      </div>

      {/* Center huge clock */}
      <div className="relative z-10 text-center my-6">
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-display text-7xl sm:text-8xl font-semibold tracking-tight tabular-nums text-[#F4F6FA]">
            {timeText}
          </span>
          {period && (
            <span className="font-display text-2xl sm:text-3xl font-medium text-[#F5A524]">
              {period}
            </span>
          )}
        </div>
        <p className="text-sm text-[#8E99AD] mt-3 max-w-xs mx-auto">
          You are at a light-sleep cycle boundary. Standing up now minimizes grogginess.
        </p>
      </div>

      {/* Bottom thumb-zone controls */}
      <div className="relative z-10 w-full max-w-sm space-y-3 pb-safe">
        <button
          type="button"
          onClick={onDismiss}
          className="w-full min-h-[56px] rounded-2xl bg-[#F5A524] hover:bg-[#FBB53E] active:scale-[0.98] text-[#0B0E14] font-semibold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-[#F5A524]/20 transition-all"
        >
          <Sun className="w-5 h-5" />
          Dismiss — I'm Awake
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSnooze(alarm.snoozeMinutes || 10)}
            className="min-h-[48px] rounded-2xl bg-[#161C29] hover:bg-[#1E2636] border border-white/[0.08] text-sm font-medium text-[#F4F6FA] transition-colors whitespace-nowrap"
          >
            Snooze {alarm.snoozeMinutes || 10} min
          </button>
          <button
            type="button"
            onClick={() => onSnooze(cycleLengthMinutes)}
            className="min-h-[48px] rounded-2xl bg-[#161C29] hover:bg-[#1E2636] border border-white/[0.08] text-sm font-medium text-[#9BA5B7] hover:text-[#F4F6FA] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Moon className="w-4 h-4 text-[#8DA2FB]" />
            +1 Cycle ({cycleLengthMinutes}m)
          </button>
        </div>
      </div>
    </div>
  );
};
