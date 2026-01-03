import { useCallback, useState } from 'react';

export function useSwipeDeleteIndicator() {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const beginDelete = useCallback((id: string, action: () => void) => {
    setDeletingId(id);
    requestAnimationFrame(() => {
      action();
      setDeletingId(null);
    });
  }, []);

  const clearDeletingId = useCallback(() => {
    setDeletingId(null);
  }, []);

  return { deletingId, beginDelete, clearDeletingId };
}
