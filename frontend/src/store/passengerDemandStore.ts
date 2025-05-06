import { create } from "zustand";
import { useSimulationStore } from "./simulationStore";
import { useAPIStore } from "./apiStore";

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

interface PassengerDemandStoreState {
  heatmapData: HeatmapSeries[] | null;
  rawAggregatedData: AggregatedPeriodData | null;
  isLoadingHeatmap: boolean;
  heatmapError: string | null;
  selectedTimePeriod: TimePeriod;
  selectedSchemeType: SchemeType;
  stationNames: Record<string, string>; // Store station ID to name mapping

  actions: {
    fetchAggregatedPassengerDemand: (simulationId: number) => Promise<void>;
    setSelectedTimePeriod: (period: TimePeriod) => void;
    setSelectedSchemeType: (scheme: SchemeType) => void;
    setStationNames: (stations: { id: number; name: string }[]) => void;
    processHeatmapData: () => void; // Helper to transform raw data
    reset: () => void;
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
      fetchAggregatedPassengerDemand: async (simulationId: number) => {
        if (!simulationId) return;
        set({ isLoadingHeatmap: true, heatmapError: null });
        try {
          const data = await useAPIStore
            .getState()
            .fetchAggregatedPassengerDemandFromAPI(simulationId);
          if (data) {
            set({ rawAggregatedData: data, isLoadingHeatmap: false });
            get().actions.processHeatmapData();
          } else {
            throw new Error("No data returned from API");
          }
        } catch (error: any) {
          console.error("Failed to fetch aggregated passenger demand:", error);
          set({
            heatmapError: error.message || "Failed to load heatmap data",
            isLoadingHeatmap: false,
            rawAggregatedData: null,
            heatmapData: null,
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
          .filter((series) => series.data.length > 0); // Filter out origins with no data for this period/scheme

        set({ heatmapData: transformedData });
      },
      reset: () => {
        set(initialState);
      },
    },
  })
);

// Subscribe to simulationStore to fetch data when a new simulation is loaded
// or when station configuration changes (for names)
useSimulationStore.subscribe((state, prevState) => {
  const { loadedSimulationId, simulationSettings } = state;
  const { fetchAggregatedPassengerDemand, setStationNames, reset } =
    usePassengerDemandStore.getState().actions;

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
    fetchAggregatedPassengerDemand(loadedSimulationId);
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
});
