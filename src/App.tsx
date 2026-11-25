import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Moon,
  Bell,
  Timer,
  SlidersHorizontal,
  Plus,
  Check,
  BellRing,
  Clock,
  ChevronRight,
  Sunrise,
  BedDouble,
  Play,
} from 'lucide-react';
import {
  ActiveSleepSession,
  Alarm,
  CycleOption,
  NavTab,
  PlannerMode,
  SleepSettings,
} from './types/sleep';
import {
  DEFAULT_SETTINGS,
  calculateBedtimesForWakeTime,
  calculateWakeTimesFromBedtime,
  calculateWakeTimesFromNow,
  formatCountdown,
  formatDuration,
  formatRepeatSummary,
  formatTimeParts,
  formatTimeString,
  getNextAlarmDate,
  getTriggerKey,
} from './utils/sleepMath';
import { alarmAudio } from './utils/alarmAudio';
import { HypnogramChart } from './components/HypnogramChart';
import { TimeWheelInput } from './components/TimeWheelInput';
import { AlarmEditorModal } from './components/AlarmEditorModal';
import { RingingOverlay } from './components/RingingOverlay';
import { BedsideClock } from './components/BedsideClock';
import { NapTimerView } from './components/NapTimerView';
import { SettingsView } from './components/SettingsView';

const STORAGE_ALARMS_KEY = 'circa_alarms_v1';
const STORAGE_SETTINGS_KEY = 'circa_settings_v1';
const STORAGE_SESSION_KEY = 'circa_sleep_session_v1';

function loadStoredAlarms(): Alarm[] {
  try {
    const raw = localStorage.getItem(STORAGE_ALARMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fallback to initial alarm
  }
  return [
    {
      id: 'default-weekday-refresh',
      hour: 6,
      minute: 45,
      enabled: true,
      label: 'Weekday Refresh',
      cycles: 5,
      cycleDurationMin: 90,
      sleepDurationMin: 450,
      repeatDays: [1, 2, 3, 4, 5],
      tone: 'morning_chimes',
      fadeInSeconds: 15,
      snoozeMinutes: 10,
      createdAt: Date.now() - 86_400_000,
    },
  ];
}

function loadStoredSettings(): SleepSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback
  }
  return DEFAULT_SETTINGS;
}

