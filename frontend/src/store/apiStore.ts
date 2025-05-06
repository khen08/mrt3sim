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
} from "@/lib/constants";

// Assuming SimulationHistoryEntry is defined elsewhere or we use 'any'
type SimulationHistoryEntry = any; // Replace 'any' if type is defined

interface APIState {
  // API Operations
  fetchDefaultSettings: () => Promise<any | null>;
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
}

export const useAPIStore = create<APIState>((set: any, get: any) => ({
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
    const {
      setHistoryLoading,
      setHistorySimulations,
      addHistorySimulations,
      hasFetchedInitialHistory,
      setHasFetchedInitialHistory,
      historySimulations,
    } = useUIStore.getState();

    const { setApiError } = useSimulationStore.getState();

    if (fetchFullHistory) {
      setHistoryLoading(true);
    }
    setApiError(null);

    let url = GET_SIMULATION_HISTORY_ENDPOINT;
    let highestKnownId: number | null = null;

    if (!fetchFullHistory && historySimulations.length > 0) {
      // Find the highest ID only if not fetching full history and some history exists
      highestKnownId = Math.max(
        ...historySimulations.map(
          (sim: SimulationHistoryEntry) => sim.SIMULATION_ID
        )
      );
      url += `?since_id=${highestKnownId}`;
      console.log(`Fetching simulation history since ID: ${highestKnownId}...`);
    } else {
      console.log("Fetching full simulation history...");
      // If fetching full history, clear existing
      if (fetchFullHistory) {
        setHistorySimulations([]);
      }
      // Reset the flag if forcing a full history fetch
      setHasFetchedInitialHistory(false);
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
        setHistoryLoading(true);
      }

      // Add new simulations
      addHistorySimulations(data);
    } catch (error: any) {
      // Ensure loading is off even if there was an error
      setHistoryLoading(false);
      console.error("Failed to fetch history:", error);
      setApiError(`Failed to load simulation history: ${error.message}`);
      setHistorySimulations([]);
      toast({
        title: "Error Loading History",
        description: `Could not fetch simulation history: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  },

  // Public action called by the UI button
  runSimulation: async () => {
    const simState = useSimulationStore.getState();
    const {
      setIsLoading, // Added for consistency
      setApiError,
      setIsSimulating,
      setIsMapLoading,
      simulatePassengers,
      simulationInput,
      simulationSettings,
      nextRunFilename,
      setSimulationNameDialogOpen,
    } = simState;
    // Removed _executeRunSimulation import here, it will be called from the dialog

    // Perform initial checks first
    if (simulatePassengers && !simulationInput.filename && !nextRunFilename) {
      setApiError(
        "Passenger simulation is enabled, but no CSV file has been uploaded."
      );
      toast({
        title: "Missing File",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }
    if (!simulationSettings) {
      setApiError("Simulation settings are missing or still loading.");
      toast({
        title: "Missing Settings",
        description: "Settings not loaded.",
        variant: "destructive",
      });
      return;
    }

    // Clear any previous errors and set loading state if needed (dialog opens quickly)
    setApiError(null);
    // Might not need loading states here if dialog handles it

    // ALWAYS open the dialog to confirm/set the name
    console.log("Opening simulation name dialog...");
    setSimulationNameDialogOpen(true);

    // The actual API call (_executeRunSimulation) will be triggered
    // by the dialog's confirmation button.
  },

  // Internal helper function to execute the simulation API call
  _executeRunSimulation: async (filename, config, name) => {
    const simState = useSimulationStore.getState();

    simState.setIsSimulating(true);
    simState.setIsMapLoading(true);
    simState.setApiError(null);

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
        simState.setSimulationResult(timetableData);

        // --- Persist Settings & Update Input State ---
        simState.setLoadedSimulationId(newSimulationId);
        simState.setActiveSimulationSettings(config); // Use the config passed to this function
        simState.setSimulationSettings(config); // Keep main settings in sync
        simState.setSimulationInput({
          filename: filename, // Reflect the file actually used
          config: config,
        });
        simState.setSimulationName(name); // Set the name used for the run

        // *Only* set simulatePassengers based on the file used *if* it's different from current state
        if (simState.simulatePassengers !== !!filename) {
          simState.setSimulatePassengers(!!filename);
        }
        simState.setNextRunFilename(null); // Clear override filename

        console.log("Fetched Metadata (Run Sim):", fetchedMetadata);
        simState.setLoadedServicePeriodsData(
          fetchedMetadata.service_periods || null
        );

        // Reset UI state
        simState.setSimulationTime(simState.simulationTime);
        simState.setIsSimulationRunning(false);
        simState.incrementMapRefreshKey();
        useUIStore.getState().setSelectedStation(null);
        useUIStore.getState().setSelectedTrainId(null);
        useUIStore.getState().setSelectedTrainDetails(null);
        simState.setApiError(null);

        toast({
          title: `Simulation Completed (ID: ${newSimulationId}) ${
            runDuration !== undefined ? ` in ${runDuration.toFixed(2)}s` : ""
          }.`,
          description: `Timetable generated successfully (${timetableData.length} entries)`,
          variant: "default",
        });

        await useAPIStore.getState().fetchSimulationHistory();

        if (newSimulationId) {
          await useAPIStore.getState().fetchPassengerDemand(newSimulationId);
        }
      } else {
        console.error("Failed to fetch timetable data after all retries.");
        simState.setApiError(
          `Simulation run (ID: ${newSimulationId}) but failed to fetch timetable data.`
        );
        simState.setSimulationResult(null);
        simState.setLoadedSimulationId(null);
        toast({
          title: "Simulation Complete (Timetable Failed)",
          description: `The simulation (ID: ${newSimulationId}) ran but timetable data could not be retrieved.`,
          variant: "destructive",
        });
        await useAPIStore.getState().fetchSimulationHistory();
      }
    } catch (error: any) {
      console.error("Simulation API or Timetable Fetch Failed:", error);
      simState.setApiError(
        error.message || "An unknown error occurred during simulation."
      );
      simState.setSimulationResult(null);
      simState.setLoadedSimulationId(null);
      toast({
        title: "Simulation Error",
        description: `Simulation failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      simState.setIsSimulating(false);
      simState.setIsMapLoading(false);
    }
  },

  loadSimulation: async (simulationId: number) => {
    const simState = useSimulationStore.getState();
    const uiState = useUIStore.getState();
    const { fetchSimulationConfig } = useAPIStore.getState();

    uiState.setHistoryLoading(true);
    simState.setIsMapLoading(true);
    simState.setApiError(null);
    uiState.setHistoryModalOpen(false);

    toast({
      title: "Loading Simulation",
      description: `Fetching timetable for simulation ID ${simulationId}`,
      variant: "default",
    });

    try {
      const historyEntry = uiState.historySimulations.find(
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

      const loadedConfig = await fetchSimulationConfig(simulationId);

      if (loadedConfig && Array.isArray(timetableData.timetable)) {
        simState.setSimulationResult(timetableData.timetable);
        simState.setLoadedSimulationId(simulationId);
        simState.setSimulationName(simName);

        simState.setSimulationSettings(loadedConfig);
        simState.setActiveSimulationSettings(loadedConfig);

        console.log("Fetched Timetable Data (Load Sim):", timetableData);
        console.log("Loaded Config Data (Load Sim):", loadedConfig);

        simState.setLoadedServicePeriodsData(
          timetableData.service_periods || null
        );

        simState.setSimulationTime(PEAK_HOURS.AM.start);
        simState.setIsSimulationRunning(false);
        simState.incrementMapRefreshKey();
        uiState.setSelectedStation(null);
        uiState.setSelectedTrainId(null);
        uiState.setSelectedTrainDetails(null);
        simState.setApiError(null);
        simState.setSimulationInput({
          filename: filename,
          config: loadedConfig,
        });

        simState.setSimulatePassengers(!!filename);
        simState.setNextRunFilename(null);

        toast({
          title: "Simulation Loaded",
          description: `Successfully loaded simulation ID ${simulationId}. Settings loaded from run. Passenger sim ${
            filename ? "enabled" : "disabled"
          }.`,
          variant: "default",
        });

        await useAPIStore.getState().fetchPassengerDemand(simulationId);
      } else {
        const errorMsg = !loadedConfig
          ? "Failed to fetch specific simulation config."
          : "Timetable data structure was invalid after loading history.";
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Failed to load simulation:", error);
      simState.setApiError(
        `Failed to load simulation ${simulationId}: ${error.message}`
      );
      simState.setLoadedSimulationId(null);
      simState.setNextRunFilename(null);
      simState.setSimulationResult(null);
      toast({
        title: "Load Failed",
        description: `Could not load simulation ${simulationId}: ${error.message}`,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      uiState.setHistoryLoading(false);
      simState.setIsMapLoading(false);
    }
  },

  fetchPassengerDemand: async (simId: number | null) => {
    if (simId === null) {
      useSimulationStore.getState().setPassengerDistributionData(null);
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

      useSimulationStore
        .getState()
        .setPassengerDistributionData(distributionForChart);
      console.log(
        "Passenger demand distribution data processed:",
        distributionForChart
      );
    } catch (error: any) {
      console.error(
        `Failed to fetch or process passenger demand for sim ${simId}:`,
        error
      );
      useSimulationStore.getState().setPassengerDistributionData(null);
    }
  },

  deleteSimulations: async (simulationIds: number | number[]) => {
    const { setApiError } = useSimulationStore.getState();
    const { fetchSimulationHistory } = get();
    setApiError(null);

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

      await fetchSimulationHistory(true);

      return {
        success: true,
        message: result?.message || "Deletion successful.",
      };
    } catch (error: any) {
      console.error("Failed to delete simulations:", error);
      setApiError(
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
    const { setApiError } = useSimulationStore.getState();
    setApiError(null);
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
      setApiError(
        `Failed to fetch config for ${simulationId}: ${
          error.message || "Unknown error"
        }`
      );
      return null;
    }
  },
}));
