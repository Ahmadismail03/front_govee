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
  // Backend source of truth for saving reminder settings.
  await getApiClient().put('/me/reminder-settings', {
    enabled: pref.enabled,
    offsetMinutes: Math.max(1, Math.round((pref.leadTimeHours ?? 2) * 60)),
    viaSms: pref.channel === 'sms' || pref.channel === 'both',
    viaEmail: pref.channel === 'email' || pref.channel === 'both',
    email: pref.email ?? undefined,
  });
  return pref;
}
