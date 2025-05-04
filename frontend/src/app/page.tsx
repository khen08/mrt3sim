"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  useMemo,
} from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconUpload,
  IconSettings,
  IconPlayerPlay,
  IconLoader2,
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconReplace,
  IconTrain,
  IconHistory,
  IconInfoCircle,
} from "@tabler/icons-react";
import CsvUpload from "@/components/CsvUpload";
import MrtMap, { MrtMapHandle } from "@/components/MrtMap";
import SimulationController from "@/components/SimulationController";
import StationInfo from "@/components/StationInfo";
import TrainInfo from "@/components/TrainInfo";
import { parseTime, formatTime } from "@/lib/timeUtils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import SimulationHistoryModal from "@/components/SimulationHistoryModal";
import SimulationSettingsCard from "@/components/SimulationSettingsCard";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";
import {
  PEAK_HOURS,
  FULL_DAY_HOURS,
  type PeakPeriod,
  GET_DEFAULT_SETTINGS_ENDPOINT,
  RUN_SIMULATION_ENDPOINT,
  GET_TIMETABLE_ENDPOINT,
  GET_SIMULATION_HISTORY_ENDPOINT,
  API_BASE_URL,
} from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSimulationStore } from "@/store/useSimulationStore";
import { useSimulationRunStore } from "@/store/useSimulationRunStore";
import { useSimulationResultStore } from "@/store/useSimulationResultStore";
import { useSimulationFileStore } from "@/store/useSimulationFileStore";

interface PassengerDistribution {
  hour: string;
  count: number;
}

interface RawPassengerData {
  currentBoarding: number;
  currentAlighting: number;
  nextBoarding: number;
  nextAlighting: number;
  progress: number;
}

type PassengerArrivalData = Record<number, Record<number, number>>;

interface SimulationSettings {
  dwellTime: number;
  turnaroundTime: number;
  acceleration: number;
  deceleration: number;
  cruisingSpeed: number;
  maxCapacity: number;
  schemeType: "REGULAR" | "SKIP-STOP";
  schemePattern: string[];
  stations: {
    name: string;
    distance: number;
    scheme?: "AB" | "A" | "B";
  }[];
}

interface SimulationInput {
  filename: string | null;
  config: SimulationSettings | null;
}

interface TrainInfoData {
  id: number;
  direction: "NORTHBOUND" | "SOUTHBOUND";
  status: string;
  load: number;
  capacity: number;
  relevantStationName: string | null;
  scheduledTime: string | null;
}

interface SimulationHistoryEntry {
  SIMULATION_ID: number;
  CREATED_AT: string;
  PASSENGER_DATA_FILE: string;
  START_TIME: string;
  END_TIME: string;
  TOTAL_RUN_TIME_SECONDS: number;
}

// Define the interface matching MrtMap.tsx
interface ServicePeriod {
  NAME: string;
  START_HOUR: number;
  TRAIN_COUNT?: number;
  REGULAR_HEADWAY: number;
  SKIP_STOP_HEADWAY: number;
  REGULAR_LOOP_TIME_MINUTES: number;
  SKIP_STOP_LOOP_TIME_MINUTES: number;
}

// Define structure for aggregated passenger demand data for the chart
interface PassengerDistributionData {
  hour: string; // e.g., "07:00"
  count: number;
}

// Define props for the new LoadingPlaceholder component
interface LoadingPlaceholderProps {
  message?: string;
}

// Define the LoadingPlaceholder component structure (implementation later)
const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
  message = "Loading...",
}) => {
  return (
    <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-4 space-y-4">
      <IconLoader2 className="h-12 w-12 animate-spin text-mrt-blue" />
      <p className="text-lg font-medium">{message}</p>
    </div>
  );
};

