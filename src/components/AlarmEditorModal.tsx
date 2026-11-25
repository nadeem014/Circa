import React, { useState, useEffect } from 'react';
import { X, Volume2, Square, Trash2, CalendarPlus, Smartphone } from 'lucide-react';
import { Alarm, AlarmToneId } from '../types/sleep';
import { ALARM_TONES, alarmAudio } from '../utils/alarmAudio';
import {
  DAY_LABELS,
  buildAndroidClockIntentUrl,
  downloadAlarmIcs,
  formatDuration,
} from '../utils/sleepMath';
import { TimeWheelInput } from './TimeWheelInput';

interface AlarmEditorModalProps {
  alarm: Alarm;
  isNew: boolean;
  use24Hour: boolean;
  now: Date;
  onSave: (updated: Alarm) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const AlarmEditorModal: React.FC<AlarmEditorModalProps> = ({
  alarm,
  isNew,
  use24Hour,
  now,
  onSave,
  onDelete,
  onClose,
}) => {
  const [draft, setDraft] = useState<Alarm>(alarm);
  const [previewingTone, setPreviewingTone] = useState<AlarmToneId | null>(null);

  useEffect(() => {
    return () => {
      alarmAudio.stop();
    };
  }, []);

  const toggleDay = (dayIndex: number) => {
    setDraft((prev) => {
      const exists = prev.repeatDays.includes(dayIndex);
      const nextDays = exists
        ? prev.repeatDays.filter((d) => d !== dayIndex)
        : [...prev.repeatDays, dayIndex].sort((a, b) => a - b);
      return { ...prev, repeatDays: nextDays };
    });
  };

  const handlePreviewTone = (toneId: AlarmToneId) => {
    if (previewingTone === toneId) {
      alarmAudio.stop();
      setPreviewingTone(null);
      return;
    }
    alarmAudio.previewTone(toneId);
    setPreviewingTone(toneId);
    window.setTimeout(() => {
      setPreviewingTone((current) => (current === toneId ? null : current));
    }, 3200);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alarmAudio.stop();
    onSave({ ...draft, enabled: true });
  };

  const isAndroid =
    typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? 'Set sleep cycle alarm' : 'Edit alarm'}
    >
      <div className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#101520] border border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F4F6FA]">
              {isNew ? 'Set Cycle Alarm' : 'Edit Alarm'}
            </h2>
            {draft.cycles && (
              <p className="text-xs text-[#8E99AD] tabular-nums">
                {draft.cycles} {draft.cycles === 1 ? 'cycle' : 'cycles'} ·{' '}
                {formatDuration(draft.sleepDurationMin ?? draft.cycles * draft.cycleDurationMin)} sleep
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              alarmAudio.stop();
              onClose();
            }}
            aria-label="Close alarm editor"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#8E99AD] hover:text-[#F4F6FA] hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <TimeWheelInput
            hour={draft.hour}
            minute={draft.minute}
            use24Hour={use24Hour}
            onChange={(hour, minute) => setDraft((prev) => ({ ...prev, hour, minute }))}
          />

          {/* Alarm Label */}
          <div>
            <label
              htmlFor="alarm-label"
              className="block text-xs font-medium text-[#9BA5B7] mb-2"
            >
              Alarm Label
            </label>
            <input
              id="alarm-label"
              type="text"
              value={draft.label}
              onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Morning Refresh"
              maxLength={40}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#161C29] border border-white/[0.08] text-sm text-[#F4F6FA] placeholder-[#5A657B] focus:outline-none focus:border-[#F5A524]"
            />
          </div>

          {/* Repeat Days */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#9BA5B7]">Repeat Schedule</span>
              <span className="text-xs text-[#6E7A91]">
                {draft.repeatDays.length === 0 ? 'One-time alarm' : `${draft.repeatDays.length} days/week`}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((label, idx) => {
                const active = draft.repeatDays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    aria-pressed={active}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[#F5A524] text-[#0B0E14]'
                        : 'bg-[#161C29] text-[#9BA5B7] hover:bg-[#1E2636] hover:text-[#F4F6FA]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wake Tone Selector */}
          <div>
            <span className="block text-xs font-medium text-[#9BA5B7] mb-2">
              Gentle Wake Tone
            </span>
            <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#161C29] border border-white/[0.07] overflow-hidden">
              {ALARM_TONES.map((tone) => {
                const selected = draft.tone === tone.id;
                const isPreviewing = previewingTone === tone.id;
                return (
                  <div
                    key={tone.id}
                    className={`flex items-center justify-between px-3.5 py-2.5 transition-colors ${
                      selected ? 'bg-[#F5A524]/10' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, tone: tone.id }))}
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
                      onClick={() => handlePreviewTone(tone.id)}
                      aria-label={isPreviewing ? `Stop ${tone.name}` : `Preview ${tone.name}`}
                      className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
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
          </div>

          {/* Gradual Fade-In & Snooze */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-xs font-medium text-[#9BA5B7] mb-2">
                Volume Fade-In
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#161C29] border border-white/[0.06]">
                {[0, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, fadeInSeconds: sec }))}
                    className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      draft.fadeInSeconds === sec
                        ? 'bg-[#252F42] text-[#F4F6FA]'
                        : 'text-[#8E99AD] hover:text-[#F4F6FA]'
                    }`}
                  >
                    {sec === 0 ? 'Instant' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#9BA5B7] mb-2">
                Snooze Duration
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#161C29] border border-white/[0.06]">
                {[5, 10, 15].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, snoozeMinutes: min }))}
                    className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      draft.snoozeMinutes === min
                        ? 'bg-[#252F42] text-[#F4F6FA]'
                        : 'text-[#8E99AD] hover:text-[#F4F6FA]'
                    }`}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Device handoff utilities */}
          <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
            {isAndroid && (
              <a
                href={buildAndroidClockIntentUrl(draft)}
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl bg-[#161C29] border border-white/[0.08] text-xs font-medium text-[#9BA5B7] hover:text-[#F4F6FA] transition-colors whitespace-nowrap"
              >
                <Smartphone className="w-4 h-4" />
                Send to Android Clock
              </a>
            )}
            <button
              type="button"
              onClick={() => downloadAlarmIcs(draft, now)}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl bg-[#161C29] border border-white/[0.08] text-xs font-medium text-[#9BA5B7] hover:text-[#F4F6FA] transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4" />
              Export Calendar Alert (.ics)
            </button>
          </div>
        </form>

        {/* Sticky footer actions */}
        <div className="px-5 py-4 border-t border-white/[0.07] bg-[#101520] flex items-center gap-3 pb-safe">
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={() => {
                alarmAudio.stop();
                onDelete(draft.id);
              }}
              aria-label="Delete alarm"
              className="min-h-[48px] px-4 rounded-xl bg-[#1C161A] border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-colors flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 min-h-[48px] px-6 rounded-xl bg-[#F5A524] hover:bg-[#FBB53E] active:scale-[0.99] text-[#0B0E14] font-semibold text-sm transition-all whitespace-nowrap"
          >
            {isNew ? 'Save & Enable Alarm' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
