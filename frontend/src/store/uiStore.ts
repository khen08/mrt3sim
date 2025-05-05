import { create } from "zustand";

// Define UI state interface
interface UIState {
  // Sidebar
  isSidebarCollapsed: boolean;

  // Modals
  isHistoryModalOpen: boolean;
  isClearConfirmOpen: boolean;
  isDataViewerModalOpen: boolean;

  // Selection
  selectedStation: number | null;
  selectedTrainId: number | null;
  selectedTrainDetails: any | null;

  // History loading
  isHistoryLoading: boolean;
  historySimulations: any[];
  hasFetchedInitialHistory: boolean;

  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setHistoryModalOpen: (open: boolean) => void;
  setClearConfirmOpen: (open: boolean) => void;
  setDataViewerModalOpen: (open: boolean) => void;
  setSelectedStation: (station: number | null) => void;
  setSelectedTrainId: (id: number | null) => void;
  setSelectedTrainDetails: (details: any | null) => void;
  setHistoryLoading: (loading: boolean) => void;
  setHistorySimulations: (simulations: any[]) => void;
  addHistorySimulations: (simulations: any[]) => void;
  setHasFetchedInitialHistory: (fetched: boolean) => void;
  resetState: () => void;

  // Combined actions
  selectStation: (stationId: number | null) => void;
  selectTrain: (trainId: number | null, details: any | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  isSidebarCollapsed: false,
  isHistoryModalOpen: false,
  isClearConfirmOpen: false,
  isDataViewerModalOpen: false,
  selectedStation: null,
  selectedTrainId: null,
  selectedTrainDetails: null,
  isHistoryLoading: false,
  historySimulations: [],
  hasFetchedInitialHistory: false,

  // Basic setters
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  setHistoryModalOpen: (open) => set({ isHistoryModalOpen: open }),
  setClearConfirmOpen: (open) => set({ isClearConfirmOpen: open }),
  setDataViewerModalOpen: (open) => set({ isDataViewerModalOpen: open }),
  setSelectedStation: (station) => set({ selectedStation: station }),
  setSelectedTrainId: (id) => set({ selectedTrainId: id }),
  setSelectedTrainDetails: (details) => set({ selectedTrainDetails: details }),
  setHistoryLoading: (loading) => set({ isHistoryLoading: loading }),
  setHistorySimulations: (simulations) =>
    set({ historySimulations: simulations }),
  addHistorySimulations: (simulations) =>
    set((state) => {
      // Get existing IDs to avoid duplicates
      const existingIds = new Set(
        state.historySimulations.map((s) => s.SIMULATION_ID)
      );
      const newData = simulations.filter(
        (s) => !existingIds.has(s.SIMULATION_ID)
      );

      // Prepend new data and sort
      const merged = [...newData, ...state.historySimulations];
      merged.sort((a, b) => b.SIMULATION_ID - a.SIMULATION_ID);

      return { historySimulations: merged };
    }),
  setHasFetchedInitialHistory: (fetched) =>
    set({ hasFetchedInitialHistory: fetched }),

  // Reset state back to defaults
  resetState: () =>
    set({
      // Only reset selection and modal state, preserve history and sidebar state
      selectedStation: null,
      selectedTrainId: null,
      selectedTrainDetails: null,
      isHistoryModalOpen: false,
      isClearConfirmOpen: false,
      isDataViewerModalOpen: false,
    }),

  // Combined actions
  selectStation: (stationId) =>
    set((state) => {
      // If clicking on the already selected station, deselect it
      if (state.selectedStation === stationId) {
        return {
          selectedStation: null,
          selectedTrainId: null,
          selectedTrainDetails: null,
        };
      }

      // Otherwise, select the station and clear train selection
      return {
        selectedStation: stationId,
        selectedTrainId: null,
        selectedTrainDetails: null,
      };
    }),

  selectTrain: (trainId, details) =>
    set((state) => {
      // If clicking on the already selected train, deselect it
      if (state.selectedTrainId === trainId) {
        return {
          selectedTrainId: null,
          selectedTrainDetails: null,
          selectedStation: null,
        };
      }

      // Otherwise, select the train and clear station selection
      return {
        selectedTrainId: trainId,
        selectedTrainDetails: details,
        selectedStation: null,
      };
    }),
}));