export default function Home() {
  // Use Zustand stores
  const {
    settings: simulationSettings,
    activeSettings: activeSimulationSettings,
    setSettings,
    setActiveSettings,
  } = useSimulationStore();

  const {
    isMapLoading,
    isSimulating,
    apiError,
    hasResults,
    loadedSimulationId,
    isFullDayView,
    setSimulating,
    setMapLoading,
    setHasResults,
    setApiError,
    setLoadedSimulationId,
    incrementMapRefreshKey,
    mapRefreshKey,
  } = useSimulationRunStore();

  const {
    simulationResult,
    servicePeriodsData,
    passengerDistributionData,
    setSimulationResult,
    setServicePeriodsData,
    setPassengerDistributionData,
    resetAllResults,
  } = useSimulationResultStore();

  const {
    simulationInputFilename,
    nextRunFilename,
    simulatePassengers,
    setSimulationInputFilename,
    setNextRunFilename,
    setSimulatePassengers,
  } = useSimulationFileStore();

  // Local state for the page
  const [uploadedFileObject, setUploadedFileObject] = useState<File | null>(
    null
  );
  const [passengerArrivalData, setPassengerArrivalData] =
    useState<PassengerArrivalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedInitialHistory, setHasFetchedInitialHistory] =
    useState(false);
  const { toast } = useToast();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historySimulations, setHistorySimulations] = useState<
    SimulationHistoryEntry[]
  >([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // For simulation data
  const [loadedServicePeriodsData, setLoadedServicePeriodsData] = useState<
    ServicePeriod[] | null
  >(null);
  const [loadedPassengerDistributionData, setLoadedPassengerDistributionData] =
    useState<PassengerDistributionData[] | null>(null);

  // Refs
  const mrtMapRef = useRef<MrtMapHandle | null>(null);

  // Clear confirm modal
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Maintain stationData for StationInfo component
  const [stationData, setStationData] = useState<any>({});

  // Create a stations by ID lookup object
  const stationsById = useMemo(() => {
    const stationsMap: Record<
      number,
      { id: number; name: string; distance: number }
    > = {};
    if (simulationSettings?.stations) {
      simulationSettings.stations.forEach((station, index) => {
        stationsMap[index + 1] = {
          id: index + 1,
          name: station.name,
          distance: station.distance,
        };
      });
    }
    return stationsMap;
  }, [simulationSettings?.stations]);

  // Simulation settings functions
  const fetchDefaultSettings = async (): Promise<SimulationSettings | null> => {
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
      const defaultSchemePattern = Array(defaults.stations.length).fill("AB");

      // Add scheme info to each station
      const stationsWithScheme = defaults.stations.map((station: any) => ({
        ...station,
        scheme: "AB", // Default scheme
      }));

      const settings: SimulationSettings = {
        dwellTime: defaults.dwellTime || 30,
        turnaroundTime: defaults.turnaroundTime || 240,
        acceleration: defaults.acceleration || 0.9,
        deceleration: defaults.deceleration || 0.9,
        cruisingSpeed: defaults.cruisingSpeed || 60,
        maxCapacity: defaults.maxCapacity || 1500,
        schemeType: "REGULAR",
        schemePattern: defaultSchemePattern,
        stations: stationsWithScheme,
      };

      return settings;
    } catch (error: any) {
      console.error("Error fetching default settings:", error);
      toast({
        title: "Error",
        description: `Failed to fetch default settings: ${error.message}`,
        variant: "destructive",
      });
      return null;
    }
  };

  // Initialize the app
  useEffect(() => {
    const loadInitialData = async () => {
      // Set global loading state
      setIsLoading(true);

      try {
        // Fetch default settings
        const defaultSettings = await fetchDefaultSettings();
        if (defaultSettings) {
          // Update Zustand store
          setSettings(defaultSettings);
          setActiveSettings(defaultSettings);
        }
      } catch (error) {
        console.error("Error in initial data loading:", error);
      } finally {
        // Clear loading state
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [setSettings, setActiveSettings, toast]);

  // File handling functions
  const handleFileSelect = (
    file: File | null,
    backendFilename: string | null
  ) => {
    if (file && backendFilename) {
      console.log(
        `handleFileSelect called with file: ${file.name}, backend: ${backendFilename}`
      );
      setUploadedFileObject(file);
      setNextRunFilename(backendFilename);
    } else {
      console.log(
        "handleFileSelect called but file or backendFilename is null"
      );
      setUploadedFileObject(null);
      setNextRunFilename(null);
    }
  };

  // Clear/load new data function
  const handleLoadNewData = () => {
    // Check if we're in the middle of a simulation
    if (isSimulating || isMapLoading) {
      toast({
        title: "Operation in Progress",
        description: "Please wait until the current operation completes.",
        variant: "default",
      });
      return;
    }

    // Ask for confirmation if there's simulation data
    if (hasResults) {
      setIsClearConfirmOpen(true);
    } else {
      clearCurrentSimulation();
    }
  };

  // Clear the current simulation
  const clearCurrentSimulation = () => {
    setIsClearConfirmOpen(false);

    // Clear Zustand stores
    resetAllResults();
    setHasResults(false);
    setMapLoading(false);
    setApiError(null);
    setLoadedSimulationId(null);

    // Increment map refresh key to force re-render
    incrementMapRefreshKey();

    // Show success toast
    toast({
      title: "Cleared",
      description: "Current simulation data has been cleared.",
      variant: "default",
    });
  };

  // Run simulation
  const handleRunSimulation = async () => {
    // Check if a history modal is open, if so, close it
    if (isHistoryModalOpen) {
      setIsHistoryModalOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 200)); // Brief delay
    }

    setSimulating(true);
    setMapLoading(true); // Start loading map area
    setApiError(null);

    // Get settings from Zustand store
    const currentSettings = useSimulationStore.getState().settings;

    if (!currentSettings) {
      toast({
        title: "Error",
        description: "Settings are missing.",
        variant: "destructive",
      });
      setSimulating(false);
      return;
    }

    const stationNames = currentSettings.stations.map(
      (station) => station.name
    );
    const stationDistances = currentSettings.stations.map(
      (station) => station.distance
    );

    try {
      // Build payload
      const payload = {
        dwellTime: currentSettings.dwellTime,
        turnaroundTime: currentSettings.turnaroundTime,
        acceleration: currentSettings.acceleration,
        deceleration: currentSettings.deceleration,
        cruisingSpeed: currentSettings.cruisingSpeed,
        maxCapacity: currentSettings.maxCapacity,
        schemeType: currentSettings.schemeType,
        schemePattern: currentSettings.schemePattern,
        stationNames: stationNames,
        stationDistances: stationDistances,
        filename: nextRunFilename || simulationInputFilename, // Use next run filename or the current one
        simulatePassengers: simulatePassengers, // Now comes from useSimulationFileStore
      };

      console.log("Simulation payload:", payload);

      // Show progress toast
      toast({
        title: "Running Simulation",
        description: "Processing your request. Please wait...",
        variant: "default",
      });

      const response = await fetch(RUN_SIMULATION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch (e) {
          errorDetails = { error: "Unknown error" };
        }

        const errorMessage = errorDetails?.error
          ? `API Error: ${errorDetails.error}`
          : `HTTP error ${response.status}`;

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Simulation result:", result);

      // Basic validation of the response
      if (!result.simulationData || !Array.isArray(result.simulationData)) {
        throw new Error("Invalid simulation data received");
      }

      // Update our Zustand stores with the simulation result data
      setSimulationResult(result.simulationData);
      if (result.servicePeriodsData) {
        setServicePeriodsData(result.servicePeriodsData);
      }

      // Update the simulation input filename if we used nextRunFilename
      if (nextRunFilename) {
        setSimulationInputFilename(nextRunFilename);
        setNextRunFilename(null); // Clear nextRunFilename now that it's been used
      }

      // Set the simulation ID from the result
      if (result.simulationId) {
        setLoadedSimulationId(result.simulationId);
      }

      // Update passenger distribution data if available
      if (result.passengerDistributionData) {
        setPassengerDistributionData(result.passengerDistributionData);
        // Also fetch more detailed passenger data if needed
        if (result.simulationId) {
          fetchPassengerDemand(
            result.simulationId,
            setPassengerDistributionData
          );
        }
      }

      // Save active settings that were used for this simulation
      setActiveSettings(currentSettings);

      // Mark that we have results and update state
      setHasResults(true);

      // Show success toast
      toast({
        title: "Simulation Complete",
        description: `Generated timetable with ${result.simulationData.length} train movements.`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Simulation error:", error);
      setApiError(error.message);

      toast({
        title: "Simulation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSimulating(false);
      setMapLoading(false);
    }
  };

  // Load simulation from history
  const handleLoadSimulation = async (simulationId: number) => {
    if (isSimulating || isMapLoading) {
      toast({
        title: "Simulation In Progress",
        description: "Please wait until current operation completes.",
        variant: "default",
      });
      return;
    }

    setIsHistoryLoading(true);
    setIsHistoryModalOpen(false); // Close the modal first
    setMapLoading(true); // Start loading map area

    try {
      console.log(`Loading simulation ID: ${simulationId}`);
      const timetableResponse = await fetch(
        GET_TIMETABLE_ENDPOINT(simulationId)
      );

      if (!timetableResponse.ok) {
        throw new Error(
          `Failed to fetch timetable: HTTP ${timetableResponse.status}`
        );
      }

      const fetchedResult = await timetableResponse.json();

      // Basic validation of the response
      if (
        !fetchedResult.simulationData ||
        !Array.isArray(fetchedResult.simulationData)
      ) {
        throw new Error("Invalid simulation data received");
      }

      // Update our stores with the simulation result data
      setSimulationResult(fetchedResult.simulationData);

      // Update service periods data if available
      if (fetchedResult.servicePeriodsData) {
        setServicePeriodsData(fetchedResult.servicePeriodsData);
      }

      // Update passenger distribution data if available
      if (fetchedResult.passengerDistributionData) {
        setPassengerDistributionData(fetchedResult.passengerDistributionData);
      }

      // Update the settings from the result if available
      if (fetchedResult.simulationSettings) {
        setActiveSettings(fetchedResult.simulationSettings);
      }

      // Update the filename from the loaded simulation
      if (fetchedResult.passengerDataFile) {
        setSimulationInputFilename(fetchedResult.passengerDataFile);
      } else {
        setSimulationInputFilename(null);
      }

      // Clear any next run filename
      setNextRunFilename(null);

      // Set the loaded simulation ID
      setLoadedSimulationId(simulationId);

      // Mark that we have results
      setHasResults(true);

      // Fetch more detailed passenger data if needed
      fetchPassengerDemand(simulationId, setPassengerDistributionData);

      // Show success toast
      toast({
        title: "Simulation Loaded",
        description: `Loaded timetable with ${fetchedResult.simulationData.length} train movements.`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error loading simulation:", error);
      setApiError(error.message);

      toast({
        title: "Loading Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsHistoryLoading(false);
      setMapLoading(false);
    }
  };

  // Fetch simulation history
  const handleFetchHistory = async () => {
    if (isHistoryLoading) return;

    setIsHistoryLoading(true);

    try {
      const response = await fetch(GET_SIMULATION_HISTORY_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched history:", data);
      setHistorySimulations(data || []);
      setHasFetchedInitialHistory(true);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      toast({
        title: "Error",
        description: `Failed to fetch simulation history: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Fetch passenger demand data
  const fetchPassengerDemand = async (
    simId: number | null,
    updater: (data: PassengerDistributionData[] | null) => void
  ) => {
    if (!simId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/simulations/${simId}/passenger-distribution`
      );
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched passenger distribution:", data);
      updater(data || null);
    } catch (error: any) {
      console.error("Error fetching passenger distribution:", error);
      // Non-critical error, just log it
    }
  };

  // Function to update station data for StationInfo component
  const handleStationClick = (stationId: number) => {
    if (!simulationResult) return;

    const stationEntries = simulationResult.filter(
      (entry) => entry.STATION_ID === stationId
    );

    if (stationEntries.length > 0) {
      // Get station name from stationsById instead of STATION_NAME
      const stationName = stationsById[stationId]?.name || "Unknown Station";

      setStationData({
        stationId,
        stationName,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Main application area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isSidebarCollapsed={isSidebarCollapsed}
          isLoading={isLoading}
          simulationSettings={simulationSettings}
          showInitialState={!hasResults && !isMapLoading}
          isMapLoading={isMapLoading}
          isClearConfirmOpen={isClearConfirmOpen}
          setIsClearConfirmOpen={setIsClearConfirmOpen}
          handleLoadNewData={handleLoadNewData}
          hasFetchedInitialHistory={hasFetchedInitialHistory}
          handleFetchHistory={handleFetchHistory}
          setHasFetchedInitialHistory={setHasFetchedInitialHistory}
          setIsHistoryModalOpen={setIsHistoryModalOpen}
          isSimulating={isSimulating}
          isFullDayView={isFullDayView}
          loadedSimulationId={loadedSimulationId}
          hasSimulationData={!!simulationResult && simulationResult.length > 0}
          simulatePassengers={simulatePassengers}
          onSimulatePassengersToggle={setSimulatePassengers}
          hasResults={hasResults}
          simulationInputFilename={simulationInputFilename}
          handleFileSelect={handleFileSelect}
          apiError={apiError}
          handleRunSimulation={handleRunSimulation}
          nextRunFilename={nextRunFilename}
        />

        {/* Main Content */}
        <MainContent mrtMapRef={mrtMapRef} stationData={stationData} />
      </div>

      {/* API Error Alert */}
      {apiError && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Simulation History Modal */}
      <SimulationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        simulations={historySimulations}
        isLoading={isHistoryLoading}
        onLoadSimulation={handleLoadSimulation}
        onRefreshHistory={handleFetchHistory}
        loadedSimulationId={loadedSimulationId}
        isSimulating={isSimulating}
      />

      {/* Confirm Clear Dialog */}
      <AlertDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Current Simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all current simulation data. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearCurrentSimulation}>
              Clear Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
