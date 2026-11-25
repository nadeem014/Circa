import { Alarm, CycleOption, SleepSettings } from '../types/sleep';

export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_SETTINGS: SleepSettings = {
  fallAsleepMinutes: 14,
  cycleLengthMinutes: 90,
  use24Hour: false,
  defaultTone: 'morning_chimes',
  defaultFadeInSeconds: 15,
  defaultSnoozeMinutes: 10,
};

export function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

export function formatTimeParts(
  hour24: number,
  minute: number,
  use24Hour: boolean
): { timeText: string; period: string } {
  const h = ((hour24 % 24) + 24) % 24;
  const m = ((minute % 60) + 60) % 60;
  if (use24Hour) {
    return { timeText: `${pad2(h)}:${pad2(m)}`, period: '' };
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { timeText: `${h12}:${pad2(m)}`, period };
}

export function formatTimeString(
  hour24: number,
  minute: number,
  use24Hour: boolean
): string {
  const { timeText, period } = formatTimeParts(hour24, minute, use24Hour);
  return period ? `${timeText} ${period}` : timeText;
}

export function formatDuration(totalMinutes: number): string {
  const safeMin = Math.max(0, Math.round(totalMinutes));
  const hrs = Math.floor(safeMin / 60);
  const mins = safeMin % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatCountdown(msUntil: number): string {
  if (msUntil <= 0) return 'Now';
  const totalSeconds = Math.ceil(msUntil / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

function getCycleQuality(cycles: number): {
  quality: 'optimal' | 'good' | 'short';
  qualityLabel: string;
  summary: string;
} {
  if (cycles === 5) {
    return {
      quality: 'optimal',
      qualityLabel: 'Recommended',
      summary: 'Full deep recovery and peak morning REM',
    };
  }
  if (cycles === 6) {
    return {
      quality: 'optimal',
      qualityLabel: 'Deep recovery',
      summary: 'Extended restoration after intense days',
    };
  }
  if (cycles === 4) {
    return {
      quality: 'good',
      qualityLabel: 'Balanced',
      summary: 'Clean light-sleep wake for shorter nights',
    };
  }
  if (cycles === 3) {
    return {
      quality: 'short',
      qualityLabel: 'Minimum rest',
      summary: 'Core physical recovery without deep inertia',
    };
  }
  if (cycles === 2) {
    return {
      quality: 'short',
      qualityLabel: 'Brief sleep',
      summary: 'Two complete cycles before a busy morning',
    };
  }
  return {
    quality: 'short',
    qualityLabel: 'Full cycle nap',
    summary: 'One complete NREM-to-REM restorative cycle',
  };
}

/**
 * Mode 1: Sleep Now -> Calculate wake-up times from current timestamp
 */
export function calculateWakeTimesFromNow(
  now: Date,
  settings: SleepSettings
): CycleOption[] {
  const cycleCounts = [6, 5, 4, 3, 2, 1];
  return cycleCounts.map((cycles) => {
    const sleepMinutes = cycles * settings.cycleLengthMinutes;
    const totalMinutesFromNow = settings.fallAsleepMinutes + sleepMinutes;
    const targetDate = new Date(now.getTime() + totalMinutesFromNow * 60_000);
    const meta = getCycleQuality(cycles);
    return {
      cycles,
      sleepMinutes,
      totalMinutesFromNow,
      targetHour: targetDate.getHours(),
      targetMinute: targetDate.getMinutes(),
      targetDate,
      ...meta,
    };
  });
}

/**
 * Mode 2: Wake Up At -> Calculate ideal bedtimes working backward from desired wake time
 */
export function calculateBedtimesForWakeTime(
  wakeHour: number,
  wakeMinute: number,
  now: Date,
  settings: SleepSettings
): CycleOption[] {
  const wakeDate = new Date(now);
  wakeDate.setHours(wakeHour, wakeMinute, 0, 0);
  if (wakeDate.getTime() <= now.getTime()) {
    wakeDate.setDate(wakeDate.getDate() + 1);
  }

  const cycleCounts = [6, 5, 4, 3];
  return cycleCounts.map((cycles) => {
    const sleepMinutes = cycles * settings.cycleLengthMinutes;
    const totalNeeded = sleepMinutes + settings.fallAsleepMinutes;
    const bedDate = new Date(wakeDate.getTime() - totalNeeded * 60_000);
    const meta = getCycleQuality(cycles);
    return {
      cycles,
      sleepMinutes,
      totalMinutesFromNow: Math.round((bedDate.getTime() - now.getTime()) / 60_000),
      targetHour: bedDate.getHours(),
      targetMinute: bedDate.getMinutes(),
      targetDate: bedDate,
      ...meta,
    };
  });
}

/**
 * Mode 3: Go To Bed At -> Calculate wake-up times from a chosen planned bedtime
 */
export function calculateWakeTimesFromBedtime(
  bedHour: number,
  bedMinute: number,
  now: Date,
  settings: SleepSettings
): CycleOption[] {
  const bedDate = new Date(now);
  bedDate.setHours(bedHour, bedMinute, 0, 0);
  if (bedDate.getTime() < now.getTime() - 60_000) {
    bedDate.setDate(bedDate.getDate() + 1);
  }

  const cycleCounts = [6, 5, 4, 3];
  return cycleCounts.map((cycles) => {
    const sleepMinutes = cycles * settings.cycleLengthMinutes;
    const totalOffset = settings.fallAsleepMinutes + sleepMinutes;
    const wakeDate = new Date(bedDate.getTime() + totalOffset * 60_000);
    const meta = getCycleQuality(cycles);
    return {
      cycles,
      sleepMinutes,
      totalMinutesFromNow: Math.round((wakeDate.getTime() - now.getTime()) / 60_000),
      targetHour: wakeDate.getHours(),
      targetMinute: wakeDate.getMinutes(),
      targetDate: wakeDate,
      ...meta,
    };
  });
}

/**
 * Computes the next upcoming Date when an Alarm will ring relative to `now`.
 */
export function getNextAlarmDate(alarm: Alarm, now: Date): Date {
  const candidate = new Date(now);
  candidate.setHours(alarm.hour, alarm.minute, 0, 0);

  if (alarm.repeatDays.length === 0) {
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  for (let offset = 0; offset < 8; offset++) {
    const check = new Date(candidate);
    check.setDate(candidate.getDate() + offset);
    if (
      alarm.repeatDays.includes(check.getDay()) &&
      check.getTime() > now.getTime()
    ) {
      return check;
    }
  }
  candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

export function formatRepeatSummary(repeatDays: number[]): string {
  if (repeatDays.length === 0) return 'Once';
  if (repeatDays.length === 7) return 'Every day';
  const sorted = [...repeatDays].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) {
    return 'Weekdays';
  }
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) {
    return 'Weekends';
  }
  return sorted.map((d) => DAY_SHORT_NAMES[d]).join(', ');
}

export function getTriggerKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}-${pad2(date.getMinutes())}`;
}

/**
 * Creates a downloadable .ics calendar event with a VALARM trigger so users
 * can also add their sleep cycle wake time to Google Calendar / Android devices.
 */
export function downloadAlarmIcs(alarm: Alarm, now: Date): void {
  const nextDate = getNextAlarmDate(alarm, now);
  const endDate = new Date(nextDate.getTime() + 15 * 60_000);

  const toIcsUtc = (d: Date) =>
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`;

  const title = alarm.label || 'Sleep Cycle Wake-Up';
  const desc = alarm.cycles
    ? `${alarm.cycles} complete ${alarm.cycleDurationMin}-minute sleep cycles (${formatDuration(alarm.sleepDurationMin || alarm.cycles * alarm.cycleDurationMin)} sleep)`
    : 'Scheduled with Circa Sleep Cycle Alarm';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Circa Sleep Cycle Alarm//EN',
    'BEGIN:VEVENT',
    `UID:${alarm.id}@circa-sleep`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(nextDate)}`,
    `DTEND:${toIcsUtc(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:AUDIO',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `circa-alarm-${pad2(alarm.hour)}${pad2(alarm.minute)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an Android Clock Intent URI that Android browsers can open
 * directly into the native Android Clock app (SET_ALARM action).
 */
export function buildAndroidClockIntentUrl(alarm: Alarm): string {
  const message = encodeURIComponent(
    alarm.label || (alarm.cycles ? `${alarm.cycles} Sleep Cycles` : 'Circa Alarm')
  );
  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${alarm.hour};i.android.intent.extra.alarm.MINUTES=${alarm.minute};S.android.intent.extra.alarm.MESSAGE=${message};B.android.intent.extra.alarm.SKIP_UI=false;end`;
}
