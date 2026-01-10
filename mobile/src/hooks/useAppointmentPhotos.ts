import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAppointmentPhoto, getAppointment, uploadAppointmentPhoto } from '../api/appointments';
import { compressImage } from '../utils/imageCompression';

export function useAppointmentPhotos(appointmentId?: string | null) {
  const queryClient = useQueryClient();

  const { data: appointment, isLoading } = useQuery<any>({
    queryKey: ['appointment', appointmentId],
    queryFn: () => getAppointment(appointmentId!),
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(appointmentId),
  });

  const upload = useMutation({
    mutationFn: async (payload: { type: 'before' | 'after'; file: { uri: string; name: string; type: string }; appointmentServiceId?: string | null; serviceId?: string | null; petId?: string | null }) => {
      if (!appointmentId) throw new Error('No appointmentId');
      const compressed = { ...(payload.file) };
      compressed.uri = await compressImage(payload.file.uri);
      return uploadAppointmentPhoto(appointmentId, payload.type, compressed, {
        appointmentServiceId: payload.appointmentServiceId,
        serviceId: payload.serviceId,
        petId: payload.petId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (photoId: string) => {
      try {
        await deleteAppointmentPhoto(photoId);
      } catch (err: any) {
        const status = err?.response?.status;
        const data = err?.response?.data;
        console.error('delete appointment photo error', { photoId, appointmentId, status, data });
        throw err;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const uploadPhoto = useCallback(
    async (type: 'before' | 'after', file: { uri: string; name: string; type: string }, opts?: { appointmentServiceId?: string; serviceId?: string; petId?: string }) => {
      return upload.mutateAsync({ type, file, appointmentServiceId: opts?.appointmentServiceId ?? null, serviceId: opts?.serviceId ?? null, petId: opts?.petId ?? null });
    },
    [upload]
  );

  return {
    appointment,
    isLoading,
    photos: appointment ? (appointment as any).photos || [] : [],
    uploadPhoto,
    uploadState: { isUploading: (upload as any).isLoading ?? false, error: (upload as any).error ?? null },
    removePhoto: remove.mutateAsync,
  };
}

export default useAppointmentPhotos;
