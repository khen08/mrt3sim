import { create } from "zustand";

// Define types
export interface Station {
  name: string;
  distance: number;
  scheme?: "AB" | "A" | "B";
}

export interface SimulationSettings {
  dwellTime: number;
  turnaroundTime: number;
  acceleration: number;
  deceleration: number;
  cruisingSpeed: number;
  maxCapacity: number;
  schemeType: "REGULAR" | "SKIP-STOP";
  schemePattern: string[];
  stations: Station[];
}

interface SimulationSettingsState {
  // Settings
  settings: SimulationSettings | null;
  activeSettings: SimulationSettings | null;

  // Actions
  setSettings: (settings: SimulationSettings | null) => void;
  setActiveSettings: (settings: SimulationSettings | null) => void;
  updateSetting: <K extends keyof SimulationSettings>(
    key: K,
    value: SimulationSettings[K]
  ) => void;
  updateStationDistance: (index: number, distance: number) => void;
  updateStationScheme: (index: number, scheme: "AB" | "A" | "B") => void;
  toggleSkipStop: (enabled: boolean) => void;
  resetSettings: () => void;
}

// Create the store
export const useSimulationStore = create<SimulationSettingsState>((set) => ({
  // Initial state
  settings: null,
  activeSettings: null,

  // Actions
  setSettings: (settings) => set({ settings }),
  setActiveSettings: (settings) => set({ activeSettings: settings }),

  updateSetting: (key, value) =>
    set((state) => {
      if (!state.settings) return state;

      return {
        settings: {
          ...state.settings,
          [key]: value,
        },
      };
    }),

  updateStationDistance: (index, distance) =>
    set((state) => {
      if (!state.settings) return state;

      const updatedStations = [...state.settings.stations];
      updatedStations[index] = {
        ...updatedStations[index],
        distance,
      };

      return {
        settings: {
          ...state.settings,
          stations: updatedStations,
        },
      };
    }),

  updateStationScheme: (index, scheme) =>
    set((state) => {
      if (!state.settings) return state;

      const updatedStations = [...state.settings.stations];
      updatedStations[index] = {
        ...updatedStations[index],
        scheme,
      };

      // Update scheme pattern based on updated stations
      const updatedSchemePattern = updatedStations.map(
        (station) => station.scheme || "AB"
      );

      return {
        settings: {
          ...state.settings,
          stations: updatedStations,
          schemePattern: updatedSchemePattern,
        },
      };
    }),

  toggleSkipStop: (enabled) =>
    set((state) => {
      if (!state.settings) return state;

      const schemeType = enabled ? "SKIP-STOP" : "REGULAR";
      const schemePattern = enabled
        ? state.settings.stations.map((station) => station.scheme || "AB")
        : Array(state.settings.stations.length).fill("AB");

      return {
        settings: {
          ...state.settings,
          schemeType,
          schemePattern,
        },
      };
    }),

  resetSettings: () => set({ settings: null, activeSettings: null }),
}));
