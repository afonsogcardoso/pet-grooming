import i18n from '../i18n';

export type AppointmentStatus = 'scheduled' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Retorna a cor associada a cada estado de marcação
 */
export function getStatusColor(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return '#4fafa9'; // azul principal
    case 'pending':
      return '#82B1FF'; // pendente
    case 'in_progress':
      return '#144FA1'; // em progresso
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

/**
 * Retorna a etiqueta para o botão de ação (antes de ser clicado)
 */
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
