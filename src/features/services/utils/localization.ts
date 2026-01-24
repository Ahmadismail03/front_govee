import type { Service } from '../../../core/domain/service';

const FIXED_SERVICE_NAME_EN: Record<string, string> = {
  RESIDENCE_EXTENSION_NORMAL: 'Residence Permit Extension',
  RESIDENCE_EXTENSION_MULTIPLE_VISA: 'Residence Permit Extension (Multiple Visa)',
  ISSUE_ID_FIRST_TIME: 'Issue National ID (First time)',
  ISSUE_PASSPORT_FIRST_TIME_OVER_18: 'Issue Passport (First time, 18+)',
  ISSUE_PASSPORT_FIRST_TIME_UNDER_18: 'Issue Passport (First time, under 18)',
  RENEW_PASSPORT_UNDER_18: 'Renew Passport (under 18)',
  RENEW_PASSPORT_VALID_MORE_THAN_6_MONTHS: 'Renew Passport (valid > 6 months)',
  PASSPORT_REPLACE_LOST: 'Replace Passport (lost)',
  PASSPORT_REPLACE_DAMAGED: 'Replace Passport (damaged)',
  PASSPORT_REPLACE_EXPIRED: 'Replace Passport (expired)',
  DEATH_CERTIFICATE: 'Issue Death Certificate (paid)',
  BIRTH_CERTIFICATE: 'Issue Birth Certificate (paid)',
};

const FIXED_FEE_DESC_EN: Record<string, string> = {
  'طوابع عند تقديم الطلب': 'Stamps (on application submission)',
  'رسوم عبر بنك القاهرة عمان': 'Fees via Cairo Amman Bank',
  'طوابع عند الموافقة واستلام الجواز': 'Stamps (on approval and passport pickup)',
};

function titleCaseFromId(id: string): string {
  return id
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function getServiceDisplayName(service: Service, language: string): string {
  const isEn = String(language).toLowerCase().startsWith('en');
  if (!isEn) return service.name;
  return FIXED_SERVICE_NAME_EN[service.id] ?? titleCaseFromId(service.id);
}

export function getServiceDisplayDescription(service: Service, language: string): string {
  const isEn = String(language).toLowerCase().startsWith('en');
  if (!isEn) return service.description;

  // If you want fully curated English descriptions, add them to a map here.
  // For now, fall back to an English-ish placeholder rather than Arabic.
  return service.description && /[A-Za-z]/.test(service.description)
    ? service.description
    : `Service: ${getServiceDisplayName(service, language)}.`;
}

export function getFeeDisplayDescription(raw: string | null | undefined, language: string): string {
  const isEn = String(language).toLowerCase().startsWith('en');
  if (!raw) return '';
  if (!isEn) return raw;
  return FIXED_FEE_DESC_EN[raw] ?? raw;
}
