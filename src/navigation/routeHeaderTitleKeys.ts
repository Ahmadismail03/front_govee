import type { RootStackParamList } from './types';

/**
 * Default i18n keys for stack header titles (used by RtlStackHeaderRight when native title is cleared in RTL).
 */
export const ROUTE_HEADER_TITLE_KEYS: Partial<Record<keyof RootStackParamList, string>> = {
  ProfileEdit: 'profile.editProfileButton',
  ContactUs: 'support.contact.title',
  TechnicalSupport: 'support.technical.title',
  ReportProblem: 'support.report.title',
  Settings: 'settings.title',
  AuthOtp: 'auth.otpTitle',
  BookingSelectDate: 'booking.selectDate',
  BookingSelectSlot: 'booking.selectSlot',
  BookingConfirm: 'booking.confirm',
  BookingSuccess: '',
  AppointmentDetails: 'appointments.details',
  AppointmentRescheduleSelectDate: 'appointments.reschedule',
  AppointmentRescheduleSelectSlot: 'appointments.reschedule',
  AppointmentRescheduleConfirm: 'appointments.reschedule',
  HelpCenter: 'help.title',
  HelpTopicDetails: 'help.detailsTitle',
};
