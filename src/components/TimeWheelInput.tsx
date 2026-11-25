import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { pad2 } from '../utils/sleepMath';

interface TimeWheelInputProps {
  hour: number; // 0-23
  minute: number; // 0-59
  use24Hour: boolean;
  onChange: (hour: number, minute: number) => void;
  presets?: { label: string; hour: number; minute: number }[];
  caption?: string;
}

export const TimeWheelInput: React.FC<TimeWheelInputProps> = ({
  hour,
  minute,
  use24Hour,
  onChange,
  presets,
  caption,
}) => {
  const isPM = hour >= 12;
  const displayHour = use24Hour ? pad2(hour) : String(hour % 12 === 0 ? 12 : hour % 12);

  const stepHour = (delta: number) => {
    const next = (hour + delta + 24) % 24;
    onChange(next, minute);
  };

  const stepMinute = (delta: number) => {
    const total = hour * 60 + minute + delta;
    const wrapped = ((total % 1440) + 1440) % 1440;
    onChange(Math.floor(wrapped / 60), wrapped % 60);
  };

  const setPeriod = (pm: boolean) => {
    if (pm && hour < 12) onChange(hour + 12, minute);
    if (!pm && hour >= 12) onChange(hour - 12, minute);
  };

  return (
    <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-5">
      {caption && (
        <p className="text-xs font-medium text-[#8E99AD] mb-4">{caption}</p>
      )}

      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {/* Hours */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => stepHour(1)}
            aria-label="Increase hour"
            className="min-h-[44px] min-w-[56px] flex items-center justify-center rounded-xl text-[#8E99AD] hover:text-[#F4F6FA] hover:bg-white/[0.06] active:scale-95 transition-all"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <div className="w-20 sm:w-24 h-16 sm:h-20 flex items-center justify-center rounded-2xl bg-[#1A2130] border border-white/[0.06]">
            <span className="font-display text-4xl sm:text-5xl font-semibold text-[#F4F6FA] tabular-nums tracking-tight">
              {displayHour}
            </span>
          </div>
          <button
            type="button"
            onClick={() => stepHour(-1)}
            aria-label="Decrease hour"
            className="min-h-[44px] min-w-[56px] flex items-center justify-center rounded-xl text-[#8E99AD] hover:text-[#F4F6FA] hover:bg-white/[0.06] active:scale-95 transition-all"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        <span className="font-display text-4xl sm:text-5xl font-medium text-[#556075] pb-1 select-none">
          :
        </span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => stepMinute(5)}
            aria-label="Increase minutes by 5"
            className="min-h-[44px] min-w-[56px] flex items-center justify-center rounded-xl text-[#8E99AD] hover:text-[#F4F6FA] hover:bg-white/[0.06] active:scale-95 transition-all"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <div className="w-20 sm:w-24 h-16 sm:h-20 flex items-center justify-center rounded-2xl bg-[#1A2130] border border-white/[0.06]">
            <span className="font-display text-4xl sm:text-5xl font-semibold text-[#F4F6FA] tabular-nums tracking-tight">
              {pad2(minute)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => stepMinute(-5)}
            aria-label="Decrease minutes by 5"
            className="min-h-[44px] min-w-[56px] flex items-center justify-center rounded-xl text-[#8E99AD] hover:text-[#F4F6FA] hover:bg-white/[0.06] active:scale-95 transition-all"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* AM / PM Selector */}
        {!use24Hour && (
          <div className="flex flex-col gap-2 ml-1">
            <button
              type="button"
              onClick={() => setPeriod(false)}
              className={`min-h-[44px] px-3.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                !isPM
                  ? 'bg-[#F5A524] text-[#0B0E14]'
                  : 'bg-[#1A2130] text-[#8E99AD] hover:text-[#F4F6FA]'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => setPeriod(true)}
              className={`min-h-[44px] px-3.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isPM
                  ? 'bg-[#F5A524] text-[#0B0E14]'
                  : 'bg-[#1A2130] text-[#8E99AD] hover:text-[#F4F6FA]'
              }`}
            >
              PM
            </button>
          </div>
        )}
      </div>

      {/* Fine minute adjusters + Quick presets */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => stepMinute(-1)}
            className="min-h-[36px] px-2.5 rounded-lg bg-[#1A2130] text-xs font-mono text-[#9BA5B7] hover:text-[#F4F6FA] transition-colors whitespace-nowrap shrink-0"
          >
            -1m
          </button>
          <button
            type="button"
            onClick={() => stepMinute(1)}
            className="min-h-[36px] px-2.5 rounded-lg bg-[#1A2130] text-xs font-mono text-[#9BA5B7] hover:text-[#F4F6FA] transition-colors whitespace-nowrap shrink-0"
          >
            +1m
          </button>
        </div>

        {presets && presets.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {presets.map((p) => {
              const active = p.hour === hour && p.minute === minute;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange(p.hour, p.minute)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-medium tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#F5A524]/20 text-[#F5A524] border border-[#F5A524]/40'
                      : 'bg-[#1A2130] text-[#9BA5B7] hover:text-[#F4F6FA]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
