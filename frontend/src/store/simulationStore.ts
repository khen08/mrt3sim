import { create } from "zustand";
import { PEAK_HOURS } from "@/lib/constants";
import { parseTime, formatTime } from "@/lib/timeUtils";

// Define types for simulation settings
export interface StationConfig {
  name: string;
  distance: number;
  scheme?: "AB" | "A" | "B";
}

export interface SimulationSettings {
  dwellTime: number;
  turnaroundTime: number;
  trainSpecs: {
    acceleration: number;
    deceleration: number;
    cruisingSpeed: number;
    passthroughSpeed: number;
    maxCapacity: number;
  };
  servicePeriods: ServicePeriod[];
  schemeType: "REGULAR" | "SKIP-STOP";
  schemePattern: string[];
  stations: StationConfig[];
}

export interface SimulationInput {
  filename: string | null;
  config: SimulationSettings | null;
}

export interface ServicePeriod {
  NAME: string;
  START_HOUR: number;
  TRAIN_COUNT?: number;
  REGULAR_HEADWAY: number;
  SKIP_STOP_HEADWAY: number;
  REGULAR_LOOP_TIME_MINUTES: number;
  SKIP_STOP_LOOP_TIME_MINUTES: number;
}

// Define the simulation state
interface SimulationState {
  // Settings
  simulationSettings: SimulationSettings | null;
  activeSimulationSettings: SimulationSettings | null;
  simulationInput: SimulationInput;

  // Simulation Time
  simulationTime: string;
  isSimulationRunning: boolean;
  simulatePassengers: boolean;

  // Scheme
  selectedScheme: "REGULAR" | "SKIP-STOP";
  hasLoggedSchemeType: boolean;

  // Display Mode
  isFullDayView: boolean;
  selectedPeak: "AM" | "PM";

  // Debug
  showDebugInfo: boolean;

  // Results and data
  simulationResult: any[] | null;
  loadedServicePeriodsData: ServicePeriod[] | null;
  passengerArrivalData: Record<number, Record<number, number>> | null;
  passengerDistributionData: { hour: string; count: number }[] | null;

  // Run tracking
  nextRunFilename: string | null;
  loadedSimulationId: number | null;

  // Loading states
  isLoading: boolean;
  isSimulating: boolean;
  isMapLoading: boolean;
  apiError: string | null;

  // Map refresh (for key changes)
  mapRefreshKey: number;

  // Simulation Name
  simulationName: string;
  isSimulationNameDialogOpen: boolean;

  // Aggregated Passenger Demand
  aggregatedPassengerDemand: AggregatedDemandData | null;
  selectedTimePeriod: TimePeriodFilter;
  isAggregatedDemandLoading: boolean;

