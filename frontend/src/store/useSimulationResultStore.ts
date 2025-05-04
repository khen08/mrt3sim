import { create } from "zustand";

// Types for simulation results
export interface ServicePeriod {
  NAME: string;
  START_HOUR: number;
  TRAIN_COUNT?: number;
  REGULAR_HEADWAY: number;
  SKIP_STOP_HEADWAY: number;
  REGULAR_LOOP_TIME_MINUTES: number;
  SKIP_STOP_LOOP_TIME_MINUTES: number;
}

export interface PassengerDistributionData {
  hour: string;
  count: number;
}

// Define the movement entry type for the timetable
export interface TrainMovementEntry {
  MOVEMENT_ID?: number;
  SIMULATION_ID?: number;
  SCHEME_TYPE?: string;
  TRAIN_ID: number;
  TRAIN_SERVICE_TYPE?: string;
  STATION_ID: number;
  DIRECTION: "NORTHBOUND" | "SOUTHBOUND";
  TRAIN_STATUS: string;
  ARRIVAL_TIME: string | null;
  DEPARTURE_TIME: string | null;
  TRAVEL_TIME_SECONDS?: number;
  PASSENGERS_BOARDED?: number;
  PASSENGERS_ALIGHTED?: number;
  CURRENT_STATION_PASSENGER_COUNT?: number;
  CURRENT_PASSENGER_COUNT?: number;
}

// State interface for our store
interface SimulationResultState {
  // Simulation results data
  simulationResult: TrainMovementEntry[] | null;
  servicePeriodsData: ServicePeriod[] | null;
  passengerDistributionData: PassengerDistributionData[] | null;

  // Station and train selection
  selectedStation: number | null;
  selectedTrainId: number | null;
  selectedTrainDetails: any | null;

  // Actions
  setSimulationResult: (result: TrainMovementEntry[] | null) => void;
  setServicePeriodsData: (data: ServicePeriod[] | null) => void;
  setPassengerDistributionData: (
    data: PassengerDistributionData[] | null
  ) => void;
  setSelectedStation: (stationId: number | null) => void;
  setSelectedTrainId: (trainId: number | null) => void;
  setSelectedTrainDetails: (details: any | null) => void;
  resetSelection: () => void;
  resetAllResults: () => void;
}

// Create the Zustand store
export const useSimulationResultStore = create<SimulationResultState>(
  (set) => ({
    // Initial state
    simulationResult: null,
    servicePeriodsData: null,
    passengerDistributionData: null,
    selectedStation: null,
    selectedTrainId: null,
    selectedTrainDetails: null,

    // Actions
    setSimulationResult: (result) => set({ simulationResult: result }),
    setServicePeriodsData: (data) => set({ servicePeriodsData: data }),
    setPassengerDistributionData: (data) =>
      set({ passengerDistributionData: data }),
    setSelectedStation: (stationId) =>
      set((state) => ({
        selectedStation: state.selectedStation === stationId ? null : stationId,
        selectedTrainId: null,
        selectedTrainDetails: null,
      })),
    setSelectedTrainId: (trainId) =>
      set((state) => ({
        selectedTrainId: state.selectedTrainId === trainId ? null : trainId,
        selectedStation: null,
      })),
    setSelectedTrainDetails: (details) =>
      set({ selectedTrainDetails: details }),

    // Reset functions
    resetSelection: () =>
      set({
        selectedStation: null,
        selectedTrainId: null,
        selectedTrainDetails: null,
      }),
    resetAllResults: () =>
      set({
        simulationResult: null,
        servicePeriodsData: null,
        passengerDistributionData: null,
        selectedStation: null,
        selectedTrainId: null,
        selectedTrainDetails: null,
      }),
  })
);
