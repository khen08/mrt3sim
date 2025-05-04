"use client";

import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
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
  IconClock,
  IconInfoCircle,
  IconTrash,
  IconCalendarEvent,
  IconRepeat,
  IconClockHour4,
  IconFile,
  IconX,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [uploadedFileObject, setUploadedFileObject] = useState<File | null>(
    null
  );
  const [passengerArrivalData, setPassengerArrivalData] =
    useState<PassengerArrivalData | null>(null);

  const [simulationInput, setSimulationInput] = useState<SimulationInput>({
    filename: null,
    config: null,
  });

  const [simulationSettings, setSimulationSettings] =
    useState<SimulationSettings | null>(null);
  const [activeSimulationSettings, setActiveSimulationSettings] =
    useState<SimulationSettings | null>(null);

  const [simulationTime, setSimulationTime] = useState(PEAK_HOURS.AM.start);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<"REGULAR" | "SKIP-STOP">(
    "REGULAR"
  );
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [selectedTrainDetails, setSelectedTrainDetails] =
    useState<TrainInfoData | null>(null);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  const [simulationResult, setSimulationResult] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [hasFetchedInitialHistory, setHasFetchedInitialHistory] =
    useState(false);
  const [nextRunFilename, setNextRunFilename] = useState<string | null>(null);
  const { toast } = useToast();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historySimulations, setHistorySimulations] = useState<
    SimulationHistoryEntry[]
  >([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [loadedSimulationId, setLoadedSimulationId] = useState<number | null>(
    null
  );

  const [isFullDayView, setIsFullDayView] = useState(false);

  const [selectedPeak, setSelectedPeak] = useState<PeakPeriod>("AM");

  const [hasLoggedSchemeType, setHasLoggedSchemeType] = useState(false);

  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const [simulatePassengers, setSimulatePassengers] = useState<boolean>(true);

  const mrtMapRef = useRef<MrtMapHandle>(null);

  // State for debug visibility
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // State to store the raw service periods data structure
  const [loadedServicePeriodsData, setLoadedServicePeriodsData] = useState<
    ServicePeriod[] | null
  >(null);

  // State for aggregated passenger demand data (for chart)
  const [passengerDistributionData, setPassengerDistributionData] = useState<
    PassengerDistributionData[] | null
  >(null);

  const [isMapLoading, setIsMapLoading] = useState(false); // New state for map loading

  const fileInputRef = useRef<HTMLInputElement>(null); // Add ref for programmatic click

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
      const defaultSchemePattern = defaults.schemePattern;
      const stationsWithScheme = defaults.stations.map(
        (station: any, index: number) => ({
          ...station,
          scheme: defaultSchemePattern[index] || "AB",
        })
      );
      return {
        ...defaults,
        schemePattern: defaultSchemePattern,
        stations: stationsWithScheme,
      };
    } catch (error: any) {
      console.error("Failed to fetch default settings:", error);
      return null;
    }
  };

  const initializeSettings = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    const defaults = await fetchDefaultSettings();
    if (defaults) {
      setSimulationSettings(defaults);
      setActiveSimulationSettings(defaults);
      setSimulationInput((prev) => ({
        ...prev,
        config: defaults,
      }));
    } else {
      setSimulationSettings(null);
      setActiveSimulationSettings(null);
      setSimulationInput((prev) => ({ ...prev, config: null }));
      setApiError("Failed to load initial default settings.");
      toast({
        title: "Error Loading Settings",
        description:
          "Failed to load default simulation settings. Please try refreshing.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [toast]);

  const handleFetchHistory = useCallback(
    async (fetchFullHistory: boolean = false) => {
      if (fetchFullHistory) {
        setIsHistoryLoading(true);
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
        console.log(
          `Fetching simulation history since ID: ${highestKnownId}...`
        );
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
        const data: SimulationHistoryEntry[] = await response.json();
        console.log("Fetched history data:", data);

        // If it was an incremental fetch and new data arrived, briefly show loading
        if (!fetchFullHistory && data.length > 0) {
          setIsHistoryLoading(true);
        }

        // Merge new data with existing data
        setHistorySimulations((prevSimulations) => {
          const existingIds = new Set(
            prevSimulations.map((s) => s.SIMULATION_ID)
          );
          const newData = data.filter((s) => !existingIds.has(s.SIMULATION_ID));
          // Prepend new data (assuming API returns descending order) and sort again just in case
          const merged = [...newData, ...prevSimulations];
          merged.sort((a, b) => b.SIMULATION_ID - a.SIMULATION_ID);
          return merged;
        });
      } catch (error: any) {
        // Ensure loading is off even if there was an error
        setIsHistoryLoading(false);
        console.error("Failed to fetch history:", error);
        setApiError(`Failed to load simulation history: ${error.message}`);
        setHistorySimulations([]);
        toast({
          title: "Error Loading History",
          description: `Could not fetch simulation history: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [toast, historySimulations]
  );

  useEffect(() => {
    const loadInitialData = async () => {
      await initializeSettings();
    };

    loadInitialData();
  }, [initializeSettings]);

  const stationData = (() => {
    let data = {
      stationId: selectedStation || 1,
      stationName: selectedStation
        ? simulationSettings?.stations[selectedStation - 1]?.name ??
          `Station ${selectedStation}`
        : simulationSettings?.stations[0]?.name ?? "Station 1",
      waitingPassengers: 0,
      nextTrainArrivalNB: "--:--:--",
      nextTrainArrivalSB: "--:--:--",
      passengerFlowNB: { boarding: 0, alighting: 0 },
      passengerFlowSB: { boarding: 0, alighting: 0 },
      passengerDistribution: [] as PassengerDistribution[],
      rawData: null as any | null,
    };

    if (passengerArrivalData && selectedStation) {
      const stationArrivals = passengerArrivalData[selectedStation];
      if (stationArrivals) {
        data.passengerDistribution = Object.entries(stationArrivals).map(
          ([hour, count]) => ({
            hour: `${String(hour).padStart(2, "0")}:00`,
            count: count,
          })
        );
        data.passengerDistribution.sort((a, b) => a.hour.localeCompare(b.hour));
      }

      data.waitingPassengers = 0;
      data.passengerFlowNB = { boarding: 0, alighting: 0 };
      data.passengerFlowSB = { boarding: 0, alighting: 0 };
      data.rawData = null;

      const currentTimeSeconds = parseTime(simulationTime);
      let nextArrivalNB: number | null = null;
      let nextArrivalSB: number | null = null;

      if (simulationResult) {
        for (const entry of simulationResult) {
          const stationKey =
            "NStation" in entry
              ? "NStation"
              : "StationID" in entry
              ? "StationID"
              : null;
          const arrivalTimeKey =
            "Arrival Time" in entry
              ? "Arrival Time"
              : "ArrivalTime" in entry
              ? "ArrivalTime"
              : null;
          const directionKey = "Direction" in entry ? "Direction" : null;

          if (
            stationKey &&
            arrivalTimeKey &&
            directionKey &&
            entry[stationKey] === selectedStation &&
            entry[arrivalTimeKey]
          ) {
            try {
              const arrivalSeconds = parseTime(entry[arrivalTimeKey]);
              if (arrivalSeconds > currentTimeSeconds) {
                const dir = String(entry[directionKey]);
                if (
                  dir === "NORTHBOUND" &&
                  (!nextArrivalNB || arrivalSeconds < nextArrivalNB)
                ) {
                  nextArrivalNB = arrivalSeconds;
                } else if (
                  dir === "SOUTHBOUND" &&
                  (!nextArrivalSB || arrivalSeconds < nextArrivalSB)
                ) {
                  nextArrivalSB = arrivalSeconds;
                }
              }
            } catch (e) {}
          }
        }
      }

      if (nextArrivalNB) {
        data.nextTrainArrivalNB = formatTime(nextArrivalNB);
      }
      if (nextArrivalSB) {
        data.nextTrainArrivalSB = formatTime(nextArrivalSB);
      }
    }

    return data;
  })();

  const handleFileSelect = useCallback(
    (file: File | null, backendFilename: string | null) => {
      setUploadedFileObject(file);
      setNextRunFilename(null);

      if (file && backendFilename) {
        setSimulationInput((prev) => ({ ...prev, filename: backendFilename }));
        setSimulationResult(null);
        setSelectedStation(null);
        setSelectedTrainId(null);
        setSelectedTrainDetails(null);
        setSimulationTime(PEAK_HOURS.AM.start);
        setIsSimulationRunning(false);
        setApiError(null);
      } else {
        setSimulationInput((prev) => ({ ...prev, filename: null }));
        setSimulationResult(null);
        setSelectedStation(null);
        setSelectedTrainId(null);
        setSelectedTrainDetails(null);
        setIsSimulationRunning(false);
      }
    },
    []
  );

  const handleSettingChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string,
      field?: string
    ) => {
      let name: string | undefined;
      let value: any;

      if (typeof e === "string" && field) {
        name = field;
        value = e;
      } else if (typeof e === "object" && "target" in e) {
        name = e.target.name;
        value =
          e.target.type === "number"
            ? parseFloat(e.target.value) || 0
            : e.target.value;
        if (["dwellTime", "turnaroundTime", "maxCapacity"].includes(name)) {
          value = parseInt(e.target.value, 10) || 0;
        }
      } else {
        return;
      }

      if (name) {
        setSimulationSettings((prev) => {
          if (!prev) return null;
          const updatedSettings = { ...prev, [name as string]: value };
          setSimulationInput((prevInput) => ({
            ...prevInput,
            config: updatedSettings,
          }));
          return updatedSettings;
        });
      }
    },
    []
  );

  const handleStationDistanceChange = useCallback(
    (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const newDistance = parseFloat(event.target.value) || 0;
      setSimulationSettings((prev) => {
        if (!prev) return null;

        const updatedStations = prev.stations.map((station, i) => {
          if (i === index) {
            return { ...station, distance: newDistance };
          }
          return station;
        });

        const updatedSettings = { ...prev, stations: updatedStations };
        setSimulationInput((prevInput) => ({
          ...prevInput,
          config: updatedSettings,
        }));
        return updatedSettings;
      });
    },
    []
  );

  const handleStationSchemeChange = useCallback(
    (index: number, value: "AB" | "A" | "B") => {
      setSimulationSettings((prev) => {
        if (!prev) return null;

        const updatedStations = prev.stations.map((station, i) => {
          if (i === index) {
            return { ...station, scheme: value };
          }
          return station;
        });

        const updatedSchemePattern = updatedStations.map(
          (station) => station.scheme || "AB"
        );

        const updatedSettings = {
          ...prev,
          stations: updatedStations,
          schemePattern: updatedSchemePattern,
        };

        setSimulationInput((prevInput) => ({
          ...prevInput,
          config: updatedSettings,
        }));
        return updatedSettings;
      });
    },
    []
  );

  const handleSkipStopToggle = useCallback((checked: boolean) => {
    setSimulationSettings((prev) => {
      if (!prev) return null;

      const regularPattern = Array(prev.stations.length).fill("AB");

      const updatedSettings = {
        ...prev,
        schemeType: checked ? ("SKIP-STOP" as const) : ("REGULAR" as const),
        schemePattern: checked
          ? prev.stations.map((station) => station.scheme || "AB")
          : regularPattern,
      };

      setSimulationInput((prevInput) => ({
        ...prevInput,
        config: updatedSettings,
      }));
      return updatedSettings;
    });
  }, []);

  const handleTimeUpdate = useCallback((time: string) => {
    setSimulationTime((prevTime) => {
      if (time !== prevTime) {
        return time;
      }
      return prevTime;
    });
  }, []);

  const handleSimulationStateChange = useCallback(
    (isRunning: boolean) => {
      if (isRunning && (!simulationResult || simulationResult.length === 0)) {
        console.warn("Start clicked, but simulationResult is null or empty.");
        toast({
          title: "Cannot Start Simulation",
          description:
            "Please run the simulation first to generate the timetable.",
          variant: "default",
        });
        setIsSimulationRunning(false);
        return;
      }
      if (isRunning && !simulationSettings) {
        toast({
          title: "Cannot Start Simulation",
          description: "Simulation settings are missing.",
          variant: "destructive",
        });
        setIsSimulationRunning(false);
        return;
      }

      setIsSimulationRunning(isRunning);
    },
    [simulationResult, simulationSettings, toast]
  );

  const handleStationClick = useCallback((stationId: number) => {
    setSelectedStation((prevSelected) =>
      prevSelected === stationId ? null : stationId
    );
    setSelectedTrainId(null);
    setSelectedTrainDetails(null);
  }, []);

  const handleTrainClick = useCallback(
    (trainId: number, details: TrainInfoData) => {
      setSelectedTrainId((prevSelected) =>
        prevSelected === trainId ? null : trainId
      );
      if (selectedTrainId === trainId) {
        setSelectedTrainDetails(null);
      } else {
        setSelectedTrainDetails(details);
      }
      setSelectedStation(null);
    },
    []
  );

  const handleSimulatePassengersToggle = useCallback(
    (checked: boolean) => {
      setSimulatePassengers(checked);
      if (checked) {
        toast({
          title: "Passenger Simulation Enabled",
          description: simulationInput.filename
            ? `Will use '${simulationInput.filename}' for the next run.`
            : "Please upload or select a passenger data CSV.",
          variant: "default",
        });
      } else {
        toast({
          title: "Passenger Simulation Disabled",
          description: "Next run will not use passenger data.",
          variant: "default",
        });
      }
    },
    [toast, simulationInput.filename]
  );

  const handleRunSimulation = async () => {
    if (simulatePassengers && !simulationInput.filename && !nextRunFilename) {
      setApiError(
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
      setApiError("Simulation settings are missing or still loading.");
      toast({
        title: "Missing Settings",
        description: "Simulation settings not loaded.",
        variant: "destructive",
      });
      return;
    }

    setIsSimulating(true);
    setIsMapLoading(true); // Start loading map area
    setApiError(null);

    if (!simulationSettings) {
      toast({
        title: "Error",
        description: "Settings are missing.",
        variant: "destructive",
      });
      setIsSimulating(false);
      return;
    }

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
        loadedSimulationId !== null &&
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
        setSimulationResult(timetableData);

        // --- Persist Settings & Update Input State ---
        const settingsUsedForRun = simulationSettings!; // Not null checked at start
        setLoadedSimulationId(newSimulationId);
        setActiveSimulationSettings(settingsUsedForRun);
        setSimulationSettings(settingsUsedForRun);
        setSimulationInput({
          filename: payloadFilename, // Reflect the file actually used
          config: settingsUsedForRun,
        });
        // *Only* set simulatePassengers based on the file used *if* it's different from current state
        // This prevents overriding the user's toggle if they ran without passengers intentionally
        if (simulatePassengers !== !!payloadFilename) {
          setSimulatePassengers(!!payloadFilename);
        }
        setNextRunFilename(null); // Clear override filename

        console.log("Fetched Metadata (Run Sim):", fetchedMetadata);
        // Store the raw service periods array
        setLoadedServicePeriodsData(fetchedMetadata.service_periods || null);

        // Reset UI state
        setSimulationTime(PEAK_HOURS.AM.start);
        setIsSimulationRunning(false);
        setMapRefreshKey((prev) => prev + 1);
        setSelectedStation(null);
        setSelectedTrainId(null);
        setSelectedTrainDetails(null);
        setApiError(null);

        toast({
          title: `Simulation Completed (ID: ${newSimulationId}) ${
            runDuration !== undefined ? ` in ${runDuration.toFixed(2)}s` : ""
          }.`,
          description: `Timetable generated successfully (${timetableData.length} entries)`,
          variant: "default",
        });

        handleFetchHistory(); // Refresh history list

        // Fetch passenger demand after simulation run completes
        if (newSimulationId) {
          fetchPassengerDemand(newSimulationId, setPassengerDistributionData);
        }
      } else {
        // --- Handle failed timetable fetch after successful run ---
        console.error("Failed to fetch timetable data after all retries.");
        setApiError(
          `Simulation run (ID: ${newSimulationId}) but failed to fetch timetable data.`
        );
        // Don't clear simulationResult here, might still want to see old map? Or maybe clear it? Let's clear it.
        setSimulationResult(null);
        setLoadedSimulationId(null); // Clear loaded ID as well
        toast({
          title: "Simulation Complete (Timetable Failed)",
          description: `The simulation (ID: ${newSimulationId}) ran but timetable data could not be retrieved after ${maxRetries} attempts.`,
          variant: "destructive",
        });
        handleFetchHistory(); // Still refresh history
      }
    } catch (error: any) {
      // --- Handle errors during simulation run or initial fetch ---
      console.error("Simulation API or Timetable Fetch Failed:", error);
      setApiError(
        error.message || "An unknown error occurred during simulation."
      );
      // Clear results on error
      setSimulationResult(null);
      setLoadedSimulationId(null);
      toast({
        title: "Simulation Error",
        description: `Simulation failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
      setIsMapLoading(false); // Stop loading map area
    }
  };

  const handleLoadNewData = useCallback(() => {
    handleFileSelect(null, null);
    setLoadedSimulationId(null);
    setNextRunFilename(null);
    setIsClearConfirmOpen(false);
  }, [handleFileSelect]);

  const handleSchemeChange = useCallback(
    (scheme: "REGULAR" | "SKIP-STOP") => {
      if (scheme === "SKIP-STOP" && simulationResult) {
        const skipStopEntries = simulationResult.filter(
          (entry) =>
            entry.SCHEME_TYPE === "SKIP-STOP" ||
            entry.SERVICE_TYPE === "SKIP-STOP"
        ).length;

        const trainServiceTypes: Record<number, string> = {};
        simulationResult.forEach((entry) => {
          if (entry.TRAIN_SERVICE_TYPE) {
            const trainId = entry.TRAIN_ID;
            if (!trainServiceTypes[trainId]) {
              trainServiceTypes[trainId] = entry.TRAIN_SERVICE_TYPE;
            }
          }
        });
      }

      setSelectedScheme(scheme);
      setHasLoggedSchemeType(false);
      setMapRefreshKey((prev) => prev + 1);
    },
    [simulationResult]
  );

  const handleLoadSimulation = async (simulationId: number) => {
    setIsHistoryLoading(true);
    setIsMapLoading(true); // Start loading map area
    setApiError(null);
    setIsHistoryModalOpen(false);

    toast({
      title: "Loading Simulation",
      description: `Fetching timetable for simulation ID ${simulationId}`,
      variant: "default",
    });

    try {
      const historyEntry = historySimulations.find(
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

      const defaultSettings = await fetchDefaultSettings();

      if (defaultSettings && Array.isArray(timetableData.timetable)) {
        setSimulationResult(timetableData.timetable);
        setLoadedSimulationId(simulationId);
        setSimulationSettings(defaultSettings);
        setActiveSimulationSettings(defaultSettings);

        console.log("Fetched Timetable Data (Load Sim):", timetableData);

        // Store the raw service periods array
        setLoadedServicePeriodsData(timetableData.service_periods || null);

        setSimulationTime(PEAK_HOURS.AM.start);
        setIsSimulationRunning(false);
        setMapRefreshKey((prev) => prev + 1);
        setSelectedStation(null);
        setSelectedTrainId(null);
        setSelectedTrainDetails(null);
        setApiError(null);
        setSimulationInput((prev) => ({
          ...prev,
          filename: filename,
          config: defaultSettings,
        }));

        setSimulatePassengers(!!filename);
        setNextRunFilename(null);

        toast({
          title: "Simulation Loaded",
          description: `Successfully loaded timetable for simulation ID ${simulationId}. Settings reset to defaults. Passenger sim ${
            filename ? "enabled" : "disabled"
          }.`,
          variant: "default",
        });

        // Fetch passenger demand after simulation load completes
        fetchPassengerDemand(simulationId, setPassengerDistributionData);
      } else {
        throw new Error(
          "Failed to fetch default settings or timetable data structure was invalid after loading history."
        );
      }
    } catch (error: any) {
      console.error("Failed to load simulation:", error);
      setApiError(
        `Failed to load simulation ${simulationId}: ${error.message}`
      );
      setLoadedSimulationId(null);
      setNextRunFilename(null);
      setSimulationResult(null);
      toast({
        title: "Load Failed",
        description: `Could not load simulation ${simulationId}: ${error.message}`,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsHistoryLoading(false);
      setIsMapLoading(false); // Stop loading map area
    }
  };

  // Handler for debug info toggle
  const handleShowDebugInfoChange = (show: boolean) => {
    setShowDebugInfo(show);
  };

  // Determine what to show in the main content area
  const hasResults = !!simulationResult && simulationResult.length > 0;
  const showInitialState = !isMapLoading && !hasResults;

  // --- Define content for the main area ---
  let mainContent: ReactNode;

  if (isMapLoading) {
    mainContent = <LoadingPlaceholder message="Processing simulation..." />;
  } else if (hasResults) {
    mainContent = (
      <div className="flex-1 flex flex-col overflow-y-auto px-4">
        {/* Conditionally show CsvUpload if loading a file-less sim and enabling passengers */}
        {loadedSimulationId !== null &&
          simulationInput.filename === null &&
          simulatePassengers && (
            <Card className="border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/50">
              <CardHeader>
                <CardTitle className="text-amber-700 dark:text-amber-300 flex items-center">
                  <IconUpload className="mr-2" /> Passenger Data Required
                </CardTitle>
                <CardDescription className="text-amber-600 dark:text-amber-400">
                  You've enabled passenger simulation for a run that didn't
                  originally include passenger data. Please upload a CSV file to
                  use for the next simulation run.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CsvUpload
                  onFileSelect={(file, backendFilename) =>
                    setNextRunFilename(backendFilename)
                  }
                  initialFileName={nextRunFilename}
                />
              </CardContent>
            </Card>
          )}

        {/* Display SELECTED file info if results are loaded, passengers enabled, AND a file is selected */}
        {hasResults &&
          simulatePassengers &&
          simulationInput.filename !== null && (
            <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/50 p-3 my-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-hidden">
                  <IconFile
                    size={20}
                    className="text-blue-600 dark:text-blue-400 flex-shrink-0"
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span
                      className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate"
                      title={simulationInput.filename}
                    >
                      Selected for next run: {simulationInput.filename}
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {" "}
                      inherited from loaded simulation or previous selection{" "}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef} // Assign ref
                    onChange={(e) => {
                      // Use the main handleFileSelect when changing here
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(file, file.name); // Trigger upload + state update
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()} // Trigger hidden input
                  >
                    <IconReplace size={14} className="mr-1" /> Change
                  </Button>
                </div>
              </div>
            </Card>
          )}

        {/* Map takes remaining space */}
        <div className="mt-2 flex-1 min-h-0">
          <MrtMap
            ref={mrtMapRef}
            key={mapRefreshKey}
            selectedStation={selectedStation}
            onStationClick={handleStationClick}
            selectedTrainId={selectedTrainId}
            onTrainClick={handleTrainClick}
            simulationTime={simulationTime}
            isRunning={isSimulationRunning}
            simulationTimetable={simulationResult?.filter((entry) => {
              if (
                simulationResult &&
                simulationResult.length > 0 &&
                !hasLoggedSchemeType
              ) {
                setHasLoggedSchemeType(true);
              }
              return (
                !entry.SCHEME_TYPE ||
                entry.SCHEME_TYPE === selectedScheme ||
                entry.SERVICE_TYPE === selectedScheme
              );
            })}
            stationConfigData={activeSimulationSettings?.stations}
            turnaroundTime={activeSimulationSettings?.turnaroundTime}
            maxCapacity={activeSimulationSettings?.maxCapacity ?? 0}
            selectedScheme={activeSimulationSettings?.schemeType ?? "REGULAR"}
            uiSelectedScheme={selectedScheme}
            showDebugInfo={showDebugInfo}
            servicePeriodsData={loadedServicePeriodsData}
          />
        </div>

        {/* Controller is always visible below map */}
        <div
          className={cn(
            "flex-shrink-0",
            // Add margin only if an info card is displayed below it
            (selectedStation !== null || selectedTrainId !== null) && "mb-4"
          )}
        >
          <SimulationController
            startTime={
              isFullDayView
                ? FULL_DAY_HOURS.start
                : PEAK_HOURS[selectedPeak].start
            }
            endTime={
              isFullDayView ? FULL_DAY_HOURS.end : PEAK_HOURS[selectedPeak].end
            }
            onTimeUpdate={handleTimeUpdate}
            onSimulationStateChange={handleSimulationStateChange}
            isLoading={
              isSimulating /* Controller uses isSimulating, not isMapLoading */
            }
            hasSimulationData={
              !!simulationResult && simulationResult.length > 0
            }
            hasTimetableData={!!simulationResult && simulationResult.length > 0}
            onSchemeChange={handleSchemeChange}
            onToggleFullDayView={() => setIsFullDayView(!isFullDayView)}
            isFullDayView={isFullDayView}
            selectedPeak={selectedPeak}
            onPeakChange={setSelectedPeak}
            showDebugInfo={showDebugInfo}
            onShowDebugInfoChange={handleShowDebugInfoChange}
            className={cn(
              selectedStation === null &&
                selectedTrainId === null &&
                "border-b-0 rounded-b-none"
            )}
          />
        </div>

        {/* Station Info */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
            selectedStation !== null
              ? "opacity-100 max-h-[500px]"
              : "opacity-0 max-h-0 pointer-events-none"
          )}
        >
          {selectedStation !== null && simulationResult && (
            <StationInfo
              {...stationData}
              simulationTime={simulationTime}
              simulationResult={simulationResult}
              passengerDistributionData={passengerDistributionData}
              className={cn(
                selectedStation !== null &&
                  selectedTrainId === null &&
                  "border-b-0 rounded-b-none"
              )}
            />
          )}
        </div>

        {/* Train Info */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
            selectedTrainId !== null && selectedTrainDetails !== null
              ? "opacity-100 max-h-[500px]"
              : "opacity-0 max-h-0 pointer-events-none"
          )}
        >
          {selectedTrainId !== null && selectedTrainDetails !== null && (
            <TrainInfo
              {...selectedTrainDetails}
              simulationTime={simulationTime}
              simulationTimetable={simulationResult}
              trainEventPairs={mrtMapRef.current?.getTrainEventPairs()}
              trainStates={mrtMapRef.current?.getTrainStates()}
              stationsById={mrtMapRef.current?.getStationsById()}
              className={cn(
                selectedTrainId !== null &&
                  selectedTrainDetails !== null &&
                  "border-b-0 rounded-b-none"
              )}
            />
          )}
        </div>
      </div>
    );
  } else {
    // Initial State (CSV Upload or Passenger Sim Disabled message)
    mainContent = (
      <div className="flex-grow flex items-center justify-center p-4">
        {simulatePassengers ? (
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <IconUpload className="mr-2" /> Passenger Data Input
              </CardTitle>
              <CardDescription>
                Upload passenger flow data (CSV) to simulate passenger flow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CsvUpload
                // Use nextRunFilename for initial display if available
                onFileSelect={(file, backendFilename) => {
                  // When a new file is selected in the initial state,
                  // update both nextRunFilename (for immediate use)
                  // and simulationInput.filename (for persistence if run is clicked)
                  setNextRunFilename(backendFilename);
                  setSimulationInput((prev) => ({
                    ...prev,
                    filename: backendFilename,
                  }));
                }}
                initialFileName={
                  nextRunFilename ?? simulationInput.filename /* Fallback */
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-lg bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center text-amber-800 dark:text-amber-200">
                <IconInfoCircle className="mr-2" /> Passenger Simulation
                Disabled
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                The simulation will run based on train operational logic only.
                Passenger counts and demand will not be considered.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You can enable passenger simulation in the{" "}
                <IconSettings size={14} className="inline-block -mt-1" />{" "}
                <span className="font-medium">Simulation Settings</span> panel
                if needed.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Click <span className="font-medium">Run Simulation</span> to
                proceed.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <main className="flex h-screen bg-background relative overflow-hidden">
      <aside
        className={cn(
          "h-full flex flex-col bg-card shadow-lg transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-0 p-0 overflow-hidden" : "w-[500px]"
        )}
      >
        {!isSidebarCollapsed && (
          <>
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <IconTrain className="mr-2 text-mrt-blue" size={24} />
                MRT-3 Simulation
              </h2>
              <DarkModeToggle />
            </div>
            <div className="flex-grow overflow-y-auto p-4">
              {isLoading && !simulationSettings && (
                <div className="flex justify-center items-center p-4">
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Loading default settings...</span>
                </div>
              )}

              <div className="mb-4 space-y-2">
                {!showInitialState && !isMapLoading && (
                  <AlertDialog
                    open={isClearConfirmOpen}
                    onOpenChange={setIsClearConfirmOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left bg-transparent border border-destructive/50 text-destructive hover:bg-destructive/10"
                        disabled={isSimulating || isMapLoading}
                        title="Resets the main view, clearing the current map/timetable and file selection. Prepares for a new simulation setup or history load. Does not affect saved history or current settings adjustments."
                      >
                        <IconReplace className="mr-2 h-4 w-4" />
                        Reset View & Clear Loaded Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Reset Simulation View?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear the currently displayed map/timetable
                          and any selected passenger file. It prepares the
                          interface for a new simulation setup or loading from
                          history.
                          <br />
                          <strong className="mt-2 block">
                            This action does NOT delete saved simulation history
                            and does NOT reset your current settings
                            adjustments.
                          </strong>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleLoadNewData}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Yes, Reset View
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => {
                    if (!hasFetchedInitialHistory) {
                      console.log(
                        "First history button click: Fetching full history."
                      );
                      handleFetchHistory(true);
                      setHasFetchedInitialHistory(true);
                    } else {
                      console.log(
                        "Subsequent history button click: Fetching incremental history."
                      );
                      handleFetchHistory();
                    }
                    setIsHistoryModalOpen(true);
                  }}
                  title="View past simulation runs"
                  disabled={isMapLoading}
                >
                  <IconHistory className="mr-2 h-4 w-4" />
                  Simulation History
                </Button>
              </div>

              <SimulationSettingsCard
                simulationSettings={simulationSettings}
                isSimulating={isSimulating || isMapLoading}
                isFullDayView={isFullDayView}
                onSettingChange={handleSettingChange}
                onStationDistanceChange={handleStationDistanceChange}
                onStationSchemeChange={handleStationSchemeChange}
                onSkipStopToggle={handleSkipStopToggle}
                loadedSimulationId={loadedSimulationId}
                hasSimulationData={hasResults}
                simulatePassengers={simulatePassengers}
                onSimulatePassengersToggle={handleSimulatePassengersToggle}
              />

              {apiError && !simulationSettings && (
                <Alert variant="destructive" className="mb-4">
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Loading Settings</AlertTitle>
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="p-4 border-t mt-auto">
              {apiError && simulationSettings && (
                <Alert variant="destructive" className="mb-4">
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleRunSimulation}
                disabled={
                  isSimulating ||
                  isMapLoading ||
                  !simulationSettings ||
                  (simulatePassengers &&
                    !simulationInput.filename &&
                    !nextRunFilename)
                }
                className="w-full bg-mrt-blue hover:bg-blue-700 text-white h-12 text-lg font-semibold border-2 border-gray-300 dark:border-transparent shadow-md hover:shadow-lg"
              >
                {isSimulating || isMapLoading ? (
                  <>
                    <IconLoader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                    {isSimulating ? "Running Simulation..." : "Loading Data..."}
                  </>
                ) : (
                  <>
                    <IconPlayerPlay className="mr-2 h-5 w-5" /> Run Simulation
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </aside>

      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-gray-800 dark:bg-mrt-blue text-white shadow-lg border-2 border-white dark:border-white transition-all duration-300 ease-in-out hover:bg-black dark:hover:bg-blue-700",
          isSidebarCollapsed ? "left-2" : "left-[490px]"
        )}
        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isSidebarCollapsed ? (
          <IconChevronRight size={18} />
        ) : (
          <IconChevronLeft size={18} />
        )}
      </button>

      <div className="flex-grow h-full flex flex-col overflow-hidden">
        {mainContent}
      </div>

      <SimulationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        simulations={historySimulations}
        onLoadSimulation={(id) => handleLoadSimulation(id)}
        onRefreshHistory={() => handleFetchHistory(true)}
        isLoading={isHistoryLoading}
        loadedSimulationId={loadedSimulationId}
        isSimulating={isSimulating || isMapLoading}
      />
    </main>
  );
}

// --- NEW: Function to fetch passenger demand data (accepts setter as argument) --- //
const fetchPassengerDemand = async (
  simId: number | null,
  setter: React.Dispatch<
    React.SetStateAction<PassengerDistributionData[] | null>
  >
) => {
  if (simId === null) {
    setter(null); // Use the passed setter
    return;
  }

  console.log(`Fetching passenger demand data for simulation ID: ${simId}...`);
  try {
    const response = await fetch(
      `${API_BASE_URL}/get_passenger_demand/${simId}`
    );
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

    setter(distributionForChart);
    console.log(
      "Passenger demand distribution data processed:",
      distributionForChart
    );
  } catch (error: any) {
    console.error(
      `Failed to fetch or process passenger demand for sim ${simId}:`,
      error
    );
    setter(null); // Use the passed setter
    // Optional: Show a toast, but might be noisy
    // toast({ title: "Passenger Demand Error", description: error.message, variant: "warning" });
  }
};