  // Actions
  setSimulationSettings: (settings: SimulationSettings | null) => void;
  setActiveSimulationSettings: (settings: SimulationSettings | null) => void;
  setSimulationInput: (input: Partial<SimulationInput>) => void;
  setSimulationTime: (time: string) => void;
  setIsSimulationRunning: (isRunning: boolean) => void;
  setSimulatePassengers: (simulate: boolean) => void;
  setSelectedScheme: (scheme: "REGULAR" | "SKIP-STOP") => void;
  setHasLoggedSchemeType: (hasLogged: boolean) => void;
  setIsFullDayView: (isFullDayView: boolean) => void;
  setSelectedPeak: (peak: "AM" | "PM") => void;
  setShowDebugInfo: (show: boolean) => void;
  setSimulationResult: (result: any[] | null) => void;
  setLoadedServicePeriodsData: (data: ServicePeriod[] | null) => void;
  setPassengerArrivalData: (
    data: Record<number, Record<number, number>> | null
  ) => void;
  setPassengerDistributionData: (
    data: { hour: string; count: number }[] | null
  ) => void;
  setNextRunFilename: (filename: string | null) => void;
  setLoadedSimulationId: (id: number | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsSimulating: (isSimulating: boolean) => void;
  setIsMapLoading: (isLoading: boolean) => void;
  setApiError: (error: string | null) => void;
  incrementMapRefreshKey: () => void;
  setSimulationName: (name: string) => void;
  setSimulationNameDialogOpen: (isOpen: boolean) => void;

  // Aggregated Passenger Demand Actions
  setAggregatedPassengerDemand: (data: AggregatedDemandData | null) => void;
  setSelectedTimePeriod: (period: TimePeriodFilter) => void;
  setIsAggregatedDemandLoading: (loading: boolean) => void;

  // Helper actions for settings
  updateSimulationSetting: (key: string, value: any) => void;
  updateStationDistance: (index: number, value: number) => void;
  updateStationScheme: (index: number, value: "AB" | "A" | "B") => void;
  toggleSkipStop: (checked: boolean) => void;

  // Clear actions
  resetSimulation: () => void;
}

// Define types for aggregated demand data
export type TimePeriodFilter = "FULL_SERVICE" | "AM_PEAK" | "PM_PEAK";
export type SchemeFilter = "REGULAR" | "SKIP-STOP";

export interface AggregatedDemandEntry {
  ROUTE: string; // e.g., "1-2"
  PASSENGER_COUNT: number;
}

export interface AggregatedDemandData {
  FULL_SERVICE?: {
    REGULAR?: AggregatedDemandEntry[];
    "SKIP-STOP"?: AggregatedDemandEntry[];
  };
  AM_PEAK?: {
    REGULAR?: AggregatedDemandEntry[];
    "SKIP-STOP"?: AggregatedDemandEntry[];
  };
  PM_PEAK?: {
    REGULAR?: AggregatedDemandEntry[];
    "SKIP-STOP"?: AggregatedDemandEntry[];
  };
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  // Initial state
  simulationSettings: null,
  activeSimulationSettings: null,
  simulationInput: { filename: null, config: null },
  simulationTime: PEAK_HOURS.AM.start,
  isSimulationRunning: false,
  simulatePassengers: true,
  selectedScheme: "REGULAR",
  hasLoggedSchemeType: false,
  isFullDayView: false,
  selectedPeak: "AM",
  showDebugInfo: false,
  simulationResult: null,
  loadedServicePeriodsData: null,
  passengerArrivalData: null,
  passengerDistributionData: null,
  nextRunFilename: null,
  loadedSimulationId: null,
  isLoading: false,
  isSimulating: false,
  isMapLoading: false,
  apiError: null,
  mapRefreshKey: 0,
  simulationName: "Untitled Simulation",
  isSimulationNameDialogOpen: false,

  // Aggregated Passenger Demand Initial State
  aggregatedPassengerDemand: null,
  selectedTimePeriod: "FULL_SERVICE",
  isAggregatedDemandLoading: false,

