import React, { useState, useEffect } from 'react';
import { Volume2, Square, Bell, Smartphone, RotateCcw } from 'lucide-react';
import { AlarmToneId, SleepSettings } from '../types/sleep';
import { ALARM_TONES, alarmAudio } from '../utils/alarmAudio';
import { DEFAULT_SETTINGS } from '../utils/sleepMath';

interface SettingsViewProps {
  settings: SleepSettings;
  onChange: (next: SleepSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onChange }) => {
  const [previewingTone, setPreviewingTone] = useState<AlarmToneId | null>(null);
  const [notifStatus, setNotifStatus] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  useEffect(() => {
    return () => {
      alarmAudio.stop();
    };
  }, []);

  const handlePreview = (toneId: AlarmToneId) => {
    if (previewingTone === toneId) {
      alarmAudio.stop();
      setPreviewingTone(null);
      return;
    }
    alarmAudio.previewTone(toneId);
    setPreviewingTone(toneId);
    window.setTimeout(() => {
      setPreviewingTone((curr) => (curr === toneId ? null : curr));
    }, 3200);
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotifStatus(result);
    } catch {
      // Ignore browser blocks
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F6FA] tracking-tight">
            Sleep Calibration
          </h1>
          <p className="text-sm text-[#8E99AD] mt-1">
            Personalize your fall-asleep latency, cycle duration, and default gentle alarm sound.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_SETTINGS)}
          className="min-h-[40px] px-3.5 rounded-xl bg-[#131822] border border-white/[0.08] text-xs font-medium text-[#9BA5B7] hover:text-[#F4F6FA] flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Sleep rhythm parameters */}
        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-5 space-y-6">
            {/* Fall asleep latency */}
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <label htmlFor="latency-slider" className="text-sm font-medium text-[#F4F6FA]">
                  Time to fall asleep
                </label>
                <span className="font-mono text-sm font-semibold text-[#F5A524] tabular-nums">
                  {settings.fallAsleepMinutes} min
                </span>
              </div>
              <input
                id="latency-slider"
                type="range"
                min={0}
                max={45}
                step={1}
                value={settings.fallAsleepMinutes}
                onChange={(e) =>
                  onChange({ ...settings, fallAsleepMinutes: Number(e.target.value) })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#6E7A91] mt-1.5 tabular-nums">
                <span>0m (instant)</span>
                <span>14m (average)</span>
                <span>45m</span>
              </div>
            </div>

            <div className="border-t border-white/[0.06]" />

            {/* Personal cycle length */}
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <label htmlFor="cycle-slider" className="text-sm font-medium text-[#F4F6FA]">
                  Sleep cycle length
                </label>
                <span className="font-mono text-sm font-semibold text-[#F5A524] tabular-nums">
                  {settings.cycleLengthMinutes} min
                </span>
              </div>
              <input
                id="cycle-slider"
                type="range"
                min={80}
                max={105}
                step={1}
                value={settings.cycleLengthMinutes}
                onChange={(e) =>
                  onChange({ ...settings, cycleLengthMinutes: Number(e.target.value) })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#6E7A91] mt-1.5 tabular-nums">
                <span>80m</span>
                <span>90m (standard)</span>
                <span>105m</span>
              </div>
            </div>

            <div className="border-t border-white/[0.06]" />

            {/* 24-hour clock format */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#F4F6FA]">24-hour clock format</p>
                <p className="text-xs text-[#8E99AD] mt-0.5">
                  Display times as 06:30 instead of 6:30 AM
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.use24Hour}
                onClick={() => onChange({ ...settings, use24Hour: !settings.use24Hour })}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  settings.use24Hour ? 'bg-[#F5A524]' : 'bg-[#263042]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-[#0B0E14] transition-transform ${
                    settings.use24Hour ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Android Home Screen & Notifications */}
          <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1A2130] flex items-center justify-center text-[#F5A524] shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F4F6FA]">Wake Notifications</p>
                  <p className="text-xs text-[#8E99AD] mt-0.5">
                    {notifStatus === 'granted'
                      ? 'Enabled for alarm alerts while browser is open'
                      : notifStatus === 'denied'
                      ? 'Blocked in browser settings'
                      : 'Allow system notifications when an alarm rings'}
                  </p>
                </div>
              </div>
              {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
                <button
                  type="button"
                  onClick={requestNotifications}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#1A2130] hover:bg-[#252F42] text-xs font-medium text-[#F4F6FA] transition-colors whitespace-nowrap shrink-0"
                >
                  Enable
                </button>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1A2130] flex items-center justify-center text-[#8DA2FB] shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F4F6FA]">
                  Install on Android Home Screen
                </p>
                <p className="text-xs text-[#8E99AD] mt-1 leading-relaxed">
                  Open this app in Chrome on Android, tap the menu button (⋮), and choose{' '}
                  <span className="text-[#F4F6FA] font-medium">Add to Home screen</span> to run Circa full-screen like a native Android app. You can also send any calculated alarm straight to Android Clock or download a calendar alert.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Default alarm sound & fade-in */}
        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F6FA]">Default Wake Tone</h2>
              <p className="text-xs text-[#8E99AD] mt-0.5">
                Synthesized locally with Web Audio API — works offline without audio lag
              </p>
            </div>

            <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#0F131C] border border-white/[0.06] overflow-hidden">
              {ALARM_TONES.map((tone) => {
                const selected = settings.defaultTone === tone.id;
                const isPreviewing = previewingTone === tone.id;
                return (
                  <div
                    key={tone.id}
                    className={`flex items-center justify-between px-4 py-3 transition-colors ${
                      selected ? 'bg-[#F5A524]/10' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onChange({ ...settings, defaultTone: tone.id })}
                      className="flex-1 text-left min-h-[44px] flex flex-col justify-center pr-3"
                    >
                      <span
                        className={`text-sm font-medium ${
                          selected ? 'text-[#F5A524]' : 'text-[#F4F6FA]'
                        }`}
                      >
                        {tone.name}
                      </span>
                      <span className="text-xs text-[#7E8A9F]">{tone.description}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreview(tone.id)}
                      aria-label={isPreviewing ? `Stop ${tone.name}` : `Preview ${tone.name}`}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
                        isPreviewing
                          ? 'bg-[#F5A524] text-[#0B0E14]'
                          : 'bg-white/[0.05] text-[#9BA5B7] hover:text-[#F4F6FA]'
                      }`}
                    >
                      {isPreviewing ? (
                        <Square className="w-4 h-4 fill-current" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <span className="block text-xs font-medium text-[#9BA5B7] mb-2">
                Default Gentle Volume Fade-In
              </span>
              <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[#0F131C] border border-white/[0.06]">
                {[0, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onChange({ ...settings, defaultFadeInSeconds: sec })}
                    className={`min-h-[44px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      settings.defaultFadeInSeconds === sec
                        ? 'bg-[#252F42] text-[#F4F6FA]'
                        : 'text-[#8E99AD] hover:text-[#F4F6FA]'
                    }`}
                  >
                    {sec === 0 ? 'Instant' : `${sec} seconds`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Concise Sleep Cycle Science card */}
          <div className="rounded-2xl bg-[#131822] border border-white/[0.07] p-5">
            <h2 className="text-sm font-semibold text-[#F4F6FA]">
              Why 90-Minute Cycles Matter
            </h2>
            <p className="text-xs text-[#8E99AD] mt-2 leading-relaxed">
              Each sleep cycle progresses through Light Sleep (N1–N2), restorative Deep Slow-Wave Sleep (N3), and REM dreaming before briefly returning near wakefulness around minute {settings.cycleLengthMinutes}. Waking at that cycle boundary avoids sleep inertia—the heavy grogginess caused by an alarm interrupting deep sleep.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
