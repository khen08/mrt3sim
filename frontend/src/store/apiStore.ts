import { create } from "zustand";
import { toast } from "@/components/ui/use-toast";
import { useSimulationStore, SimulationSettings } from "./simulationStore";
import { useUIStore } from "./uiStore";
import {
  GET_DEFAULT_SETTINGS_ENDPOINT,
  RUN_SIMULATION_ENDPOINT,
  GET_TIMETABLE_ENDPOINT,
  GET_SIMULATION_HISTORY_ENDPOINT,
  GET_PASSENGER_DEMAND_ENDPOINT,
  GET_SIMULATION_CONFIG_ENDPOINT,
  DELETE_SIMULATION_ENDPOINT,
  DELETE_BULK_SIMULATIONS_ENDPOINT,
  API_BASE_URL,
  PEAK_HOURS,
  GET_AGGREGATED_PASSENGER_DEMAND_ENDPOINT,
  GET_SIMULATION_METRICS_ENDPOINT,
} from "@/lib/constants";
import { useModalStore } from "@/store/modalStore";
import { useFileStore } from "@/store/fileStore";
import { useMetricsStore } from "./metricsStore";
import { usePassengerDemandStore } from "./passengerDemandStore";

// Define proper type for SimulationHistoryEntry
export interface SimulationHistoryEntry {
  SIMULATION_ID: number;
  NAME: string | null;
  CREATED_AT: string;
  START_TIME?: string | null;
  END_TIME?: string | null;
  CONFIG?: any;
  STATION_CAPACITIES?: any;
  SERVICE_PERIODS?: any;
  PERFORMANCE_METRICS?: any;
  PASSENGER_DATA_FILE?: string | null;
  [key: string]: any; // For any additional properties
}

interface APIState {
  fetchDefaultSettings: () => Promise<SimulationSettings | null>;
  fetchSimulationHistory: (fetchFullHistory?: boolean) => Promise<void>;
  runSimulation: () => Promise<void>;
  _executeRunSimulation: (
    filename: string | null,
    config: SimulationSettings,
    name: string
  ) => Promise<void>;
  loadSimulation: (simulationId: number) => Promise<void>;
  fetchTimetable: (simulationId: number) => Promise<void>;
  fetchPassengerDemand: (simulationId: number | null) => Promise<void>;
  deleteSimulations: (
    simulationIds: number | number[]
  ) => Promise<{ success: boolean; message: string }>;
  fetchSimulationConfig: (
    simulationId: number
  ) => Promise<SimulationSettings | null>;
  fetchAggregatedPassengerDemand: (simulationId: number) => Promise<any | null>;
  fetchSimulationMetrics: (simulationId: number) => Promise<void>;
  _isCreatingNewSimulation: boolean;
}

