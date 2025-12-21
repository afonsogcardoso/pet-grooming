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
      return 'Agendado';
    case 'pending':
      return 'Em progresso';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Desconhecido';
  }
}

/**
 * Retorna a etiqueta para o botão de ação (antes de ser clicado)
 */
export function getStatusButtonLabel(status?: string | null): string {
  switch (status) {
    case 'scheduled':
      return 'Agendar';
    case 'pending':
      return 'Em progresso';
    case 'completed':
      return 'Concluir';
    case 'cancelled':
      return 'Cancelar';
    default:
      return 'Desconhecido';
  }
}
