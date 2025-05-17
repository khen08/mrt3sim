import { create } from "zustand";
import { useSimulationStore } from "./simulationStore";
import { useAPIStore } from "./apiStore";
import { GET_PASSENGER_DEMAND_ENDPOINT } from "@/lib/constants";

// Types for heatmap data processing
export interface HeatmapDataPoint {
  x: string | number; // Destination Station ID
  y: number; // Demand Value
}

export interface HeatmapSeries {
  id: string; // Origin Station ID (or name)
  data: HeatmapDataPoint[];
}

// Types for raw aggregated data from backend
export interface AggregatedODPair {
  ROUTE: string; // "origin_id-destination_id"
  PASSENGER_COUNT: number;
}

export interface AggregatedSchemeData {
  REGULAR: AggregatedODPair[];
  "SKIP-STOP": AggregatedODPair[];
}

export interface AggregatedPeriodData {
  FULL_SERVICE: AggregatedSchemeData;
  AM_PEAK: AggregatedSchemeData;
  PM_PEAK: AggregatedSchemeData;
}

export type TimePeriod = keyof AggregatedPeriodData;
export type SchemeType = keyof AggregatedSchemeData;

export const AVAILABLE_TIME_PERIODS: TimePeriod[] = [
  "FULL_SERVICE",
  "AM_PEAK",
  "PM_PEAK",
];
export const AVAILABLE_SCHEME_TYPES: SchemeType[] = ["REGULAR", "SKIP-STOP"];

// Passenger demand data model (matching PASSENGER_DEMAND table)
export interface PassengerDemandEntry {
  SCHEME_TYPE: SchemeType;
  TRIP_TYPE: "DIRECT" | "TRANSFER";
  ORIGIN_STATION_ID: number;
  DESTINATION_STATION_ID: number;
  PASSENGER_COUNT: number;
  WAIT_TIME: number;
  TRAVEL_TIME: number;
  ARRIVAL_TIME_AT_ORIGIN: string;
}

// Raw passenger demand data from backend
export interface RawPassengerDemandEntry {
  Route: string;
  Passengers: number;
  "Demand Time": string;
  "Boarding Time": string;
  "Arrival Destination": string;
  "Wait Time (s)": number;
  "Travel Time (s)": number;
  "Trip Type": string;
  SchemeType: "REGULAR" | "SKIP-STOP";
}

interface PassengerDemandStoreState {
  // Original heatmap data
  heatmapData: HeatmapSeries[] | null;
  rawAggregatedData: AggregatedPeriodData | null;
  isLoadingHeatmap: boolean;
  heatmapError: string | null;
  selectedTimePeriod: TimePeriod;
  selectedSchemeType: SchemeType;
  stationNames: Record<string, string>; // Store station ID to name mapping

