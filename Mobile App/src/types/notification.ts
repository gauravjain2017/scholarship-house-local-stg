export type NotificationType =
  | 'new_registration'
  | 'new_property'
  | string;

export interface AppNotification {
  id: string;
  notification_type: NotificationType;
  action_performer_id?: string;
  admin_email?: string;
  type_id?: string;
  notify: boolean;
  created_at: string;
}
