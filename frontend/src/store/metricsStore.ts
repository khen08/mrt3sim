import { create } from "zustand";
import { GET_SIMULATION_METRICS_ENDPOINT } from "@/lib/constants";
import { useSimulationStore } from "./simulationStore"; // To get loadedSimulationId

// Define types based on schema.prisma models
export type SchemeType = "REGULAR" | "SKIP-STOP";
export type TripType = "DIRECT" | "TRANSFER";

export interface MetricsData {
  metric: string;
  value: number | string;
  category: string;
  scheme: SchemeType;
}

export interface ProcessedMetrics {
  basicMetrics: {
    [key: string]: {
      REGULAR?: number;
      "SKIP-STOP"?: number;
    };
  };
  averageMetrics: {
    [key: string]: {
      REGULAR?: number;
      "SKIP-STOP"?: number;
    };
  };
}

interface MetricsStore {
  // Raw data, now keyed by simulationId
  rawMetricsData: Record<number, MetricsData[]>;

  // Processed data for charts, now keyed by simulationId
  processedMetrics: Record<number, ProcessedMetrics | null>;

  // UI state
  isLoading: boolean;
  error: string | null;
  lastFetchedMetrics: Record<number, number | null>; // Timestamp per simulationId

  // Actions
  fetchMetrics: (simulationId: number, forceRefresh?: boolean) => Promise<void>;
  processMetricsForCharts: (simulationId: number) => void;
  reset: () => void;
}

const initialState = {
  rawMetricsData: {},
  processedMetrics: {},
  isLoading: false,
  error: null,
  lastFetchedMetrics: {},
};

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  ...initialState,

  fetchMetrics: async (simulationId: number, forceRefresh = false) => {
    if (!simulationId) return;

    const now = Date.now();
    const lastFetchedTime = get().lastFetchedMetrics[simulationId];
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (
      !forceRefresh &&
      lastFetchedTime &&
      now - lastFetchedTime < CACHE_DURATION &&
      get().rawMetricsData[simulationId] // Check if data actually exists for this ID
    ) {
      console.log(`Using cached metrics for simulation ID: ${simulationId}`);
      // Ensure processed data is also available for this ID if raw data exists
      if (
        !get().processedMetrics[simulationId] &&
        get().rawMetricsData[simulationId]?.length > 0
      ) {
        get().processMetricsForCharts(simulationId);
      }
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        GET_SIMULATION_METRICS_ENDPOINT(simulationId)
      );

      if (!response.ok) {
        throw new Error(`Error fetching metrics: ${response.statusText}`);
      }

      const data = await response.json();
      set((state) => ({
        rawMetricsData: {
          ...state.rawMetricsData,
          [simulationId]: data,
        },
        isLoading: false,
        lastFetchedMetrics: {
          ...state.lastFetchedMetrics,
          [simulationId]: now,
        },
      }));

      // Process the data for charts for the specific simulationId
      get().processMetricsForCharts(simulationId);
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
      set({
        error:
          err instanceof Error ? err.message : "Unknown error fetching metrics",
        isLoading: false,
      });
    }
  },

  processMetricsForCharts: (simulationId: number) => {
    const { rawMetricsData } = get();
    const currentSimData = rawMetricsData[simulationId];

    if (!currentSimData || currentSimData.length === 0) {
      set((state) => ({
        processedMetrics: {
          ...state.processedMetrics,
          [simulationId]: null, // Set to null if no raw data for this ID
        },
      }));
      return;
    }

    // Initialize processed metrics structure
    const processed: ProcessedMetrics = {
      basicMetrics: {},
      averageMetrics: {},
    };

    // Process data for each metric
    currentSimData.forEach((item) => {
      const metricName = item.metric.replace(/ \((REGULAR|SKIP-STOP)\)$/, "");
      const scheme = item.scheme;

      if (item.category === "basic") {
        // Handle basic metrics
        if (!processed.basicMetrics[metricName]) {
          processed.basicMetrics[metricName] = {};
        }

        // Convert string values to numbers if needed
        let value = item.value;
        if (typeof value === "string" && value.includes("seconds")) {
          value = parseInt(value.replace(/,/g, "").split(" ")[0]);
        }

        processed.basicMetrics[metricName][scheme] =
          typeof value === "number" ? value : 0;
      } else if (item.category === "average") {
        // Handle average metrics
        if (!processed.averageMetrics[metricName]) {
          processed.averageMetrics[metricName] = {};
        }

        // Convert string values to numbers if needed
        let value = item.value;
        if (typeof value === "string" && value.includes("seconds")) {
          value = parseFloat(value.split(" ")[0]);
        }

        processed.averageMetrics[metricName][scheme] =
          typeof value === "number" ? value : 0;
      }
    });

    set((state) => ({
      processedMetrics: {
        ...state.processedMetrics,
        [simulationId]: processed,
      },
    }));
  },

  reset: () => set(initialState),
}));

// Add a selector to get processed metrics for the currently loaded simulation ID
export const useCurrentProcessedMetrics = () => {
  const loadedSimId = useSimulationStore((state) => state.loadedSimulationId);
  const allProcessedMetrics = useMetricsStore(
    (state) => state.processedMetrics
  );
  if (loadedSimId === null) return null;
  return allProcessedMetrics[loadedSimId] || null;
};

// Add a selector to get raw metrics for the currently loaded simulation ID
export const useCurrentRawMetrics = () => {
  const loadedSimId = useSimulationStore((state) => state.loadedSimulationId);
  const allRawMetrics = useMetricsStore((state) => state.rawMetricsData);
  if (loadedSimId === null) return null;
  return allRawMetrics[loadedSimId] || [];
};
