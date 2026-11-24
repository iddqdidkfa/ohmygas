import type { Discount, FuelType } from '@ohmygas/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const dkey = (networkId: string, fuel: FuelType) => `${networkId}:${fuel}`;

interface State {
  discounts: Record<string, Discount>;
  set: (networkId: string, fuel: FuelType, d: Discount | null) => void;
  replaceAll: (d: Record<string, Discount>) => void;
  clear: () => void;
}

export const useDiscounts = create<State>()(
  persist(
    (set) => ({
      discounts: {},
      set: (networkId, fuel, d) =>
        set((s) => {
          const next = { ...s.discounts };
          // value 0 is kept so a chosen type survives before an amount is typed (0 = no discount)
          if (!d) delete next[dkey(networkId, fuel)];
          else next[dkey(networkId, fuel)] = d;
          return { discounts: next };
        }),
      replaceAll: (discounts) => set({ discounts }),
      clear: () => set({ discounts: {} }),
    }),
    { name: 'ohmygas-discounts' },
  ),
);
