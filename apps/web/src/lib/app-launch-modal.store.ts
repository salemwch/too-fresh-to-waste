import { create } from 'zustand';

interface AppLaunchModalStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useAppLaunchModal = create<AppLaunchModalStore>(set => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
