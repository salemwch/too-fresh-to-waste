// Global type definitions for the Food Waste mobile app

// Redux types
import type { store } from '@/store';

export type RootState = ReturnType<typeof store.getState>;
