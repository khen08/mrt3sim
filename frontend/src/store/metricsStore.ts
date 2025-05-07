import { create } from "zustand";
import { GET_SIMULATION_METRICS_ENDPOINT } from "@/lib/constants";

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
  // Raw data
  rawMetricsData: MetricsData[];

  // Processed data for charts
  processedMetrics: ProcessedMetrics | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchMetrics: (simulationId: number) => Promise<void>;
  processMetricsForCharts: () => void;
  reset: () => void;
}

const initialState = {
  rawMetricsData: [],
  processedMetrics: null,
  isLoading: false,
  error: null,
};

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  ...initialState,

  fetchMetrics: async (simulationId: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        GET_SIMULATION_METRICS_ENDPOINT(simulationId)
      );

      if (!response.ok) {
        throw new Error(`Error fetching metrics: ${response.statusText}`);
      }

      const data = await response.json();
      set({ rawMetricsData: data, isLoading: false });

      // Process the data for charts
      get().processMetricsForCharts();
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
      set({
        error:
          err instanceof Error ? err.message : "Unknown error fetching metrics",
        isLoading: false,
      });
    }
  },

  processMetricsForCharts: () => {
    const { rawMetricsData } = get();

    if (!rawMetricsData.length) return;

    // Initialize processed metrics structure
    const processed: ProcessedMetrics = {
      basicMetrics: {},
      averageMetrics: {},
    };

    // Process data for each metric
    rawMetricsData.forEach((item) => {
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

    set({ processedMetrics: processed });
  },

  reset: () => set(initialState),
}));
