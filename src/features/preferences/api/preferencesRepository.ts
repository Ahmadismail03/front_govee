import { getApiClient } from '../../../core/api/axiosClient';
import type { ReminderChannel, ReminderLeadTimeHours, ReminderPreference } from '../../../core/domain/reminderPreference';

type BackendReminderSettings = {
  enabled: boolean;
  offsetMinutes: number;
  viaSms: boolean;
  viaEmail: boolean;
  email?: string | null;
};

function snapLeadTimeHours(hours: number): ReminderLeadTimeHours {
  const allowed: ReminderLeadTimeHours[] = [48, 24, 2];
  return allowed.reduce((best, cur) => (Math.abs(cur - hours) < Math.abs(best - hours) ? cur : best), allowed[0]);
}

function toChannel(enabled: boolean, viaSms: boolean, viaEmail: boolean): ReminderChannel {
  if (!enabled) return 'none';
  if (viaSms && viaEmail) return 'both';
  if (viaSms) return 'sms';
  if (viaEmail) return 'email';
  return 'none';
}

export async function getReminderPreference(): Promise<ReminderPreference> {
  const res = await getApiClient().get<BackendReminderSettings>('/me/reminder-settings');
  const r = res.data;

  const leadTimeHours = snapLeadTimeHours(Math.round((r.offsetMinutes ?? 1440) / 60));
  const channel = toChannel(Boolean(r.enabled), Boolean(r.viaSms), Boolean(r.viaEmail));

  return {
    enabled: Boolean(r.enabled),
    leadTimeHours,
    channel,
    email: channel === 'email' || channel === 'both' ? String(r.email ?? '') : '',
  };
}

export async function setReminderPreference(pref: ReminderPreference): Promise<ReminderPreference> {
  const viaSms = pref.channel === 'sms' || pref.channel === 'both';
  const viaEmail = pref.channel === 'email' || pref.channel === 'both';
  const email = String(pref.email ?? '').trim();

  // Backend validates `email` with zod.email() when present, so never send empty string.
  // Also, backend requires an email when reminders are enabled via email.
  if (pref.enabled && viaEmail && !email) {
    throw new Error('Email is required when enabling email reminders.');
  }

  await getApiClient().put('/me/reminder-settings', {
    enabled: pref.enabled,
    offsetMinutes: Math.max(1, Math.round((pref.leadTimeHours ?? 2) * 60)),
    viaSms,
    viaEmail,
    ...(pref.enabled && viaEmail ? { email } : {}),
  });
  return pref;
}
