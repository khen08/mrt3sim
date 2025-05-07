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

// Define proper type for SimulationHistoryEntry
export interface SimulationHistoryEntry {
  SIMULATION_ID: number;
  NAME: string;
  CREATED_AT: string;
  START_TIME?: string;
  END_TIME?: string;
  CONFIG?: any;
  STATION_CAPACITIES?: any;
  SERVICE_PERIODS?: any;
  PERFORMANCE_METRICS?: any;
  PASSENGER_DATA_FILE?: string | null;
  [key: string]: any; // For any additional properties
}

interface APIState {
  // API Operations
  fetchDefaultSettings: () => Promise<SimulationSettings | null>;
  fetchSimulationHistory: (fetchFullHistory?: boolean) => Promise<void>;
  runSimulation: () => Promise<void>; // Public action to initiate run
  _executeRunSimulation: (
    filename: string | null,
    config: SimulationSettings,
    name: string
  ) => Promise<void>;
  loadSimulation: (simulationId: number) => Promise<void>;
  fetchPassengerDemand: (simulationId: number | null) => Promise<void>;
  deleteSimulations: (
    simulationIds: number | number[]
  ) => Promise<{ success: boolean; message: string }>;
  fetchSimulationConfig: (
    simulationId: number
  ) => Promise<SimulationSettings | null>;
  fetchAggregatedPassengerDemand: (simulationId: number) => Promise<any | null>;
  fetchSimulationMetrics: (simulationId: number) => Promise<void>;
}

