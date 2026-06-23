import { api } from './client';
import type { AppNotification } from '@/types/notification';

interface NotificationsListResponse {
  notifications: AppNotification[];
}

interface NotificationResponse {
  notification: AppNotification;
}

export async function getMyNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<NotificationsListResponse>('/notifications/client');
  return data.notifications || [];
}

export async function getNotificationById(id: string): Promise<AppNotification> {
  const { data } = await api.get<NotificationResponse>(`/notifications/${id}`);
  return data.notification;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}