  // Basic setters
  setSimulationSettings: (settings) => set({ simulationSettings: settings }),
  setActiveSimulationSettings: (settings) =>
    set({ activeSimulationSettings: settings }),
  setSimulationInput: (input) =>
    set((state) => ({
      simulationInput: { ...state.simulationInput, ...input },
    })),
  setSimulationTime: (time) => set({ simulationTime: time }),
  setIsSimulationRunning: (isRunning) =>
    set({ isSimulationRunning: isRunning }),
  setSimulatePassengers: (simulate) => set({ simulatePassengers: simulate }),
  setSelectedScheme: (scheme) => set({ selectedScheme: scheme }),
  setHasLoggedSchemeType: (hasLogged) =>
    set({ hasLoggedSchemeType: hasLogged }),
  setIsFullDayView: (isFullDayView) => set({ isFullDayView }),
  setSelectedPeak: (peak) => set({ selectedPeak: peak }),
  setShowDebugInfo: (show) => set({ showDebugInfo: show }),
  setSimulationResult: (result) => {
    set((state) => {
      // Check if we should set hasLoggedSchemeType when setting the result
      const shouldSetLogged =
        result && result.length > 0 && !state.hasLoggedSchemeType;

      return {
        simulationResult: result,
        // Optionally update hasLoggedSchemeType in the same operation
        ...(shouldSetLogged ? { hasLoggedSchemeType: true } : {}),
      };
    });
  },
  setLoadedServicePeriodsData: (data) =>
    set({ loadedServicePeriodsData: data }),
  setPassengerArrivalData: (data) => set({ passengerArrivalData: data }),
  setPassengerDistributionData: (data) =>
    set({ passengerDistributionData: data }),
  setNextRunFilename: (filename) => set({ nextRunFilename: filename }),
  setLoadedSimulationId: (id) => set({ loadedSimulationId: id }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsSimulating: (isSimulating) => set({ isSimulating }),
  setIsMapLoading: (isLoading) => set({ isMapLoading: isLoading }),
  setApiError: (error) => set({ apiError: error }),
  incrementMapRefreshKey: () =>
    set((state) => ({ mapRefreshKey: state.mapRefreshKey + 1 })),
  setSimulationName: (name) =>
    set({ simulationName: name || "Untitled Simulation" }),
  setSimulationNameDialogOpen: (isOpen) =>
    set({ isSimulationNameDialogOpen: isOpen }),

  // Aggregated Passenger Demand Setters
  setAggregatedPassengerDemand: (data) =>
    set({ aggregatedPassengerDemand: data }),
  setSelectedTimePeriod: (period) => set({ selectedTimePeriod: period }),
  setIsAggregatedDemandLoading: (loading) =>
    set({ isAggregatedDemandLoading: loading }),

  // Complex actions
  updateSimulationSetting: (key, value) =>
    set((state) => {
      if (!state.simulationSettings) return { simulationSettings: null };

      const updatedSettings = {
        ...state.simulationSettings,
        [key]: value,
      };

      return {
        simulationSettings: updatedSettings,
        simulationInput: {
          ...state.simulationInput,
          config: updatedSettings,
        },
      };
    }),

  updateStationDistance: (index, value) =>
    set((state) => {
      if (!state.simulationSettings) return { simulationSettings: null };

      const updatedStations = state.simulationSettings.stations.map(
        (station, i) => {
          if (i === index) {
            return { ...station, distance: value };
          }
          return station;
        }
      );

      const updatedSettings = {
        ...state.simulationSettings,
        stations: updatedStations,
      };

      return {
        simulationSettings: updatedSettings,
        simulationInput: {
          ...state.simulationInput,
          config: updatedSettings,
        },
      };
    }),

  updateStationScheme: (index, value) =>
    set((state) => {
      if (!state.simulationSettings) return { simulationSettings: null };

      const updatedStations = state.simulationSettings.stations.map(
        (station, i) => {
          if (i === index) {
            return { ...station, scheme: value };
          }
          return station;
        }
      );

      const updatedSchemePattern = updatedStations.map(
        (station) => station.scheme || "AB"
      );

      const updatedSettings = {
        ...state.simulationSettings,
        stations: updatedStations,
        schemePattern: updatedSchemePattern,
      };

      return {
        simulationSettings: updatedSettings,
        simulationInput: {
          ...state.simulationInput,
          config: updatedSettings,
        },
      };
    }),

  toggleSkipStop: (checked) =>
    set((state) => {
      if (!state.simulationSettings) return { simulationSettings: null };

      const regularPattern = Array(
        state.simulationSettings.stations.length
      ).fill("AB");

      const updatedSettings = {
        ...state.simulationSettings,
        schemeType: checked ? ("SKIP-STOP" as const) : ("REGULAR" as const),
        schemePattern: checked
          ? state.simulationSettings.stations.map(
              (station) => station.scheme || "AB"
            )
          : regularPattern,
      };

      return {
        simulationSettings: updatedSettings,
        simulationInput: {
          ...state.simulationInput,
          config: updatedSettings,
        },
      };
    }),

  resetSimulation: () => {
    set({
      simulationResult: null,
      loadedServicePeriodsData: null,
      passengerArrivalData: null,
      passengerDistributionData: null,
      aggregatedPassengerDemand: null,
      loadedSimulationId: null,
      simulationInput: { filename: null, config: null },
      nextRunFilename: null,
      isSimulationRunning: false,
      isLoading: false,
      isSimulating: false,
      isMapLoading: false,
      apiError: null,
      // Don't reset simulatePassengers checkbox state during reset
      // This will be explicitly set based on whether passenger data exists
    });
  },
}));
