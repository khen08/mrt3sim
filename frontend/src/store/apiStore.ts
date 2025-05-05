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

interface APIState {
  // API Operations
  fetchDefaultSettings: () => Promise<any | null>;
  fetchSimulationHistory: (fetchFullHistory?: boolean) => Promise<void>;
  runSimulation: () => Promise<void>;
  loadSimulation: (simulationId: number) => Promise<void>;
  fetchPassengerDemand: (simulationId: number | null) => Promise<void>;
  deleteSimulations: (
    simulationIds: number | number[]
  ) => Promise<{ success: boolean; message: string }>;
  fetchSimulationConfig: (
    simulationId: number
  ) => Promise<SimulationSettings | null>;
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
        ...historySimulations.map((sim) => sim.SIMULATION_ID)
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

  runSimulation: async () => {
    // Get current state from both stores
    const simState = useSimulationStore.getState();
    const {
      simulatePassengers,
      simulationInput,
      simulationSettings,
      nextRunFilename,
    } = simState;

    if (simulatePassengers && !simulationInput.filename && !nextRunFilename) {
      simState.setApiError(
        "Passenger simulation is enabled, but no CSV file has been uploaded."
      );
      toast({
        title: "Missing File",
        description: "Please upload a CSV file when simulating passengers.",
        variant: "destructive",
      });
      return;
    }
    if (!simulationSettings) {
      simState.setApiError("Simulation settings are missing or still loading.");
      toast({
        title: "Missing Settings",
        description: "Simulation settings not loaded.",
        variant: "destructive",
      });
      return;
    }

    simState.setIsSimulating(true);
    simState.setIsMapLoading(true);
    simState.setApiError(null);

    const stationNames = simulationSettings.stations.map(
      (station) => station.name
    );
    const stationDistances = simulationSettings.stations
      .map((station) => station.distance)
      .slice(1);

    const stationSchemes =
      simulationSettings.schemeType === "SKIP-STOP"
        ? simulationSettings.stations.map((station) => station.scheme || "AB")
        : [];

    const { stations, ...otherSettings } = simulationSettings;

    let payloadFilename: string | null = null;
    if (simulatePassengers) {
      if (
        simState.loadedSimulationId !== null &&
        simulationInput.filename === null &&
        nextRunFilename !== null
      ) {
        payloadFilename = nextRunFilename;
        console.log(
          `Using explicitly uploaded override file for loaded history run: ${payloadFilename}`
        );
      } else {
        payloadFilename = simulationInput.filename;
        console.log(
          `Using standard input filename for run: ${payloadFilename}`
        );
      }
    } else {
      console.log("Passenger simulation disabled, sending null filename.");
    }

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
          filename: payloadFilename,
          config: {
            ...otherSettings,
            stationNames: stationNames,
            stationDistances: stationDistances,
            schemePattern:
              simulationSettings.schemePattern ||
              (simulationSettings.schemeType === "SKIP-STOP"
                ? stationSchemes
                : Array(stationNames.length).fill("AB")),
            ...(simulationSettings.schemeType === "SKIP-STOP" && {
              stationSchemes: stationSchemes,
            }),
          },
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
        const settingsUsedForRun = simulationSettings; // Not null checked at start
        simState.setLoadedSimulationId(newSimulationId);
        simState.setActiveSimulationSettings(settingsUsedForRun);
        simState.setSimulationSettings(settingsUsedForRun);
        simState.setSimulationInput({
          filename: payloadFilename, // Reflect the file actually used
          config: settingsUsedForRun,
        });

        // *Only* set simulatePassengers based on the file used *if* it's different from current state
        // This prevents overriding the user's toggle if they ran without passengers intentionally
        if (simState.simulatePassengers !== !!payloadFilename) {
          simState.setSimulatePassengers(!!payloadFilename);
        }
        simState.setNextRunFilename(null); // Clear override filename

        console.log("Fetched Metadata (Run Sim):", fetchedMetadata);
        // Store the raw service periods array
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

        // Fetch updated simulation history
        await useAPIStore.getState().fetchSimulationHistory();

        // Fetch passenger demand after simulation run completes
        if (newSimulationId) {
          await useAPIStore.getState().fetchPassengerDemand(newSimulationId);
        }
      } else {
        // --- Handle failed timetable fetch after successful run ---
        console.error("Failed to fetch timetable data after all retries.");
        simState.setApiError(
          `Simulation run (ID: ${newSimulationId}) but failed to fetch timetable data.`
        );
        // Don't clear simulationResult here, might still want to see old map? Or maybe clear it? Let's clear it.
        simState.setSimulationResult(null);
        simState.setLoadedSimulationId(null); // Clear loaded ID as well
        toast({
          title: "Simulation Complete (Timetable Failed)",
          description: `The simulation (ID: ${newSimulationId}) ran but timetable data could not be retrieved after ${maxRetries} attempts.`,
          variant: "destructive",
        });
        // Still refresh history
        await useAPIStore.getState().fetchSimulationHistory();
      }
    } catch (error: any) {
      // --- Handle errors during simulation run or initial fetch ---
      console.error("Simulation API or Timetable Fetch Failed:", error);
      simState.setApiError(
        error.message || "An unknown error occurred during simulation."
      );
      // Clear results on error
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
    const { fetchSimulationConfig } = useAPIStore.getState(); // Get the new action

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
        (sim) => sim.SIMULATION_ID === simulationId
      );
      const filename = historyEntry?.PASSENGER_DATA_FILE ?? null;

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

      // Fetch the specific configuration for this simulation ID
      const loadedConfig = await fetchSimulationConfig(simulationId);

      // Check if config was fetched successfully
      if (loadedConfig && Array.isArray(timetableData.timetable)) {
        simState.setSimulationResult(timetableData.timetable);
        simState.setLoadedSimulationId(simulationId);

        // Use the loaded configuration instead of defaults
        simState.setSimulationSettings(loadedConfig); // Set the main settings
        simState.setActiveSimulationSettings(loadedConfig); // Set the active settings for the UI

        console.log("Fetched Timetable Data (Load Sim):", timetableData);
        console.log("Loaded Config Data (Load Sim):", loadedConfig);

        // Store the raw service periods array
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
          config: loadedConfig, // Use the loaded config here as well
        });

        simState.setSimulatePassengers(!!filename);
        simState.setNextRunFilename(null);

        toast({
          title: "Simulation Loaded",
          description: `Successfully loaded simulation ID ${simulationId}. Settings loaded from run. Passenger sim ${filename ? "enabled" : "disabled"}.`,
          variant: "default",
        });

        // Fetch passenger demand after simulation load completes
        await useAPIStore.getState().fetchPassengerDemand(simulationId);
      } else {
        // Handle cases where config fetch failed or timetable was invalid
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

      // --- Aggregate demand data for the chart --- //
      const hourlyTotals: Record<string, number> = {};
      if (Array.isArray(demandData)) {
        demandData.forEach((entry) => {
          const demandTime = entry["Demand Time"]; // HH:MM:SS
          if (demandTime && typeof demandTime === "string") {
            const hour = demandTime.substring(0, 2); // Extract HH
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
      // Optional: Show a toast, but might be noisy
      // toast({ title: "Passenger Demand Error", description: error.message, variant: "warning" });
    }
  },

  deleteSimulations: async (simulationIds: number | number[]) => {
    const { setApiError } = useSimulationStore.getState();
    const { fetchSimulationHistory } = get(); // Get other actions if needed
    setApiError(null);

    const isBulk = Array.isArray(simulationIds);
    const idsToDelete = isBulk ? simulationIds : [simulationIds];

    if (idsToDelete.length === 0) {
      return { success: false, message: "No simulation IDs provided." };
    }

    const endpoint = isBulk
      ? DELETE_BULK_SIMULATIONS_ENDPOINT
      : DELETE_SIMULATION_ENDPOINT(idsToDelete[0]); // Use single delete endpoint if not bulk
    const method = "DELETE";
    let body: string | undefined;

    // Only include body for bulk delete
    if (isBulk) {
      body = JSON.stringify({ simulationIds: idsToDelete }); // Match backend expected key
    }

    console.log(
      `Attempting to delete simulation(s): ${idsToDelete.join(", ")} via ${endpoint}`
    );

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          // Only add Content-Type if there's a body
          ...(body && { "Content-Type": "application/json" }),
        },
        ...(body && { body: body }), // Only add body if it exists
      });

      const result = await response.json().catch(() => null); // Attempt to parse JSON, default to null

      if (!response.ok) {
        const errorMessage =
          result?.error || `HTTP Error ${response.status}`;
        throw new Error(errorMessage);
      }

      console.log("Deletion successful:", result?.message);

      // Refresh history after successful deletion
      await fetchSimulationHistory(true); // Force full refresh

      // Return success status and message
      return { success: true, message: result?.message || "Deletion successful." };

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
    console.log(
      `Fetching configuration for simulation ID: ${simulationId}...`
    );

    try {
      const response = await fetch(GET_SIMULATION_CONFIG_ENDPOINT(simulationId));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP Error ${response.status}`
        );
      }

      const configData = await response.json();
      console.log(
        `Successfully fetched config for simulation ${simulationId}:`,
        configData
      );
      return configData; // Return the fetched config object

    } catch (error: any) {
      console.error(
        `Failed to fetch config for simulation ${simulationId}:`,
        error
      );
      setApiError(
        `Failed to fetch config for ${simulationId}: ${error.message || "Unknown error"}`
      );
      return null; // Return null on error
    }
  },
}));