export const useAPIStore = create<APIState>((set, get) => ({
  // API functions that directly update the simulation store
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
      // Find the highest ID only if not fetching full history and some history exists
      highestKnownId = Math.max(
        ...uiStore.historySimulations.map(
          (sim: SimulationHistoryEntry) => sim.SIMULATION_ID
        )
      );
      url += `?since_id=${highestKnownId}`;
      console.log(`Fetching simulation history since ID: ${highestKnownId}...`);
    } else {
      console.log("Fetching full simulation history...");
      // If fetching full history, clear existing
      if (fetchFullHistory) {
        uiStore.setHistorySimulations([]);
      }
      // Reset the flag if forcing a full history fetch
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

      // If it was an incremental fetch and new data arrived, briefly show loading
      if (!fetchFullHistory && data.length > 0) {
        uiStore.setHistoryLoading(true);
      }

      // Add new simulations
      uiStore.addHistorySimulations(data);
    } catch (error: any) {
      // Ensure loading is off even if there was an error
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

  // Public action called by the UI button
  runSimulation: async () => {
    const simStore = useSimulationStore.getState();

    // Perform initial checks first
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

    // Clear any previous errors and set loading state if needed (dialog opens quickly)
    simStore.setApiError(null);
    // Might not need loading states here if dialog handles it

    // ALWAYS open the dialog to confirm/set the name
    console.log("Opening simulation name dialog...");
    simStore.setSimulationNameDialogOpen(true);

    // The actual API call (_executeRunSimulation) will be triggered
    // by the dialog's confirmation button.
  },

  // Internal helper function to execute the simulation API call
  _executeRunSimulation: async (filename, config, name) => {
    const simStore = useSimulationStore.getState();

    simStore.setIsSimulating(true);
    simStore.setIsMapLoading(true);
    simStore.setApiError(null);

    toast({
      title: "Running Simulation",
      description: "Generating new timetable...",
      variant: "default",
    });

    try {
      const response = await fetch(RUN_SIMULATION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: filename, // Use passed filename
          name: name, // Use passed name
          config: config, // Use passed config
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

      let timetableData = null;
      let fetchedMetadata = null;
      const maxRetries = 5;
      const retryDelay = 1500;

      for (let i = 0; i < maxRetries; i++) {
        console.log(
          `Attempt ${i + 1} to fetch timetable for ID ${newSimulationId}...`
        );
        try {
          const timetableResponse = await fetch(
            GET_TIMETABLE_ENDPOINT(newSimulationId),
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            }
          );

          if (!timetableResponse.ok) {
            if (
              (timetableResponse.status === 404 ||
                timetableResponse.status >= 500) &&
              i < maxRetries - 1
            ) {
              console.log(
                `Timetable not ready (Status ${timetableResponse.status}), retrying...`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelay * (i + 1))
              );
              continue;
            }
            throw new Error(
              `Failed to fetch timetable: HTTP ${timetableResponse.status}`
            );
          }

          const fetchedResult = await timetableResponse.json();

          if (fetchedResult && Array.isArray(fetchedResult.timetable)) {
            timetableData = fetchedResult.timetable;
            fetchedMetadata = fetchedResult;
            console.log(`Timetable fetched successfully on attempt ${i + 1}.`);
            break;
          } else {
            if (i < maxRetries - 1) {
              console.log("Timetable data structure invalid, retrying...");
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelay * (i + 1))
              );
              continue;
            } else {
              throw new Error(
                "Timetable data has invalid structure after multiple retries."
              );
            }
          }
        } catch (fetchError: any) {
          console.error(
            `Error fetching timetable (attempt ${i + 1}):`,
            fetchError
          );
          if (i < maxRetries - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * (i + 1))
            );
          } else {
            throw fetchError;
          }
        }
      }

      if (Array.isArray(timetableData) && fetchedMetadata) {
        simStore.setSimulationResult(timetableData);

        // --- Persist Settings & Update Input State ---
        simStore.setLoadedSimulationId(newSimulationId);
        simStore.setActiveSimulationSettings(config); // Use the config passed to this function
        simStore.setSimulationSettings(config); // Keep main settings in sync
        simStore.setSimulationInput({
          filename: filename, // Reflect the file actually used
          config: config,
        });
        simStore.setSimulationName(name); // Set the name used for the run

        // *Only* set simulatePassengers based on the file used *if* it's different from current state
        if (simStore.simulatePassengers !== !!filename) {
          simStore.setSimulatePassengers(!!filename);
        }
        simStore.setNextRunFilename(null); // Clear override filename

        console.log("Fetched Metadata (Run Sim):", fetchedMetadata);
        simStore.setLoadedServicePeriodsData(
          fetchedMetadata.service_periods || null
        );

        // Reset UI state
        simStore.setSimulationTime(simStore.simulationTime);
        simStore.setIsSimulationRunning(false);
        simStore.incrementMapRefreshKey();

        const uiStore = useUIStore.getState();
        uiStore.setSelectedStation(null);
        uiStore.setSelectedTrainId(null);
        uiStore.setSelectedTrainDetails(null);
        simStore.setApiError(null);

        toast({
          title: `Simulation Completed (ID: ${newSimulationId}) ${
            runDuration !== undefined ? ` in ${runDuration.toFixed(2)}s` : ""
          }.`,
          description: `Timetable generated successfully (${timetableData.length} entries)`,
          variant: "default",
        });

        await get().fetchSimulationHistory();

        if (newSimulationId) {
          await get().fetchPassengerDemand(newSimulationId);
          await get().fetchAggregatedPassengerDemand(newSimulationId);
          await get().fetchSimulationMetrics(newSimulationId);
        }
      } else {
        console.error("Failed to fetch timetable data after all retries.");
        simStore.setApiError(
          `Simulation run (ID: ${newSimulationId}) but failed to fetch timetable data.`
        );
        simStore.setSimulationResult(null);
        simStore.setLoadedSimulationId(null);
        toast({
          title: "Simulation Complete (Timetable Failed)",
          description: `The simulation (ID: ${newSimulationId}) ran but timetable data could not be retrieved.`,
          variant: "destructive",
        });
        await get().fetchSimulationHistory();
      }
    } catch (error: any) {
      console.error("Simulation API or Timetable Fetch Failed:", error);
      const simStore = useSimulationStore.getState();
      simStore.setApiError(
        error.message || "An unknown error occurred during simulation."
      );
      simStore.setSimulationResult(null);
      simStore.setLoadedSimulationId(null);
      toast({
        title: "Simulation Error",
        description: `Simulation failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      const simStore = useSimulationStore.getState();
      simStore.setIsSimulating(false);
      simStore.setIsMapLoading(false);
    }
  },

  loadSimulation: async (simulationId: number) => {
    const simStore = useSimulationStore.getState();
    const uiStore = useUIStore.getState();
    const apiStore = get();

    uiStore.setHistoryLoading(true);
    simStore.setIsMapLoading(true);
    simStore.setApiError(null);
    uiStore.setHistoryModalOpen(false);

    toast({
      title: "Loading Simulation",
      description: `Fetching timetable for simulation ID ${simulationId}`,
      variant: "default",
    });

    try {
      const historyEntry = uiStore.historySimulations.find(
        (sim: SimulationHistoryEntry) => sim.SIMULATION_ID === simulationId
      );
      const filename = historyEntry?.PASSENGER_DATA_FILE ?? null;
      const simName = historyEntry?.NAME ?? "Unnamed Simulation";

      const timetableResponse = await fetch(
        GET_TIMETABLE_ENDPOINT(simulationId)
      );
      if (!timetableResponse.ok) {
        const errorData = await timetableResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Failed to fetch timetable: HTTP ${timetableResponse.status}`
        );
      }
      const timetableData = await timetableResponse.json();

      if (!timetableData || !Array.isArray(timetableData.timetable)) {
        throw new Error("Invalid timetable data received from server.");
      }

      const loadedConfig = await apiStore.fetchSimulationConfig(simulationId);

      if (loadedConfig && Array.isArray(timetableData.timetable)) {
        simStore.setSimulationResult(timetableData.timetable);
        simStore.setLoadedSimulationId(simulationId);
        simStore.setSimulationName(simName);

        simStore.setSimulationSettings(loadedConfig);
        simStore.setActiveSimulationSettings(loadedConfig);

        console.log("Fetched Timetable Data (Load Sim):", timetableData);
        console.log("Loaded Config Data (Load Sim):", loadedConfig);

        simStore.setLoadedServicePeriodsData(
          timetableData.service_periods || null
        );

        simStore.setSimulationTime(PEAK_HOURS.AM.start);
        simStore.setIsSimulationRunning(false);
        simStore.incrementMapRefreshKey();
        uiStore.setSelectedStation(null);
        uiStore.setSelectedTrainId(null);
        uiStore.setSelectedTrainDetails(null);
        simStore.setApiError(null);
        simStore.setSimulationInput({
          filename: filename,
          config: loadedConfig,
        });

        simStore.setSimulatePassengers(!!filename);
        simStore.setNextRunFilename(null);

        toast({
          title: "Simulation Loaded",
          description: `Successfully loaded simulation ID ${simulationId}. Settings loaded from run. Passenger sim ${
            filename ? "enabled" : "disabled"
          }.`,
          variant: "default",
        });

        await apiStore.fetchPassengerDemand(simulationId);
        await apiStore.fetchAggregatedPassengerDemand(simulationId);
        await apiStore.fetchSimulationMetrics(simulationId);
      } else {
        const errorMsg = !loadedConfig
          ? "Failed to fetch specific simulation config."
          : "Timetable data structure was invalid after loading history.";
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Failed to load simulation:", error);
      simStore.setApiError(
        `Failed to load simulation ${simulationId}: ${error.message}`
      );
      simStore.setLoadedSimulationId(null);
      simStore.setNextRunFilename(null);
      simStore.setSimulationResult(null);
      toast({
        title: "Load Failed",
        description: `Could not load simulation ${simulationId}: ${error.message}`,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      uiStore.setHistoryLoading(false);
      simStore.setIsMapLoading(false);
    }
  },

  fetchPassengerDemand: async (simId: number | null) => {
    if (simId === null) {
      const simStore = useSimulationStore.getState();
      simStore.setPassengerDistributionData(null);
      return;
    }

    console.log(
      `Fetching passenger demand data for simulation ID: ${simId}...`
    );
    try {
      const response = await fetch(GET_PASSENGER_DEMAND_ENDPOINT(simId));
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      const demandData = await response.json();

      const hourlyTotals: Record<string, number> = {};
      if (Array.isArray(demandData)) {
        demandData.forEach((entry) => {
          const demandTime = entry["Demand Time"];
          if (demandTime && typeof demandTime === "string") {
            const hour = demandTime.substring(0, 2);
            const passengers = entry.Passengers || 0;
            if (hour) {
              hourlyTotals[hour] = (hourlyTotals[hour] || 0) + passengers;
            }
          }
        });
      }

      const distributionForChart = Object.entries(hourlyTotals)
        .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      const simStore = useSimulationStore.getState();
      simStore.setPassengerDistributionData(distributionForChart);
      console.log(
        "Passenger demand distribution data processed:",
        distributionForChart
      );
    } catch (error: any) {
      console.error(
        `Failed to fetch or process passenger demand for sim ${simId}:`,
        error
      );
      const simStore = useSimulationStore.getState();
      simStore.setPassengerDistributionData(null);
    }
  },

  deleteSimulations: async (simulationIds: number | number[]) => {
    const simStore = useSimulationStore.getState();
    const apiStore = get();

    simStore.setApiError(null);

    const isBulk = Array.isArray(simulationIds);
    const idsToDelete = isBulk ? simulationIds : [simulationIds];

    if (idsToDelete.length === 0) {
      return { success: false, message: "No simulation IDs provided." };
    }

    const endpoint = isBulk
      ? DELETE_BULK_SIMULATIONS_ENDPOINT
      : DELETE_SIMULATION_ENDPOINT(idsToDelete[0]);
    const method = "DELETE";
    let body: string | undefined;

    if (isBulk) {
      body = JSON.stringify({ simulationIds: idsToDelete });
    }

    console.log(
      `Attempting to delete simulation(s): ${idsToDelete.join(
        ", "
      )} via ${endpoint}`
    );

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          ...(body && { "Content-Type": "application/json" }),
        },
        ...(body && { body: body }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage = result?.error || `HTTP Error ${response.status}`;
        throw new Error(errorMessage);
      }

      console.log("Deletion successful:", result?.message);

      await apiStore.fetchSimulationHistory(true);

      return {
        success: true,
        message: result?.message || "Deletion successful.",
      };
    } catch (error: any) {
      console.error("Failed to delete simulations:", error);
      simStore.setApiError(
        `Failed to delete simulations: ${error.message || "Unknown error"}`
      );
      return {
        success: false,
        message: error.message || "Could not delete simulations.",
      };
    }
  },

  fetchSimulationConfig: async (
    simulationId: number
  ): Promise<SimulationSettings | null> => {
    const simStore = useSimulationStore.getState();
    simStore.setApiError(null);
    console.log(`Fetching configuration for simulation ID: ${simulationId}...`);

    try {
      const response = await fetch(
        GET_SIMULATION_CONFIG_ENDPOINT(simulationId)
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error ${response.status}`);
      }

      const configData = await response.json();
      console.log(
        `Successfully fetched config for simulation ${simulationId}:`,
        configData
      );
      return configData;
    } catch (error: any) {
      console.error(
        `Failed to fetch config for simulation ${simulationId}:`,
        error
      );
      simStore.setApiError(
        `Failed to fetch config for ${simulationId}: ${
          error.message || "Unknown error"
        }`
      );
      return null;
    }
  },

  fetchAggregatedPassengerDemand: async (simulationId: number) => {
    const simStore = useSimulationStore.getState();

    console.log(
      `Fetching aggregated passenger demand for simulation ID: ${simulationId}...`
    );
    simStore.setIsAggregatedDemandLoading(true);
    simStore.setAggregatedPassengerDemand(null); // Clear previous data

    try {
      const response = await fetch(
        GET_AGGREGATED_PASSENGER_DEMAND_ENDPOINT(simulationId)
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `HTTP error ${response.status} on aggregated demand`
        );
      }
      const demandData = await response.json();
      simStore.setAggregatedPassengerDemand(demandData);
      console.log(
        "Aggregated passenger demand data fetched successfully:",
        demandData
      );

      // Return the data for use elsewhere
      return demandData;
    } catch (error: any) {
      console.error(
        `Failed to fetch or process aggregated passenger demand for sim ${simulationId}:`,
        error
      );
      simStore.setAggregatedPassengerDemand(null);
      toast({
        title: "Error Fetching Aggregated Demand",
        description: `Could not fetch aggregated demand: ${error.message}`,
        variant: "destructive",
      });

      // Return null in case of error
      return null;
    } finally {
      simStore.setIsAggregatedDemandLoading(false);
    }
  },

  fetchSimulationMetrics: async (simulationId: number) => {
    // Access modal store to update state
    const modalStore = useModalStore.getState();

    // Start loading
    modalStore.setIsLoading(true);
    modalStore.setError(null);
    console.log(
      `Fetching simulation metrics for simulation ID: ${simulationId}...`
    );

    try {
      const response = await fetch(
        GET_SIMULATION_METRICS_ENDPOINT(simulationId)
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `HTTP error ${response.status} fetching simulation metrics`
        );
      }

      const metricsData = await response.json();

      // Update the modal store with the new data
      modalStore.setRawData("metrics", metricsData);
      console.log("Simulation metrics data fetched successfully:", metricsData);

      return metricsData;
    } catch (error: any) {
      console.error(
        `Failed to fetch simulation metrics for sim ${simulationId}:`,
        error
      );

      // Set error in modal store
      modalStore.setError(`Failed to fetch metrics: ${error.message}`);

      toast({
        title: "Error Fetching Metrics",
        description: `Could not fetch simulation metrics: ${error.message}`,
        variant: "destructive",
      });

      return null;
    } finally {
      // End loading
      modalStore.setIsLoading(false);
    }
  },
}));
