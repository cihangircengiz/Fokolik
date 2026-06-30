import { create } from 'zustand';

export const useBetStore = create((set, get) => ({
  selectedOdds: [],
  betAmount: "10",
  
  toggleOdd: (match, odd) => set((state) => {
    const existingIndex = state.selectedOdds.findIndex(item => item.odd.id === odd.id);
    if (existingIndex >= 0) {
      // Remove it
      const newOdds = [...state.selectedOdds];
      newOdds.splice(existingIndex, 1);
      return { selectedOdds: newOdds };
    } else {
      // Add it
      return { selectedOdds: [...state.selectedOdds, { match, odd }] };
    }
  }),
  
  removeSelection: (matchId) => set((state) => ({
    selectedOdds: state.selectedOdds.filter(item => item.match.id !== matchId)
  })),

  clearSlip: () => set({ selectedOdds: [], betAmount: "10" }),

  setBetAmount: (amount) => set({ betAmount: amount })
}));
