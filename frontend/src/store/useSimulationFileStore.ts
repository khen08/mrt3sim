import { create } from "zustand";

interface SimulationFileState {
  // File state
  simulationInputFilename: string | null;
  nextRunFilename: string | null;
  simulatePassengers: boolean;

  // Actions
  setSimulationInputFilename: (filename: string | null) => void;
  setNextRunFilename: (filename: string | null) => void;
  setSimulatePassengers: (enabled: boolean) => void;

  // Clear state
  resetFileState: () => void;
}

export const useSimulationFileStore = create<SimulationFileState>((set) => ({
  // Initial state
  simulationInputFilename: null,
  nextRunFilename: null,
  simulatePassengers: true,

  // Actions
  setSimulationInputFilename: (filename) =>
    set({ simulationInputFilename: filename }),
  setNextRunFilename: (filename) => set({ nextRunFilename: filename }),
  setSimulatePassengers: (enabled) => set({ simulatePassengers: enabled }),

  // Reset state
  resetFileState: () =>
    set({
      simulationInputFilename: null,
      nextRunFilename: null,
    }),
}));
