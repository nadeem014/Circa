export type PlannerMode = 'sleep_now' | 'wake_at' | 'bed_at';

export type NavTab = 'planner' | 'alarms' | 'naps' | 'settings';

export type AlarmToneId = 'morning_chimes' | 'dawn_pulse' | 'forest_dew' | 'classic_radar';

export interface Alarm {
  id: string;
  hour: number; // 0-23
  minute: number; // 0-59
  enabled: boolean;
  label: string;
  cycles: number | null; // e.g., 5 cycles
  cycleDurationMin: number; // usually 90
  sleepDurationMin: number | null; // e.g., 450
  repeatDays: number[]; // 0 = Sun, 1 = Mon, ... 6 = Sat. Empty = one-time
  tone: AlarmToneId;
  fadeInSeconds: number; // 0, 15, 30
  snoozeMinutes: number; // 10, 15, or 90
  createdAt: number;
  lastTriggeredKey?: string; // YYYY-MM-DD-HH-MM to prevent double firing in the same minute
  isBedtimeReminder?: boolean;
}

export interface SleepSettings {
  fallAsleepMinutes: number; // Default 14 min
  cycleLengthMinutes: number; // Default 90 min
  use24Hour: boolean;
  defaultTone: AlarmToneId;
  defaultFadeInSeconds: number;
  defaultSnoozeMinutes: number;
}

export interface CycleOption {
  cycles: number;
  sleepMinutes: number;
  totalMinutesFromNow: number;
  targetHour: number;
  targetMinute: number;
  targetDate: Date;
  quality: 'optimal' | 'good' | 'short';
  qualityLabel: string;
  summary: string;
}

export interface ActiveSleepSession {
  startedAt: number; // epoch ms
  fallAsleepMinutes: number;
  cycleLengthMinutes: number;
  targetAlarmId?: string;
}
