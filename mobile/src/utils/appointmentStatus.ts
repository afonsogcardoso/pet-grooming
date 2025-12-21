import i18n from '../i18n';

export type AppointmentStatus = 'scheduled' | 'pending' | 'completed' | 'cancelled';

/**
 * Retorna a cor associada a cada estado de marcação
 */
export function getStatusColor(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return '#F47C1C'; // laranja principal
    case 'pending':
      return '#FFA85C'; // laranja claro
    case 'completed':
      return '#10b981'; // verde
    case 'cancelled':
      return '#ef4444'; // vermelho
    default:
      return '#6F6F6F'; // cinza para estados desconhecidos
  }
}

/**
 * Retorna a etiqueta em português para cada estado
 */
export function getStatusLabel(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return i18n.t('status.scheduled');
    case 'pending':
      return i18n.t('status.pending');
    case 'completed':
      return i18n.t('status.completed');
    case 'cancelled':
      return i18n.t('status.cancelled');
    default:
      return i18n.t('common.unknown');
  }
}

/**
 * Retorna a etiqueta para o botão de ação (antes de ser clicado)
 */
export function getStatusButtonLabel(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return i18n.t('status.button.scheduled');
    case 'pending':
      return i18n.t('status.button.pending');
    case 'completed':
      return i18n.t('status.button.completed');
    case 'cancelled':
      return i18n.t('status.button.cancelled');
    default:
      return i18n.t('common.unknown');
  }
}
