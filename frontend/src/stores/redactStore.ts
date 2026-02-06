import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RedactState {
  isRedacted: boolean;
  toggleRedact: () => void;
  setRedacted: (value: boolean) => void;
}

export const useRedactStore = create<RedactState>()(
  persist(
    (set) => ({
      isRedacted: false,
      toggleRedact: () => set((state) => ({ isRedacted: !state.isRedacted })),
      setRedacted: (value) => set({ isRedacted: value }),
    }),
    { name: 'peek-redact' }
  )
);
