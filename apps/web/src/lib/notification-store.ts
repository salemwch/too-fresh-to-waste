import { create } from 'zustand';

export interface NewOrderNotification {
  id: string; // orderId — used as unique key
  orderNumber: string;
  customerName: string;
  total: number;
  createdAt: string; // ISO string
  read: boolean;
}

interface NotificationStore {
  notifications: NewOrderNotification[];
  unreadCount: number;
  addNewOrder: (n: Omit<NewOrderNotification, 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNewOrder: (n) =>
    set((state) => {
      // Deduplicate: ignore if we already have this orderId
      if (state.notifications.some((x) => x.id === n.id)) return state;
      const notification: NewOrderNotification = { ...n, read: false };
      const notifications = [notification, ...state.notifications].slice(0, 50);
      return { notifications, unreadCount: state.unreadCount + 1 };
    }),

  markRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}));
