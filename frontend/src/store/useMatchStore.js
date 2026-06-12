import { create } from 'zustand';

export const useMatchStore = create((set, get) => ({
  matches: [],
  
  // Initialize the store with fetched matches
  setMatches: (matches) => set({ matches }),
  
  // Update matches based on WebSocket data
  updateMatches: (updatedMatches) => set((state) => {
    const matchMap = new Map(state.matches.map(m => [m.id, m]));
    let hasChanges = false;
    
    updatedMatches.forEach(updatedMatch => {
      if (matchMap.has(updatedMatch.id)) {
        // Merge the new data into the existing match
        matchMap.set(updatedMatch.id, {
          ...matchMap.get(updatedMatch.id),
          ...updatedMatch
        });
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      return { matches: Array.from(matchMap.values()) };
    }
    return state;
  }),

  // Get a single match by id
  getMatchById: (id) => {
    return get().matches.find(m => m.id === id);
  }
}));
