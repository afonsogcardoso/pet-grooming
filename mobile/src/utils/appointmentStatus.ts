import i18n from '../i18n';

export type AppointmentStatus = 'scheduled' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

export function getStatusColor(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return '#4fafa9';
    case 'pending':
      return '#82B1FF';
    case 'in_progress':
      return '#144FA1';
    case 'completed':
      return '#10b981';
    case 'cancelled':
      return '#ef4444';
    default:
      return '#6F6F6F';
  }
}

export function getStatusLabel(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return i18n.t('status.scheduled');
    case 'pending':
      return i18n.t('status.pending');
    case 'in_progress':
      return i18n.t('status.in_progress');
    case 'completed':
      return i18n.t('status.completed');
    case 'cancelled':
      return i18n.t('status.cancelled');
    default:
      return i18n.t('common.unknown');
  }
}

export function getStatusButtonLabel(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return i18n.t('status.button.scheduled');
    case 'pending':
      return i18n.t('status.button.pending');
    case 'in_progress':
      return i18n.t('status.button.in_progress');
    case 'completed':
      return i18n.t('status.button.completed');
    case 'cancelled':
      return i18n.t('status.button.cancelled');
    default:
      return i18n.t('common.unknown');
  }
}
