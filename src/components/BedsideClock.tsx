import React, { useEffect, useState } from 'react';
import { X, Bell, SunDim, Lock, Unlock } from 'lucide-react';
import { ActiveSleepSession, Alarm } from '../types/sleep';
import {
  formatCountdown,
  formatTimeParts,
  formatTimeString,
  getNextAlarmDate,
} from '../utils/sleepMath';

interface BedsideClockProps {
  now: Date;
  use24Hour: boolean;
  nextAlarm: Alarm | null;
  activeSession: ActiveSleepSession | null;
  onClose: () => void;
  onEndSession: () => void;
}

export const BedsideClock: React.FC<BedsideClockProps> = ({
  now,
  use24Hour,
  nextAlarm,
  activeSession,
  onClose,
  onEndSession,
}) => {
  const [dimmed, setDimmed] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    let mounted = true;

    const requestLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          sentinel = await nav.wakeLock.request('screen');
          if (mounted) setWakeLockActive(true);
        }
      } catch {
        if (mounted) setWakeLockActive(false);
      }
    };

    requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
      }
    };
  }, []);

  const { timeText, period } = formatTimeParts(now.getHours(), now.getMinutes(), use24Hour);
  const nextDate = nextAlarm ? getNextAlarmDate(nextAlarm, now) : null;
  const msUntil = nextDate ? nextDate.getTime() - now.getTime() : 0;

  // Compute live cycle phase if user started a sleep session
  let sessionPhaseText = '';
  let sessionCycleNum = 0;
  let sessionCyclePct = 0;
  if (activeSession) {
    const elapsedMin = Math.max(0, (now.getTime() - activeSession.startedAt) / 60_000);
    if (elapsedMin < activeSession.fallAsleepMinutes) {
      sessionPhaseText = `Falling asleep (${Math.ceil(activeSession.fallAsleepMinutes - elapsedMin)}m left)`;
      sessionCyclePct = (elapsedMin / activeSession.fallAsleepMinutes) * 100;
    } else {
      const asleepMin = elapsedMin - activeSession.fallAsleepMinutes;
      const cycleLen = activeSession.cycleLengthMinutes;
      sessionCycleNum = Math.floor(asleepMin / cycleLen) + 1;
      const posInCycle = asleepMin % cycleLen;
      sessionCyclePct = (posInCycle / cycleLen) * 100;
      const ratio = posInCycle / cycleLen;
      if (ratio < 0.2) sessionPhaseText = 'Light sleep (Stage 1–2)';
      else if (ratio < 0.58) sessionPhaseText = 'Deep slow-wave sleep';
      else if (ratio < 0.88) sessionPhaseText = 'REM dreaming phase';
      else sessionPhaseText = 'Approaching cycle boundary';
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#040507] flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top quiet utility bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDimmed((d) => !d)}
          className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#8E99AD] flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <SunDim className="w-4 h-4" />
          {dimmed ? 'Normal brightness' : 'Extra dim OLED'}
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#647086] mr-2">
            {wakeLockActive ? (
              <>
                <Lock className="w-3.5 h-3.5 text-[#C88424]" />
                Screen kept awake
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                Keep tab visible
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit bedside clock"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[#9BA5B7] hover:text-[#F4F6FA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center warm amber nightstand clock */}
      <div
        className="flex flex-col items-center justify-center text-center transition-opacity duration-300"
        style={{ opacity: dimmed ? 0.36 : 0.92 }}
      >
        <p className="text-sm text-[#856A45] font-medium mb-3">
          {now.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
        </p>

        <div className="flex items-baseline justify-center gap-3">
          <span className="font-display text-[5.25rem] sm:text-[8.5rem] leading-none font-medium tracking-tight tabular-nums text-[#E59E3A]">
            {timeText}
          </span>
          {period && (
            <span className="font-display text-2xl sm:text-4xl font-medium text-[#9A6A28]">
              {period}
            </span>
          )}
        </div>

        {/* Next alarm indicator */}
        <div className="mt-8 flex flex-col items-center gap-2">
          {nextAlarm ? (
            <div className="flex items-center gap-2.5 text-sm sm:text-base text-[#C49655] tabular-nums">
              <Bell className="w-4 h-4" />
              <span>
                {formatTimeString(nextAlarm.hour, nextAlarm.minute, use24Hour)}
              </span>
              <span className="text-[#59462E]" aria-hidden="true">·</span>
              <span className="font-mono text-xs sm:text-sm text-[#8F7047]">
                in {formatCountdown(msUntil)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-[#5C6578]">No active alarm scheduled</p>
          )}
        </div>

        {/* Live sleep cycle progress if session active */}
        {activeSession && (
          <div className="mt-8 w-full max-w-xs text-left rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between text-xs text-[#A38A67] mb-2">
              <span>{sessionCycleNum > 0 ? `Cycle ${sessionCycleNum}` : 'Sleep onset'}</span>
              <span>{sessionPhaseText}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#C88424] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, sessionCyclePct))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom exit / end sleep session */}
      <div className="flex items-center justify-center gap-3 pb-safe">
        {activeSession && (
          <button
            type="button"
            onClick={onEndSession}
            className="min-h-[44px] px-5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-medium text-[#9BA5B7] transition-colors whitespace-nowrap"
          >
            Stop Sleep Tracker
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-medium text-[#9BA5B7] transition-colors whitespace-nowrap"
        >
          Return to Circa
        </button>
      </div>
    </div>
  );
};