  // Passenger demand data for visualizations
  passengerDemand: PassengerDemandEntry[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null; // Timestamp for caching

  actions: {
    fetchPassengerDemand: (
      simulationId: number,
      forceRefresh?: boolean
    ) => Promise<void>;
    setSelectedTimePeriod: (period: TimePeriod) => void;
    setSelectedSchemeType: (scheme: SchemeType) => void;
    setStationNames: (stations: { id: number; name: string }[]) => void;
    processHeatmapData: () => void; // Helper to transform raw data
    reset: () => void;
    fetchSimulationMetrics: (simulationId: number) => Promise<void>;
  };
}

const initialState = {
  heatmapData: null,
  rawAggregatedData: null,
  isLoadingHeatmap: false,
  heatmapError: null,
  selectedTimePeriod: "FULL_SERVICE" as TimePeriod,
  selectedSchemeType: "REGULAR" as SchemeType,
  stationNames: {},

  // Initial state for passenger demand
  passengerDemand: [],
  isLoading: false,
  error: null,
  lastFetched: null,
};

export const usePassengerDemandStore = create<PassengerDemandStoreState>(
  (set, get) => ({
    ...initialState,
    actions: {
      setStationNames: (stations) => {
        const names = stations.reduce((acc, station) => {
          acc[String(station.id)] = station.name;
          return acc;
        }, {} as Record<string, string>);
        set({ stationNames: names });
      },
      fetchPassengerDemand: async (
        simulationId: number,
        forceRefresh = false
      ) => {
        if (!simulationId) {
          console.warn("fetchPassengerDemand called with no simulationId");
          return;
        }

        const now = Date.now();
        const lastFetched = get().lastFetched;

        // Cache for 5 minutes (300000 ms) unless force refresh
        if (lastFetched && now - lastFetched < 300000 && !forceRefresh) {
          console.log("Using cached passenger demand data");
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const response = await fetch(
            GET_PASSENGER_DEMAND_ENDPOINT(simulationId)
          );

          if (!response.ok) {
            throw new Error(
              `Error fetching passenger demand: ${response.statusText}`
            );
          }

          const rawData = await response.json();

          // Transform the raw data from backend format to the format expected by components
          const transformedData: PassengerDemandEntry[] = rawData.map(
            (item: RawPassengerDemandEntry) => {
              // Split the "Route" field to get origin and destination IDs
              const [originId, destId] = item.Route.split("-").map((id) =>
                parseInt(id, 10)
              );

              return {
                SCHEME_TYPE: item.SchemeType || "REGULAR",
                TRIP_TYPE: item["Trip Type"] as "DIRECT" | "TRANSFER",
                ORIGIN_STATION_ID: originId,
                DESTINATION_STATION_ID: destId,
                PASSENGER_COUNT: item.Passengers,
                WAIT_TIME: item["Wait Time (s)"],
                TRAVEL_TIME: item["Travel Time (s)"],
                ARRIVAL_TIME_AT_ORIGIN: item["Demand Time"],
              };
            }
          );

          set({
            passengerDemand: transformedData,
            isLoading: false,
            lastFetched: now,
          });

          // Compute hourly distribution and update simulation store
          const simStore = useSimulationStore.getState();
          console.log(
            "Computing hourly distribution from passenger demand data, entries:",
            transformedData.length
          );

          // Get the currently selected scheme from simulationStore
          const selectedScheme = simStore.selectedScheme; // "REGULAR" or "SKIP-STOP"
          console.log("Filtering distribution data by scheme:", selectedScheme);

          // Filter the data by the selected scheme
          const filteredData = transformedData.filter(
            (entry) => entry.SCHEME_TYPE === selectedScheme
          );
          console.log(
            "After filtering by scheme, entries:",
            filteredData.length
          );

          // Calculate hourly distribution from filtered data
          const hourlyMap: Record<string, number> = {};
          for (const entry of filteredData) {
            const hourLabel =
              entry.ARRIVAL_TIME_AT_ORIGIN.slice(0, 2).padStart(2, "0") + ":00";
            hourlyMap[hourLabel] =
              (hourlyMap[hourLabel] || 0) + entry.PASSENGER_COUNT;
          }
          const distribution = Object.entries(hourlyMap)
            .map(([hour, count]) => ({ hour, count }))
            .sort((a, b) => a.hour.localeCompare(b.hour));

          console.log(
            "Generated distribution data with",
            distribution.length,
            "hourly entries for scheme:",
            selectedScheme
          );

          // Set the distribution data in the simulation store
          simStore.setPassengerDistributionData(distribution);

          console.log(
            `Transformed ${rawData.length} passenger demand entries for visualization`
          );
        } catch (error: any) {
          console.error("Failed to fetch passenger demand:", error);
          set({
            error: error.message || "Failed to load passenger demand data",
            isLoading: false,
          });
        }
      },
      setSelectedTimePeriod: (period: TimePeriod) => {
        set({ selectedTimePeriod: period });
        get().actions.processHeatmapData();
      },
      setSelectedSchemeType: (scheme: SchemeType) => {
        set({ selectedSchemeType: scheme });
        get().actions.processHeatmapData();
      },
      processHeatmapData: () => {
        const {
          rawAggregatedData,
          selectedTimePeriod,
          selectedSchemeType,
          stationNames,
        } = get();

        if (!rawAggregatedData) {
          set({ heatmapData: null });
          return;
        }

        const periodData = rawAggregatedData[selectedTimePeriod];
        if (!periodData) {
          set({ heatmapData: null });
          return;
        }
        const schemeData = periodData[selectedSchemeType];
        if (!schemeData) {
          set({ heatmapData: null });
          return;
        }

        // Group by origin station
        const groupedByOrigin: Record<string, HeatmapDataPoint[]> = {};
        schemeData.forEach((item) => {
          const [originIdStr, destIdStr] = item.ROUTE.split("-");
          if (originIdStr && destIdStr) {
            if (!groupedByOrigin[originIdStr]) {
              groupedByOrigin[originIdStr] = [];
            }
            groupedByOrigin[originIdStr].push({
              x: destIdStr, // Destination ID
              y: item.PASSENGER_COUNT,
            });
          }
        });

        // Transform to Nivo HeatmapSeries format and sort
        const numStations = Object.keys(stationNames).length || 13; // Default to 13 if not set
        const sortedStationIds = Array.from({ length: numStations }, (_, i) =>
          String(i + 1)
        );

        const transformedData: HeatmapSeries[] = sortedStationIds
          .map((originId) => {
            const originDataPoints = groupedByOrigin[originId] || [];
            // Sort destination data points
            const sortedDataPoints = originDataPoints.sort((a, b) => {
              const xA = parseInt(String(a.x), 10);
              const xB = parseInt(String(b.x), 10);
              return xA - xB;
            });
            return {
              id: stationNames[originId] || `Station ${originId}`, // Use name for id (Y-axis label)
              data: sortedDataPoints.map((dp) => ({
                ...dp,
                // x will be used by Nivo to look up in its internal x-axis keys
                // We'll ensure the keys (destination labels) are sorted in the component
                x: stationNames[String(dp.x)] || `Station ${String(dp.x)}`,
              })),
            };
          })
          .filter((series) => series.data.length > 0); // Filter out origins with no data

        set({ heatmapData: transformedData });
      },
      reset: () => {
        set({
          heatmapData: null,
          rawAggregatedData: null,
          isLoadingHeatmap: false,
          heatmapError: null,
          passengerDemand: [],
          isLoading: false,
          error: null,
          lastFetched: null,
        });

        // Also reset the distribution data in the simulation store
        // This ensures consistency when passengerDemand is reset
        const simStore = useSimulationStore.getState();
        simStore.setPassengerDistributionData(null);
      },
      fetchSimulationMetrics: async (simulationId: number) => {
        // Implementation of fetchSimulationMetrics
      },
    },
  })
);

// Subscribe to simulationStore to fetch data when a new simulation is loaded
// or when station configuration changes (for names)
useSimulationStore.subscribe((state, prevState) => {
  const { loadedSimulationId, simulationSettings, selectedScheme } = state;
  const { fetchPassengerDemand, setStationNames, reset } =
    usePassengerDemandStore.getState().actions;

  // Handle simulation loading or station config changes
  if (
    loadedSimulationId &&
    loadedSimulationId !== prevState.loadedSimulationId
  ) {
    reset(); // Reset previous heatmap data
    if (simulationSettings?.stations) {
      // Assuming station IDs are their index + 1
      const stationNameMapping = simulationSettings.stations.map((s, i) => ({
        id: i + 1,
        name: s.name,
      }));
      setStationNames(stationNameMapping);
    }
    // Re-process heatmap data if raw data exists, as station names might have changed labels
    if (usePassengerDemandStore.getState().rawAggregatedData) {
      usePassengerDemandStore.getState().actions.processHeatmapData();
    }
  } else if (
    simulationSettings?.stations &&
    simulationSettings.stations !== prevState.simulationSettings?.stations
  ) {
    const stationNameMapping = simulationSettings.stations.map((s, i) => ({
      id: i + 1,
      name: s.name,
    }));
    setStationNames(stationNameMapping);
    // Re-process heatmap data if raw data exists, as station names might have changed labels
    if (usePassengerDemandStore.getState().rawAggregatedData) {
      usePassengerDemandStore.getState().actions.processHeatmapData();
    }
  }

  // Handle scheme change to update passenger distribution
  if (selectedScheme !== prevState.selectedScheme && loadedSimulationId) {
    console.log(
      "Scheme changed from",
      prevState.selectedScheme,
      "to",
      selectedScheme
    );
    console.log("Recalculating passenger distribution data for new scheme...");

    // Get the current passenger demand data
    const { passengerDemand } = usePassengerDemandStore.getState();

    if (passengerDemand && passengerDemand.length > 0) {
      // Filter by the new selected scheme
      const filteredData = passengerDemand.filter(
        (entry) => entry.SCHEME_TYPE === selectedScheme
      );
      console.log(
        "Filtered data for scheme",
        selectedScheme,
        ":",
        filteredData.length,
        "entries"
      );

      // Recalculate hourly distribution
      const simStore = useSimulationStore.getState();
      const hourlyMap: Record<string, number> = {};
      for (const entry of filteredData) {
        const hourLabel =
          entry.ARRIVAL_TIME_AT_ORIGIN.slice(0, 2).padStart(2, "0") + ":00";
        hourlyMap[hourLabel] =
          (hourlyMap[hourLabel] || 0) + entry.PASSENGER_COUNT;
      }

      const distribution = Object.entries(hourlyMap)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      console.log(
        "Generated new distribution data with",
        distribution.length,
        "hourly entries for scheme:",
        selectedScheme
      );

      // Update the distribution data in the simulation store
      simStore.setPassengerDistributionData(distribution);
    }
  }
});
