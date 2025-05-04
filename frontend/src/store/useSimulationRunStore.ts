import { create } from "zustand";
import { PEAK_HOURS } from "@/lib/constants";

interface SimulationRunState {
  // Simulation status
  isRunning: boolean;
  isSimulating: boolean;
  isMapLoading: boolean;
  simulationTime: string;
  selectedScheme: "REGULAR" | "SKIP-STOP";
  selectedPeak: "AM" | "PM";
  isFullDayView: boolean;
  showDebugInfo: boolean;
  hasResults: boolean;
  mapRefreshKey: number;
  apiError: string | null;

  // Loaded simulation info
  loadedSimulationId: number | null;

  // Actions for controls
  startSimulation: () => void;
  pauseSimulation: () => void;
  setSimulationTime: (time: string) => void;
  setSimulationRunning: (isRunning: boolean) => void;
  setSelectedScheme: (scheme: "REGULAR" | "SKIP-STOP") => void;
  setSelectedPeak: (peak: "AM" | "PM") => void;
  toggleFullDayView: () => void;
  toggleDebugInfo: () => void;
  setSimulating: (isSimulating: boolean) => void;
  setMapLoading: (isLoading: boolean) => void;
  setHasResults: (hasResults: boolean) => void;
  incrementMapRefreshKey: () => void;
  setApiError: (error: string | null) => void;
  setLoadedSimulationId: (id: number | null) => void;

  // Reset
  resetRunState: () => void;
}

// Create the store
export const useSimulationRunStore = create<SimulationRunState>((set) => ({
  // Initial state
  isRunning: false,
  isSimulating: false,
  isMapLoading: false,
  simulationTime: PEAK_HOURS.AM.start,
  selectedScheme: "REGULAR",
  selectedPeak: "AM",
  isFullDayView: false,
  showDebugInfo: false,
  hasResults: false,
  mapRefreshKey: 0,
  apiError: null,
  loadedSimulationId: null,

  // Actions
  startSimulation: () => set({ isRunning: true }),
  pauseSimulation: () => set({ isRunning: false }),
  setSimulationTime: (time) => set({ simulationTime: time }),
  setSimulationRunning: (isRunning) => set({ isRunning }),
  setSelectedScheme: (scheme) => set({ selectedScheme: scheme }),
  setSelectedPeak: (peak) => set({ selectedPeak: peak }),
  toggleFullDayView: () =>
    set((state) => ({ isFullDayView: !state.isFullDayView })),
  toggleDebugInfo: () =>
    set((state) => ({ showDebugInfo: !state.showDebugInfo })),
  setSimulating: (isSimulating) => set({ isSimulating }),
  setMapLoading: (isLoading) => set({ isMapLoading: isLoading }),
  setHasResults: (hasResults) => set({ hasResults }),
  incrementMapRefreshKey: () =>
    set((state) => ({ mapRefreshKey: state.mapRefreshKey + 1 })),
  setApiError: (error) => set({ apiError: error }),
  setLoadedSimulationId: (id) => set({ loadedSimulationId: id }),

  // Reset function
  resetRunState: () =>
    set({
      isRunning: false,
      simulationTime: PEAK_HOURS.AM.start,
      apiError: null,
      hasResults: false,
    }),
}));