export const useAPIStore = create<APIState>((set, get) => ({
  fetchDefaultSettings: async () => {
    try {
      const response = await fetch(GET_DEFAULT_SETTINGS_ENDPOINT);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `HTTP error ${response.status}` }));
        throw new Error(
          `API Error (${response.status}): ${
            errorData?.error || response.statusText
          }`
        );
      }
      const defaults = await response.json();
      const defaultSchemePattern = defaults.schemePattern;
      const stationsWithScheme = defaults.stations.map(
        (station: any, index: number) => ({
          ...station,
          scheme: defaultSchemePattern[index] || "AB",
        })
      );

      const settings = {
        ...defaults,
        schemePattern: defaultSchemePattern,
        stations: stationsWithScheme,
      };

      return settings;
    } catch (error: any) {
      console.error("Failed to fetch default settings:", error);
      return null;
    }
  },

  fetchSimulationHistory: async (fetchFullHistory = false) => {
    const uiStore = useUIStore.getState();
    const simStore = useSimulationStore.getState();

    if (fetchFullHistory) {
      uiStore.setHistoryLoading(true);
    }
    simStore.setApiError(null);

    let url = GET_SIMULATION_HISTORY_ENDPOINT;
    let highestKnownId: number | null = null;

    if (!fetchFullHistory && uiStore.historySimulations.length > 0) {
      highestKnownId = Math.max(
        ...uiStore.historySimulations.map(
          (sim: SimulationHistoryEntry) => sim.SIMULATION_ID
        )
      );
      url += `?since_id=${highestKnownId}`;
      console.log(`Fetching simulation history since ID: ${highestKnownId}...`);
    } else {
      console.log("Fetching full simulation history...");
      if (fetchFullHistory) {
        uiStore.setHistorySimulations([]);
      }
      uiStore.setHasFetchedInitialHistory(false);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched history data:", data);

      if (!fetchFullHistory && data.length > 0) {
        uiStore.setHistoryLoading(true);
      }

      uiStore.addHistorySimulations(data);
    } catch (error: any) {
      uiStore.setHistoryLoading(false);
      console.error("Failed to fetch history:", error);
      simStore.setApiError(
        `Failed to load simulation history: ${error.message}`
      );
      uiStore.setHistorySimulations([]);
      toast({
        title: "Error Loading History",
        description: `Could not fetch simulation history: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      uiStore.setHistoryLoading(false);
    }
  },

  runSimulation: async () => {
    const simStore = useSimulationStore.getState();

    if (
      simStore.simulatePassengers &&
      !simStore.simulationInput.filename &&
      !simStore.nextRunFilename
    ) {
      simStore.setApiError(
        "Passenger simulation is enabled, but no CSV file has been uploaded."
      );
      toast({
        title: "Missing File",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }
    if (!simStore.simulationSettings) {
      simStore.setApiError("Simulation settings are missing or still loading.");
      toast({
        title: "Missing Settings",
        description: "Settings not loaded.",
        variant: "destructive",
      });
      return;
    }

    simStore.setApiError(null);
    console.log("Opening simulation name dialog...");
    set({ _isCreatingNewSimulation: true });
    simStore.setSimulationNameDialogOpen(true);
  },

  _executeRunSimulation: async (filename, config, name) => {
    const simStore = useSimulationStore.getState();
    const fileStore = useFileStore.getState();
    const metricsStore = useMetricsStore.getState();
    const passengerDemandStore = usePassengerDemandStore.getState();
    const modalStore = useModalStore.getState();
    const uiStore = useUIStore.getState();

    set({ _isCreatingNewSimulation: true });

    simStore.setIsSimulating(true);
    simStore.setIsMapLoading(true);
    simStore.setApiError(null);

    toast({
      title: "Running Simulation",
      description: "Creating a new simulation...",
      variant: "default",
    });

    try {
      const response = await fetch(RUN_SIMULATION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: filename,
          name: name,
          config: config,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `HTTP Error: ${response.status}` }));
        throw new Error(
          `API Error (${response.status}): ${
            errorData?.error || response.statusText
          }`
        );
      }

      const resultData = await response.json();
      const runDuration = resultData?.run_duration;
      const newSimulationId = resultData?.simulation_id;

      if (!newSimulationId) {
        throw new Error("API did not return a new simulation ID.");
      }

      // Tell modalStore to reset data for this new simulation
      modalStore.actions.setLastLoadedSimulationId(newSimulationId);

      console.log("Backend Simulation Result:", resultData);
      toast({
        title: "Simulation Complete",
        description: `New simulation created with ID: ${newSimulationId}`,
        variant: "default",
      });

      // --- Reset State Before Fetching New Data ---
      simStore.resetSimulation();
      fileStore.resetFileState();
      metricsStore.reset();
      passengerDemandStore.actions.reset();
      modalStore.actions.resetViewState();
      uiStore.resetState();

      // --- Set New Simulation Context ---
      simStore.setLoadedSimulationId(newSimulationId);
      simStore.setSimulationName(name || "Untitled Simulation");
      simStore.setActiveSimulationSettings(config);
      simStore.setNextRunFilename(null);

      // Set simulatePassengers checkbox based on whether a file was used
      simStore.setSimulatePassengers(!!filename);

      // Update simulation input with the file that was used
      if (filename) {
        simStore.setSimulationInput({ config, filename });
        // Update file store state to match
        useFileStore.setState({
          uploadedFileName: filename,
          uploadStatus: {
            success: true,
            message: "File used in simulation",
          },
          validationStatus: "valid",
          uploadSource: "settings-change",
        });

        fileStore.updateFileMetadata({
          isInherited: false,
          simulationId: newSimulationId,
          isRequired: false,
        });
      }

      // --- Fetch Data for New Simulation ---
      await get().fetchTimetable(newSimulationId);
      await get().fetchPassengerDemand(newSimulationId);
      await get().fetchSimulationMetrics(newSimulationId);
      await get().fetchSimulationHistory(); // Refresh history list
    } catch (error: any) {
      console.error("Simulation Run Error:", error);
      simStore.setApiError(`Simulation failed: ${error.message}`);
      toast({
        title: "Simulation Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      set({ _isCreatingNewSimulation: false });
      simStore.setIsSimulating(false);
      simStore.setIsMapLoading(false);
      simStore.setSimulationNameDialogOpen(false);
    }
  },

  loadSimulation: async (simulationId) => {
    set({ _isCreatingNewSimulation: false });

    const simStore = useSimulationStore.getState();
    const fileStore = useFileStore.getState();
    const metricsStore = useMetricsStore.getState();
    const passengerDemandStore = usePassengerDemandStore.getState();
    const modalStore = useModalStore.getState();
    const uiStore = useUIStore.getState();

    console.log(`Loading simulation ID: ${simulationId}`);

    // Set loading states immediately - no setTimeout which can be unreliable
    simStore.setIsLoading(true);
    simStore.setIsMapLoading(true);
    simStore.setIsSimulating(true);
    simStore.setApiError(null);

    // Tell modalStore we're loading a new simulation
    modalStore.actions.setLastLoadedSimulationId(simulationId);

    toast({
      title: "Loading Simulation",
      description: "Fetching existing simulation data...",
      variant: "default",
    });

    try {
      // Force a minimum loading time to ensure the loading UI is visible
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 1. Reset existing state
      simStore.resetSimulation();
      fileStore.resetFileState();
      metricsStore.reset();
      passengerDemandStore.actions.reset();
      modalStore.actions.resetViewState();
      uiStore.resetState();

      // Force loading states in case they were reset by resetSimulation
      simStore.setIsLoading(true);
      simStore.setIsMapLoading(true);
      simStore.setIsSimulating(true);

      // 2. Fetch config first
      toast({
        title: "Loading Configuration",
        description: "Fetching simulation settings from existing simulation...",
        variant: "default",
      });

      const config = await get().fetchSimulationConfig(simulationId);
      if (!config) {
        throw new Error("Failed to load simulation configuration.");
      }
      simStore.setSimulationSettings(config);
      simStore.setActiveSimulationSettings(config);

      const historyEntry = uiStore.historySimulations.find(
        (s) => s.SIMULATION_ID === simulationId
      );
      const simName = historyEntry?.NAME || "Loaded Simulation";
      const passengerFile = historyEntry?.PASSENGER_DATA_FILE;
      simStore.setSimulationName(simName);

      // Set loaded simulation ID
      simStore.setLoadedSimulationId(simulationId);

      // Clear any next run filename that might be set
      simStore.setNextRunFilename(null);

      // Set simulatePassengers checkbox based on whether passenger data exists
      const hasPassengerData = !!passengerFile;
      simStore.setSimulatePassengers(hasPassengerData);

      // Update simulation input filename and file store state
      simStore.setSimulationInput({ config, filename: passengerFile });

      if (passengerFile) {
        // Use set directly for fileStore as it doesn't have actions object
        useFileStore.setState({
          uploadedFileName: passengerFile,
          uploadedFileObject: null, // No actual file object when inherited
          uploadStatus: {
            success: true,
            message: "File loaded from simulation",
          },
          validationStatus: "valid", // Mark as valid since it was already used in a simulation
          uploadSource: "settings-change",
        });

        // Update file metadata
        fileStore.updateFileMetadata({
          isInherited: true,
          simulationId: simulationId,
          isRequired: false,
        });
      } else {
        // When no passenger file exists, ensure clear file state
        fileStore.resetFileState();
      }

      // 3. Fetch other data
      toast({
        title: "Loading Simulation Data",
        description: "Fetching timetable and data from existing simulation...",
        variant: "default",
      });

      await Promise.all([
        get().fetchTimetable(simulationId),
        get().fetchPassengerDemand(simulationId),
        get().fetchSimulationMetrics(simulationId),
      ]);

      toast({
        title: "Simulation Loaded",
        description: `Successfully loaded existing simulation: ${simName} (ID: ${simulationId})`,
        variant: "default",
      });

      uiStore.setHistoryModalOpen(false);

      // Add a small delay before clearing loading states
      // This allows the React rendering to complete
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (error: any) {
      console.error("Error loading simulation:", error);
      simStore.setApiError(`Failed to load simulation: ${error.message}`);
      toast({
        title: "Error Loading Simulation",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      // Always clear loading states when finished, regardless of success/failure
      // We delay resetting these flags significantly to allow time for UI rendering
      setTimeout(() => {
        simStore.setIsLoading(false);
        simStore.setIsMapLoading(false);
        simStore.setIsSimulating(false);
      }, 1500);
    }
  },

  fetchTimetable: async (simulationId) => {
    const simStore = useSimulationStore.getState();
    const modalStore = useModalStore.getState();

    // No separate loading state here, assuming loadSimulation/runSimulation handles it
    simStore.setApiError(null);

    try {
      const response = await fetch(GET_TIMETABLE_ENDPOINT(simulationId));
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error ${response.status} fetching timetable`
        );
      }
      const data = await response.json();

      if (data && data.timetable) {
        simStore.setSimulationResult(data.timetable);
        simStore.setLoadedServicePeriodsData(data.service_periods);
        modalStore.actions.setRawData("timetable", data.timetable); // Use actions
      } else {
        throw new Error("Invalid timetable data structure received.");
      }
    } catch (error: any) {
      console.error("Failed to fetch timetable:", error);
      simStore.setApiError(`Failed to fetch timetable: ${error.message}`);
      simStore.setSimulationResult(null);
      modalStore.actions.setError("Failed to load timetable data."); // Use actions
    } finally {
      // Loading state managed by caller (loadSimulation/_executeRunSimulation)
    }
  },

  fetchPassengerDemand: async (simulationId) => {
    if (!simulationId) return;
    const passengerDemandStore = usePassengerDemandStore.getState();
    const modalStore = useModalStore.getState();

    try {
      await passengerDemandStore.actions.fetchPassengerDemand(
        simulationId,
        true
      );
      modalStore.actions.setRawData(
        "passengerDemand",
        passengerDemandStore.passengerDemand
      ); // Use actions
    } catch (error: any) {
      console.error("Error triggering passenger demand fetch:", error);
      toast({
        title: "Error Fetching Passenger Demand",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      modalStore.actions.setError("Failed to load passenger demand data."); // Use actions
    }
  },

  deleteSimulations: async (simulationIds) => {
    const simStore = useSimulationStore.getState();
    const uiStore = useUIStore.getState();
    let url: string;
    let method = "DELETE";
    let body: any = null;

    if (Array.isArray(simulationIds)) {
      url = DELETE_BULK_SIMULATIONS_ENDPOINT;
      body = JSON.stringify({ simulationIds });
    } else {
      url = DELETE_SIMULATION_ENDPOINT(simulationIds);
    }

    simStore.setApiError(null);

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        ...(body && { body: body }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      console.log("Deletion successful:", result?.message);
      toast({
        title: "Deletion Successful",
        description: result?.message || "Selected simulations deleted.",
        variant: "default",
      });

      await get().fetchSimulationHistory(true); // Force refresh history

      return { success: true, message: result?.message };
    } catch (error: any) {
      console.error("Failed to delete simulation(s):", error);
      simStore.setApiError(`Failed to delete simulation(s): ${error.message}`);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete simulation(s).",
        variant: "destructive",
      });
      return { success: false, message: error.message };
    }
  },

  fetchSimulationConfig: async (simulationId) => {
    const simStore = useSimulationStore.getState();
    simStore.setApiError(null);

    try {
      const response = await fetch(
        GET_SIMULATION_CONFIG_ENDPOINT(simulationId)
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error ${response.status} fetching config`
        );
      }
      const configData = await response.json();
      // Add scheme to stations based on configData.schemePattern
      if (configData && configData.stations && configData.schemePattern) {
        const stationsWithScheme = configData.stations.map(
          (station: any, index: number) => ({
            ...station,
            scheme: configData.schemePattern[index] || "AB",
          })
        );
        configData.stations = stationsWithScheme;
      }
      return configData;
    } catch (error: any) {
      console.error("Failed to fetch simulation config:", error);
      simStore.setApiError(`Failed to fetch config: ${error.message}`);
      return null;
    }
  },

  fetchAggregatedPassengerDemand: async (simulationId) => {
    if (!simulationId) return null;
    const simStore = useSimulationStore.getState();
    // Get the passengerDemandStore setter directly
    const setPassengerDemandState = usePassengerDemandStore.setState;
    simStore.setApiError(null);

    // Set loading state specifically for this fetch in passengerDemandStore
    setPassengerDemandState({ isLoadingHeatmap: true, heatmapError: null });

    try {
      const response = await fetch(
        GET_AGGREGATED_PASSENGER_DEMAND_ENDPOINT(simulationId)
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `HTTP error ${response.status} fetching aggregated demand`
        );
      }
      const data = await response.json();
      // Update passengerDemandStore with the fetched data and clear loading/error
      setPassengerDemandState({
        rawAggregatedData: data,
        isLoadingHeatmap: false,
        heatmapError: null,
      });
      // Trigger processing in passengerDemandStore if needed (optional, depends on its logic)
      usePassengerDemandStore.getState().actions.processHeatmapData();
      return data;
    } catch (error: any) {
      console.error("Failed to fetch aggregated passenger demand:", error);
      simStore.setApiError(
        `Failed to fetch aggregated demand: ${error.message}`
      );
      // Update passengerDemandStore error state
      setPassengerDemandState({
        rawAggregatedData: null,
        isLoadingHeatmap: false,
        heatmapError: error.message || "Failed to load heatmap data",
      });
      return null;
    }
  },

  fetchSimulationMetrics: async (simulationId) => {
    if (!simulationId) return;
    const metricsStore = useMetricsStore.getState();
    const modalStore = useModalStore.getState();

    try {
      await metricsStore.fetchMetrics(simulationId, true);
      const rawData = metricsStore.rawMetricsData[simulationId] || [];
      modalStore.actions.setRawData("metrics", rawData); // Use actions
    } catch (error: any) {
      console.error("Error triggering metrics fetch:", error);
      toast({
        title: "Error Fetching Metrics",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      modalStore.actions.setError("Failed to load metrics data."); // Use actions
    }
  },

  _isCreatingNewSimulation: false,
}));