function loadStoredSession(): ActiveSleepSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fallback
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('planner');
  const [plannerMode, setPlannerMode] = useState<PlannerMode>('sleep_now');
  const [now, setNow] = useState<Date>(() => new Date());

  const [settings, setSettings] = useState<SleepSettings>(loadStoredSettings);
  const [alarms, setAlarms] = useState<Alarm[]>(loadStoredAlarms);
  const [activeSession, setActiveSession] = useState<ActiveSleepSession | null>(
    loadStoredSession
  );

  // Planner inputs
  const [wakeTarget, setWakeTarget] = useState<{ hour: number; minute: number }>({
    hour: 7,
    minute: 0,
  });
  const [bedTarget, setBedTarget] = useState<{ hour: number; minute: number }>({
    hour: 22,
    minute: 30,
  });
  const [selectedCycles, setSelectedCycles] = useState<number>(5);

  // Modals & overlays
  const [editingAlarm, setEditingAlarm] = useState<{ alarm: Alarm; isNew: boolean } | null>(
    null
  );
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  const [showBedsideClock, setShowBedsideClock] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ALARMS_KEY, JSON.stringify(alarms));
    } catch {
      // Ignore quota errors
    }
  }, [alarms]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      if (activeSession) {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(activeSession));
      } else {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }
    } catch {
      // Ignore
    }
  }, [activeSession]);

  // Trigger an alarm (real audio + full-screen ringing UI + system notification)
  const triggerAlarmNow = useCallback((alarm: Alarm) => {
    setRingingAlarm(alarm);
    alarmAudio.startAlarm(alarm.tone, alarm.fadeInSeconds);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(alarm.label || 'Circa — Sleep Cycle Complete', {
          body: alarm.cycles
            ? `${alarm.cycles} complete sleep cycles finished. Time to wake up refreshed.`
            : 'Time to wake up refreshed.',
        });
      } catch {
        // Ignore notification errors inside iframe
      }
    }
  }, []);

  // 1-second live clock & alarm scheduler tick
  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = new Date();
      setNow(current);

      if (ringingAlarm) return;

      const currentHour = current.getHours();
      const currentMin = current.getMinutes();
      const currentDay = current.getDay();
      const triggerKey = getTriggerKey(current);

      const dueAlarm = alarms.find((a) => {
        if (!a.enabled) return false;
        if (a.hour !== currentHour || a.minute !== currentMin) return false;
        if (a.lastTriggeredKey === triggerKey) return false;
        if (a.repeatDays.length > 0 && !a.repeatDays.includes(currentDay)) return false;
        return true;
      });

      if (dueAlarm) {
        setAlarms((prev) =>
          prev.map((a) =>
            a.id === dueAlarm.id
              ? {
                  ...a,
                  lastTriggeredKey: triggerKey,
                  enabled: a.repeatDays.length > 0 ? a.enabled : false,
                }
              : a
          )
        );
        triggerAlarmNow(dueAlarm);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [alarms, ringingAlarm, triggerAlarmNow]);

  // Computed cycle options based on active planner mode
  const cycleOptions: CycleOption[] = useMemo(() => {
    if (plannerMode === 'sleep_now') {
      return calculateWakeTimesFromNow(now, settings);
    }
    if (plannerMode === 'wake_at') {
      return calculateBedtimesForWakeTime(wakeTarget.hour, wakeTarget.minute, now, settings);
    }
    return calculateWakeTimesFromBedtime(bedTarget.hour, bedTarget.minute, now, settings);
  }, [plannerMode, now, settings, wakeTarget, bedTarget]);

  // Keep selectedCycles valid if mode shrinks option set
  useEffect(() => {
    if (!cycleOptions.some((o) => o.cycles === selectedCycles) && cycleOptions.length > 0) {
      const preferred = cycleOptions.find((o) => o.cycles === 5) ?? cycleOptions[0];
      setSelectedCycles(preferred.cycles);
    }
  }, [cycleOptions, selectedCycles]);

  const selectedOption =
    cycleOptions.find((o) => o.cycles === selectedCycles) ?? cycleOptions[0];

  // Next upcoming enabled alarm
  const nextUpcomingAlarm = useMemo(() => {
    const enabled = alarms.filter((a) => a.enabled);
    if (enabled.length === 0) return null;
    return enabled.reduce((earliest, candidate) => {
      const earliestTime = getNextAlarmDate(earliest, now).getTime();
      const candidateTime = getNextAlarmDate(candidate, now).getTime();
      return candidateTime < earliestTime ? candidate : earliest;
    });
  }, [alarms, now]);

  const nextAlarmMs = useMemo(() => {
    if (!nextUpcomingAlarm) return 0;
    return getNextAlarmDate(nextUpcomingAlarm, now).getTime() - now.getTime();
  }, [nextUpcomingAlarm, now]);

  // Quick-set alarm directly from a calculated cycle option
  const handleQuickSetCycleAlarm = (
    option: CycleOption,
    openNightClock = false
  ) => {
    // In "Wake up at" mode, the wake alarm is wakeTarget and the cycle option is the bedtime reminder
    const alarmHour = plannerMode === 'wake_at' ? wakeTarget.hour : option.targetHour;
    const alarmMinute = plannerMode === 'wake_at' ? wakeTarget.minute : option.targetMinute;
    const alarmLabel =
      plannerMode === 'sleep_now'
        ? `Wake Refreshed (${option.cycles} cycles)`
        : plannerMode === 'wake_at'
        ? `Morning Wake (${option.cycles} cycles)`
        : `Planned Wake (${option.cycles} cycles)`;

    const newAlarm: Alarm = {
      id: `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hour: alarmHour,
      minute: alarmMinute,
      enabled: true,
      label: alarmLabel,
      cycles: option.cycles,
      cycleDurationMin: settings.cycleLengthMinutes,
      sleepDurationMin: option.sleepMinutes,
      repeatDays: [],
      tone: settings.defaultTone,
      fadeInSeconds: settings.defaultFadeInSeconds,
      snoozeMinutes: settings.defaultSnoozeMinutes,
      createdAt: Date.now(),
    };

    setAlarms((prev) => [newAlarm, ...prev]);

    if (plannerMode === 'sleep_now' && openNightClock) {
      setActiveSession({
        startedAt: Date.now(),
        fallAsleepMinutes: settings.fallAsleepMinutes,
        cycleLengthMinutes: settings.cycleLengthMinutes,
        targetAlarmId: newAlarm.id,
      });
      setShowBedsideClock(true);
    }

    showToast(
      `Alarm set for ${formatTimeString(alarmHour, alarmMinute, settings.use24Hour)} (${option.cycles} cycles)`
    );
  };

  // Optional bedtime reminder when in Wake Up At mode
  const handleSetBedtimeReminder = (option: CycleOption) => {
    const reminder: Alarm = {
      id: `bed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hour: option.targetHour,
      minute: option.targetMinute,
      enabled: true,
      label: `Wind Down for ${option.cycles} Cycles`,
      cycles: option.cycles,
      cycleDurationMin: settings.cycleLengthMinutes,
      sleepDurationMin: option.sleepMinutes,
      repeatDays: [],
      tone: 'forest_dew',
      fadeInSeconds: 15,
      snoozeMinutes: 10,
      createdAt: Date.now(),
      isBedtimeReminder: true,
    };
    setAlarms((prev) => [reminder, ...prev]);
    showToast(
      `Bedtime alert set for ${formatTimeString(
        option.targetHour,
        option.targetMinute,
        settings.use24Hour
      )}`
    );
  };

  const handleToggleAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled, lastTriggeredKey: undefined } : a))
    );
  };

  const handleSaveAlarm = (updated: Alarm) => {
    setAlarms((prev) => {
      const exists = prev.some((a) => a.id === updated.id);
      if (exists) {
        return prev.map((a) => (a.id === updated.id ? { ...updated, lastTriggeredKey: undefined } : a));
      }
      return [updated, ...prev];
    });
    setEditingAlarm(null);
    showToast(
      `Alarm saved for ${formatTimeString(updated.hour, updated.minute, settings.use24Hour)}`
    );
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
    setEditingAlarm(null);
    showToast('Alarm deleted');
  };

  const handleOpenNewAlarm = () => {
    const defaultOpt = selectedOption ?? cycleOptions[0];
    const hour = defaultOpt ? defaultOpt.targetHour : 7;
    const minute = defaultOpt ? defaultOpt.targetMinute : 0;
    setEditingAlarm({
      isNew: true,
      alarm: {
        id: `alarm-${Date.now()}`,
        hour,
        minute,
        enabled: true,
        label: 'Sleep Cycle Wake',
        cycles: defaultOpt ? defaultOpt.cycles : 5,
        cycleDurationMin: settings.cycleLengthMinutes,
        sleepDurationMin: defaultOpt ? defaultOpt.sleepMinutes : 450,
        repeatDays: [],
        tone: settings.defaultTone,
        fadeInSeconds: settings.defaultFadeInSeconds,
        snoozeMinutes: settings.defaultSnoozeMinutes,
        createdAt: Date.now(),
      },
    });
  };

  const handleDismissRinging = () => {
    alarmAudio.stop();
    setRingingAlarm(null);
    setActiveSession(null);
  };

  const handleSnoozeRinging = (minutes: number) => {
    if (!ringingAlarm) return;
    alarmAudio.stop();
    const snoozeDate = new Date(Date.now() + minutes * 60_000);
    const snoozedAlarm: Alarm = {
      ...ringingAlarm,
      id: `snooze-${Date.now()}`,
      hour: snoozeDate.getHours(),
      minute: snoozeDate.getMinutes(),
      enabled: true,
      repeatDays: [],
      label:
        minutes >= 80
          ? `${ringingAlarm.label || 'Alarm'} (+1 Cycle)`
          : `${ringingAlarm.label || 'Alarm'} (Snoozed)`,
      createdAt: Date.now(),
      lastTriggeredKey: undefined,
    };
    setAlarms((prev) => [snoozedAlarm, ...prev]);
    setRingingAlarm(null);
    showToast(
      `Snoozed until ${formatTimeString(
        snoozeDate.getHours(),
        snoozeDate.getMinutes(),
        settings.use24Hour
      )}`
    );
  };

  const currentParts = formatTimeParts(now.getHours(), now.getMinutes(), settings.use24Hour);
  const activeAlarmsCount = alarms.filter((a) => a.enabled).length;

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'planner', label: 'Planner', icon: Moon },
    { id: 'alarms', label: 'Alarms', icon: Bell },
    { id: 'naps', label: 'Naps', icon: Timer },
    { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
  ];

  const sortedAlarms = useMemo(() => {
    return [...alarms].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
    });
  }, [alarms]);

  return (
    <div className="min-h-dvh bg-[#0B0E14] text-[#F4F6FA] flex flex-col">
      {/* Top Bar: 3-Zone Contract on desktop, compact 56px Android app bar on mobile */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-[#0B0E14]/90 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element Brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('planner')}
            className="font-display text-xl font-semibold tracking-tight text-[#F4F6FA] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A524] rounded-md"
          >
            Circa
          </button>

          {/* Zone 2: Desktop 4 clean single-line text nav links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-1 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[#F4F6FA]'
                      : 'text-[#8E99AD] hover:text-[#F4F6FA]'
                  }`}
                >
                  {item.label}
                  {item.id === 'alarms' && activeAlarmsCount > 0 && (
                    <span className="ml-1.5 font-mono text-xs text-[#F5A524] tabular-nums">
                      {activeAlarmsCount}
                    </span>
                  )}
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-[21px] h-[2px] bg-[#F5A524]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setShowBedsideClock(true)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1A2130] hover:bg-[#232C40] border border-white/[0.08] text-xs sm:text-sm font-medium text-[#F4F6FA] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Clock className="w-4 h-4 text-[#F5A524]" />
              Night Clock
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area (padded bottom for mobile nav bar) */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-24 md:pb-12">
        {/* ==================== TAB 1: SLEEP CYCLE PLANNER ==================== */}
        {activeTab === 'planner' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Column: Clock / Mode Selector / Input / Hypnogram */}
            <div className="lg:col-span-6 space-y-5">
              {/* Hero Live Clock & Next Alarm Readout */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-[#8E99AD]">
                    {now.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-[#F4F6FA] tabular-nums leading-none">
                      {currentParts.timeText}
                    </h1>
                    {currentParts.period && (
                      <span className="font-display text-xl sm:text-2xl font-medium text-[#8E99AD]">
                        {currentParts.period}
                      </span>
                    )}
                  </div>
                </div>

                {nextUpcomingAlarm ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('alarms')}
                    className="text-left rounded-2xl bg-[#131822] hover:bg-[#181F2D] border border-white/[0.07] px-4 py-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-[#8E99AD]">
                      <Bell className="w-3.5 h-3.5 text-[#F5A524]" />
                      <span>Next alarm</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2 tabular-nums">
                      <span className="font-display text-base font-semibold text-[#F4F6FA]">
                        {formatTimeString(
                          nextUpcomingAlarm.hour,
                          nextUpcomingAlarm.minute,
                          settings.use24Hour
                        )}
                      </span>
                      <span className="font-mono text-xs text-[#F5A524]">
                        in {formatCountdown(nextAlarmMs)}
                      </span>
                    </div>
                  </button>
                ) : (
                  <p className="text-xs text-[#6E7A91]">No active alarm set</p>
                )}
              </div>

              {/* Interactive Mode Segmented Control */}
              <div
                role="tablist"
                aria-label="Sleep planner mode"
                className="grid grid-cols-3 gap-1 p-1.5 rounded-2xl bg-[#131822] border border-white/[0.07]"
              >
                {(
                  [
                    { id: 'sleep_now', label: 'Sleep now' },
                    { id: 'wake_at', label: 'Wake up at' },
                    { id: 'bed_at', label: 'Bedtime at' },
                  ] as { id: PlannerMode; label: string }[]
                ).map((tab) => {
                  const active = plannerMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      type="button"
                      aria-selected={active}
                      onClick={() => setPlannerMode(tab.id)}
                      className={`min-h-[44px] px-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#212A3B] text-[#F4F6FA] shadow-sm'
                          : 'text-[#8E99AD] hover:text-[#F4F6FA]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Mode-Specific Control Card */}
              {plannerMode === 'sleep_now' && (
                <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-base font-semibold text-[#F4F6FA]">
                        Going to sleep right now
                      </h2>
                      <p className="text-xs text-[#8E99AD] mt-1 leading-relaxed">
                        Accounts for{' '}
                        <span className="text-[#F4F6FA] font-medium tabular-nums">
                          {settings.fallAsleepMinutes} minutes
                        </span>{' '}
                        to fall asleep, then spaces alarms at exact{' '}
                        <span className="text-[#F4F6FA] font-medium tabular-nums">
                          {settings.cycleLengthMinutes}-minute
                        </span>{' '}
                        cycle boundaries.
                      </p>
                    </div>
                  </div>

                  {/* Inline quick fall-asleep latency adjustment */}
                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#8E99AD]">Fall-asleep buffer</span>
                      <span className="font-mono text-xs text-[#F5A524] tabular-nums">
                        +{settings.fallAsleepMinutes} min
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[5, 10, 14, 20, 30].map((mins) => {
                        const active = settings.fallAsleepMinutes === mins;
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() =>
                              setSettings((prev) => ({ ...prev, fallAsleepMinutes: mins }))
                            }
                            className={`min-h-[40px] rounded-xl text-xs font-mono tabular-nums transition-colors ${
                              active
                                ? 'bg-[#F5A524]/15 text-[#F5A524] border border-[#F5A524]/40'
                                : 'bg-[#1A2130] text-[#9BA5B7] hover:text-[#F4F6FA]'
                            }`}
                          >
                            {mins}m
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {plannerMode === 'wake_at' && (
                <TimeWheelInput
                  hour={wakeTarget.hour}
                  minute={wakeTarget.minute}
                  use24Hour={settings.use24Hour}
                  onChange={(hour, minute) => setWakeTarget({ hour, minute })}
                  caption="Choose when you need to wake up — we calculate exact bedtimes for full cycles."
                  presets={[
                    { label: settings.use24Hour ? '06:00' : '6:00 AM', hour: 6, minute: 0 },
                    { label: settings.use24Hour ? '06:30' : '6:30 AM', hour: 6, minute: 30 },
                    { label: settings.use24Hour ? '07:00' : '7:00 AM', hour: 7, minute: 0 },
                    { label: settings.use24Hour ? '07:30' : '7:30 AM', hour: 7, minute: 30 },
                  ]}
                />
              )}

              {plannerMode === 'bed_at' && (
                <TimeWheelInput
                  hour={bedTarget.hour}
                  minute={bedTarget.minute}
                  use24Hour={settings.use24Hour}
                  onChange={(hour, minute) => setBedTarget({ hour, minute })}
                  caption="Choose when you plan to get into bed — we calculate exact wake-up alarms."
                  presets={[
                    { label: settings.use24Hour ? '22:00' : '10:00 PM', hour: 22, minute: 0 },
                    { label: settings.use24Hour ? '22:30' : '10:30 PM', hour: 22, minute: 30 },
                    { label: settings.use24Hour ? '23:00' : '11:00 PM', hour: 23, minute: 0 },
                    { label: settings.use24Hour ? '23:30' : '11:30 PM', hour: 23, minute: 30 },
                  ]}
                />
              )}

              {/* Interactive Hypnogram Wave */}
              <HypnogramChart
                selectedCycles={selectedCycles}
                maxCycles={6}
                cycleLengthMinutes={settings.cycleLengthMinutes}
                fallAsleepMinutes={settings.fallAsleepMinutes}
                options={cycleOptions}
                use24Hour={settings.use24Hour}
                mode={plannerMode}
                onSelectCycle={setSelectedCycles}
              />
            </div>

            {/* Right Column: Calculated 90-Minute Cycle Options & One-Tap Alarm Action */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-semibold text-[#F4F6FA] tracking-tight">
                    {plannerMode === 'wake_at'
                      ? 'Best times to get in bed'
                      : 'Best times to wake up'}
                  </h2>
                  <p className="text-xs text-[#8E99AD] mt-0.5 tabular-nums">
                    {plannerMode === 'wake_at'
                      ? `For a ${formatTimeString(
                          wakeTarget.hour,
                          wakeTarget.minute,
                          settings.use24Hour
                        )} alarm · includes ${settings.fallAsleepMinutes}m onset`
                      : `Aligned to ${settings.cycleLengthMinutes}-minute cycle endings · tap a card to select`}
                  </p>
                </div>
              </div>

              {/* Cycle Cards List */}
              <div className="space-y-2.5">
                {cycleOptions.map((option) => {
                  const isSelected = option.cycles === selectedCycles;
                  const parts = formatTimeParts(
                    option.targetHour,
                    option.targetMinute,
                    settings.use24Hour
                  );
                  const isRecommended = option.cycles === 5 || option.cycles === 6;

                  // Check if an enabled alarm already matches this exact time
                  const matchingAlarmTime =
                    plannerMode === 'wake_at' ? wakeTarget : { hour: option.targetHour, minute: option.targetMinute };
                  const alreadyScheduled = alarms.some(
                    (a) =>
                      a.enabled &&
                      a.hour === matchingAlarmTime.hour &&
                      a.minute === matchingAlarmTime.minute &&
                      !a.isBedtimeReminder
                  );

                  return (
                    <div
                      key={option.cycles}
                      onClick={() => setSelectedCycles(option.cycles)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCycles(option.cycles);
                        }
                      }}
                      className={`group rounded-2xl p-4 sm:p-5 border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#192131] border-[#F5A524]/50'
                          : 'bg-[#131822] border-white/[0.07] hover:bg-[#171E2C]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#F4F6FA] tabular-nums">
                              {parts.timeText}
                            </span>
                            {parts.period && (
                              <span className="font-display text-base font-medium text-[#8E99AD]">
                                {parts.period}
                              </span>
                            )}
                          </div>

                          {/* Clean unboxed metadata with typographic separators (Zero-Pill) */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs tabular-nums">
                            <span className="text-[#D4DBE7] font-medium">
                              {option.cycles} {option.cycles === 1 ? 'cycle' : 'cycles'}
                            </span>
                            <span className="text-[#525D73]" aria-hidden="true">·</span>
                            <span className="text-[#9BA5B7]">
                              {formatDuration(option.sleepMinutes)} sleep
                            </span>
                            <span className="text-[#525D73]" aria-hidden="true">·</span>
                            <span
                              className={
                                isRecommended
                                  ? 'text-[#F5A524] font-medium'
                                  : 'text-[#8E99AD]'
                              }
                            >
                              {option.qualityLabel}
                            </span>
                          </div>

                          {isSelected && (
                            <p className="text-xs text-[#7F8BA1] mt-2">
                              {option.summary}
                            </p>
                          )}
                        </div>

                        {/* Right Action Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {plannerMode === 'wake_at' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetBedtimeReminder(option);
                              }}
                              className="min-h-[44px] px-3.5 rounded-xl bg-[#1F283B] hover:bg-[#29354E] text-xs font-medium text-[#F4F6FA] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                            >
                              <BedDouble className="w-4 h-4 text-[#8DA2FB]" />
                              Remind Bed
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickSetCycleAlarm(option, false);
                              }}
                              className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap ${
                                alreadyScheduled
                                  ? 'bg-[#223026] text-[#7CE0A0] border border-[#7CE0A0]/25'
                                  : isSelected
                                  ? 'bg-[#F5A524] hover:bg-[#FBB53E] text-[#0B0E14]'
                                  : 'bg-[#1F283B] hover:bg-[#2A364F] text-[#F4F6FA]'
                              }`}
                            >
                              {alreadyScheduled ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  Set
                                </>
                              ) : (
                                <>
                                  <Bell className="w-4 h-4" />
                                  Set Alarm
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Primary Bottom Action Bar for the selected cycle */}
              {selectedOption && (
                <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-xs text-[#9BA5B7] tabular-nums">
                    {plannerMode === 'wake_at' ? (
                      <>
                        Ready to lock in your{' '}
                        <span className="text-[#F4F6FA] font-semibold">
                          {formatTimeString(
                            wakeTarget.hour,
                            wakeTarget.minute,
                            settings.use24Hour
                          )}
                        </span>{' '}
                        wake-up alarm?
                      </>
                    ) : (
                      <>
                        Start sleeping now with a{' '}
                        <span className="text-[#F4F6FA] font-semibold">
                          {formatTimeString(
                            selectedOption.targetHour,
                            selectedOption.targetMinute,
                            settings.use24Hour
                          )}
                        </span>{' '}
                        alarm and OLED night clock.
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickSetCycleAlarm(
                        selectedOption,
                        plannerMode === 'sleep_now'
                      )
                    }
                    className="min-h-[48px] px-5 rounded-xl bg-[#F5A524] hover:bg-[#FBB53E] active:scale-[0.98] text-[#0B0E14] font-semibold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0"
                  >
                    <Sunrise className="w-4 h-4" />
                    {plannerMode === 'sleep_now'
                      ? 'Set Alarm & Start Sleep'
                      : plannerMode === 'wake_at'
                      ? `Set ${formatTimeString(
                          wakeTarget.hour,
                          wakeTarget.minute,
                          settings.use24Hour
                        )} Alarm`
                      : `Schedule ${selectedOption.cycles}-Cycle Alarm`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: ACTIVE ALARMS MANAGER ==================== */}
        {activeTab === 'alarms' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F6FA] tracking-tight">
                  Your Alarms
                </h1>
                <p className="text-sm text-[#8E99AD] mt-1 tabular-nums">
                  {nextUpcomingAlarm
                    ? `Next alarm rings in ${formatCountdown(nextAlarmMs)} (${formatTimeString(
                        nextUpcomingAlarm.hour,
                        nextUpcomingAlarm.minute,
                        settings.use24Hour
                      )})`
                    : 'All alarms are currently paused'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenNewAlarm}
                className="min-h-[44px] px-4 rounded-xl bg-[#F5A524] hover:bg-[#FBB53E] active:scale-[0.98] text-[#0B0E14] font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                New Alarm
              </button>
            </div>

            {sortedAlarms.length === 0 ? (
              <div className="rounded-3xl bg-[#131822] border border-white/[0.07] p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#1A2130] flex items-center justify-center text-[#8E99AD] mx-auto mb-4">
                  <Bell className="w-6 h-6" />
                </div>
                <h2 className="font-display text-lg font-semibold text-[#F4F6FA]">
                  No alarms scheduled
                </h2>
                <p className="text-sm text-[#8E99AD] mt-1 max-w-sm mx-auto">
                  Use the 90-minute Sleep Planner to calculate your ideal wake-up window or add a custom alarm.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('planner')}
                    className="min-h-[44px] px-5 rounded-xl bg-[#F5A524] text-[#0B0E14] font-semibold text-sm transition-colors whitespace-nowrap"
                  >
                    Open Sleep Planner
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewAlarm}
                    className="min-h-[44px] px-5 rounded-xl bg-[#1A2130] text-[#F4F6FA] font-medium text-sm transition-colors whitespace-nowrap"
                  >
                    Add Custom Alarm
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedAlarms.map((alarm) => {
                  const parts = formatTimeParts(alarm.hour, alarm.minute, settings.use24Hour);
                  const nextDate = getNextAlarmDate(alarm, now);
                  const countdown = formatCountdown(nextDate.getTime() - now.getTime());

                  return (
                    <div
                      key={alarm.id}
                      className={`rounded-2xl p-5 border transition-colors ${
                        alarm.enabled
                          ? 'bg-[#131822] border-white/[0.08]'
                          : 'bg-[#10141C] border-white/[0.04] opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => setEditingAlarm({ alarm, isNew: false })}
                          className="text-left flex-1 min-w-0 group"
                        >
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={`font-display text-4xl font-semibold tracking-tight tabular-nums ${
                                alarm.enabled ? 'text-[#F4F6FA]' : 'text-[#737F96]'
                              }`}
                            >
                              {parts.timeText}
                            </span>
                            {parts.period && (
                              <span className="font-display text-base font-medium text-[#8E99AD]">
                                {parts.period}
                              </span>
                            )}
                          </div>

                          <p className="text-sm font-medium text-[#D4DBE7] mt-1 truncate">
                            {alarm.label || 'Sleep Cycle Alarm'}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8E99AD] mt-1.5 tabular-nums">
                            <span>{formatRepeatSummary(alarm.repeatDays)}</span>
                            {alarm.cycles && (
                              <>
                                <span className="text-[#4F5A6E]" aria-hidden="true">·</span>
                                <span className="text-[#F5A524]">
                                  {alarm.cycles} {alarm.cycles === 1 ? 'cycle' : 'cycles'} (
                                  {formatDuration(
                                    alarm.sleepDurationMin ??
                                      alarm.cycles * alarm.cycleDurationMin
                                  )}
                                  )
                                </span>
                              </>
                            )}
                            {alarm.enabled && (
                              <>
                                <span className="text-[#4F5A6E]" aria-hidden="true">·</span>
                                <span className="font-mono text-[#9BA5B7]">
                                  Rings in {countdown}
                                </span>
                              </>
                            )}
                          </div>
                        </button>

                        {/* Android Material 3 Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={alarm.enabled}
                          aria-label={`Toggle alarm ${alarm.label}`}
                          onClick={() => handleToggleAlarm(alarm.id)}
                          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors mt-1 ${
                            alarm.enabled ? 'bg-[#F5A524]' : 'bg-[#263042]'
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 rounded-full bg-[#0B0E14] transition-transform ${
                              alarm.enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Bottom utility actions */}
                      <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => triggerAlarmNow(alarm)}
                          className="min-h-[40px] px-3 rounded-xl bg-[#1A2130] hover:bg-[#232D42] text-xs font-medium text-[#9BA5B7] hover:text-[#F4F6FA] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5 text-[#F5A524]" />
                          Test Ring
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingAlarm({ alarm, isNew: false })}
                          className="min-h-[40px] px-3 rounded-xl text-xs font-medium text-[#9BA5B7] hover:text-[#F4F6FA] flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          Edit & Export
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: POWER & CYCLE NAPS ==================== */}
        {activeTab === 'naps' && (
          <NapTimerView
            now={now}
            settings={settings}
            onTriggerNapAlarm={(napAlarm) => triggerAlarmNow(napAlarm)}
          />
        )}

        {/* ==================== TAB 4: SLEEP CALIBRATION SETTINGS ==================== */}
        {activeTab === 'settings' && (
          <SettingsView settings={settings} onChange={setSettings} />
        )}
      </main>

      {/* Mobile Fixed Android Bottom Navigation Bar (64px height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E131D]/95 backdrop-blur-md border-t border-white/[0.08] pb-safe"
      >
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <div
                  className={`relative px-4 py-1 rounded-full transition-colors ${
                    active ? 'bg-[#F5A524]/18 text-[#F5A524]' : 'text-[#8E99AD]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.id === 'alarms' && activeAlarmsCount > 0 && (
                    <span className="absolute -top-0.5 right-2 text-[10px] font-mono font-semibold text-[#F5A524] tabular-nums">
                      {activeAlarmsCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium tracking-tight ${
                    active ? 'text-[#F4F6FA]' : 'text-[#7E8A9F]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Subtle Snackbar / Toast Notification (Android Material Snackbar style) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-[#1E2636] border border-white/[0.12] text-xs sm:text-sm font-medium text-[#F4F6FA] shadow-xl flex items-center gap-2.5 whitespace-nowrap"
        >
          <BellRing className="w-4 h-4 text-[#F5A524] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Alarm Editor Bottom Sheet / Dialog */}
      {editingAlarm && (
        <AlarmEditorModal
          alarm={editingAlarm.alarm}
          isNew={editingAlarm.isNew}
          use24Hour={settings.use24Hour}
          now={now}
          onSave={handleSaveAlarm}
          onDelete={handleDeleteAlarm}
          onClose={() => setEditingAlarm(null)}
        />
      )}

      {/* Full-Screen OLED Bedside Nightstand Clock */}
      {showBedsideClock && (
        <BedsideClock
          now={now}
          use24Hour={settings.use24Hour}
          nextAlarm={nextUpcomingAlarm}
          activeSession={activeSession}
          onClose={() => setShowBedsideClock(false)}
          onEndSession={() => setActiveSession(null)}
        />
      )}

      {/* Full-Screen Active Alarm Ringing Overlay */}
      {ringingAlarm && (
        <RingingOverlay
          alarm={ringingAlarm}
          now={now}
          use24Hour={settings.use24Hour}
          cycleLengthMinutes={settings.cycleLengthMinutes}
          onDismiss={handleDismissRinging}
          onSnooze={handleSnoozeRinging}
        />
      )}
    </div>
  );
}
