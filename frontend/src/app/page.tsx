"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

  const mrtMapRef = useRef<MrtMapHandle>(null);

  useEffect(() => {
    const fetchDefaults = async () => {
      setIsLoading(true);
      setApiError(null);
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

        setSimulationSettings({
          ...defaults,
          schemePattern: defaultSchemePattern,
          stations: stationsWithScheme,
        });

        setSimulationInput((prev) => ({
          ...prev,
          config: {
            ...defaults,
            schemePattern: defaultSchemePattern,
            stations: stationsWithScheme,
          },
        }));
      } catch (error: any) {
        console.error("Failed to fetch default settings:", error);
        setApiError(`Failed to load default settings: ${error.message}`);
        setSimulationSettings(null);
        setSimulationInput((prev) => ({ ...prev, config: null }));
        toast({
          title: "Error Loading Settings",
          description: `Failed to load default simulation settings: ${error.message}. Please try refreshing.`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDefaults();
  }, [toast]);

  useEffect(() => {
    handleFetchHistory();
  }, []);

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

  const handleFileSelect = useCallback((file: File | null) => {
    setUploadedFileObject(file);

    if (file) {
      setSimulationInput((prev) => ({ ...prev, filename: file.name }));
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
  }, []);

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

  const handleRunSimulation = async () => {
    if (!simulationInput.filename) {
      setApiError("Please upload a passenger data CSV file first.");
      toast({
        title: "Missing File",
        description: "Please upload a CSV file first.",
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
    setApiError(null);
    setSimulationResult(null);

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

    const payload = {
      filename: simulationInput.filename,
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
    };

    toast({
      title: "Running Simulation",
      description: "Generating timetable...",
      variant: "default",
    });

    try {
      const response = await fetch(RUN_SIMULATION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

      let timetableData;

      if (resultData.simulation_id) {
        try {
          const timetableResponse = await fetch(
            GET_TIMETABLE_ENDPOINT(resultData.simulation_id),
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (!timetableResponse.ok) {
            throw new Error(
              `Failed to fetch timetable: HTTP ${timetableResponse.status}`
            );
          }

          timetableData = await timetableResponse.json();
        } catch (timetableError: any) {
          console.error("Error fetching timetable:", timetableError);
          toast({
            title: "Timetable Fetch Error",
            description: `Simulation completed but couldn't fetch timetable: ${timetableError.message}`,
            variant: "destructive",
          });
          timetableData = [];
        }
      } else if (Array.isArray(resultData)) {
        timetableData = resultData;
      } else if (
        resultData.message === "Simulation completed successfully." &&
        resultData.simulation_id
      ) {
        timetableData = [];
      } else {
        console.warn("Unexpected response format:", resultData);
        timetableData = [];
      }

      if (Array.isArray(timetableData)) {
        setSimulationResult(timetableData);

        const defaultPeakStart = PEAK_HOURS.AM.start;
        setSimulationTime(defaultPeakStart);
        setIsSimulationRunning(false);
        setMapRefreshKey((prev) => prev + 1);

        toast({
          title: `Simulation Completed${
            runDuration !== undefined ? ` in ${runDuration}s` : ""
          }.`,
          description: `Timetable generated successfully (${timetableData.length} entries)`,
          variant: "default",
        });

        handleFetchHistory();
        setLoadedSimulationId(null);
      } else {
        console.warn("No timetable data available yet:", timetableData);
        setSimulationResult([]);
        setApiError(
          "Simulation successful, but timetable data not available yet."
        );

        toast({
          title: "Simulation Complete (No Data)",
          description:
            "The simulation ran successfully but no timetable data is available yet.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Simulation API Failed:", error);
      setApiError(
        error.message || "An unknown error occurred during simulation."
      );
      setSimulationResult(null);
      setLoadedSimulationId(null);
      toast({
        title: "Simulation API Error",
        description: `Simulation failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleLoadNewData = useCallback(() => {
    handleFileSelect(null);
    setLoadedSimulationId(null);
    setIsClearConfirmOpen(false);
  }, [handleFileSelect]);

  const showUploadView = !uploadedFileObject && !simulationResult;

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

  const handleFetchHistory = async () => {
    setIsHistoryLoading(true);
    setApiError(null);
    try {
      console.log("Fetching simulation history...");
      const response = await fetch(GET_SIMULATION_HISTORY_ENDPOINT);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      const data: SimulationHistoryEntry[] = await response.json();
      console.log("Fetched history:", data);
      setHistorySimulations(data);
    } catch (error: any) {
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
  };

  const handleLoadSimulation = async (simulationId: number) => {
    setIsHistoryLoading(true);
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
      setSimulationResult(timetableData.timetable);
      setLoadedSimulationId(simulationId);
      setSimulationTime(PEAK_HOURS.AM.start);
      setIsSimulationRunning(false);
      setMapRefreshKey((prev) => prev + 1);
      setSelectedStation(null);
      setSelectedTrainId(null);
      setSelectedTrainDetails(null);
      setSimulationInput((prev) => ({ ...prev, filename: filename }));

      toast({
        title: "Simulation Loaded",
        description: `Successfully loaded timetable for simulation ID ${simulationId}.`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Failed to load simulation:", error);
      setApiError(
        `Failed to load simulation ${simulationId}: ${error.message}`
      );
      setLoadedSimulationId(null);
      setSimulationResult(null);
      toast({
        title: "Load Failed",
        description: `Could not load simulation ${simulationId}: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsHistoryLoading(false);
    }
  };

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
                {!showUploadView && (
                  <AlertDialog
                    open={isClearConfirmOpen}
                    onOpenChange={setIsClearConfirmOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full justify-start text-left"
                        disabled={isSimulating}
                      >
                        <IconTrash className="mr-2 h-4 w-4" />
                        Clear Current Data & Settings
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will clear the
                          current timetable data and reset all simulation
                          settings to their defaults. You will need to upload a
                          new CSV or load from history again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleLoadNewData}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Yes, Clear Data
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => {
                    setIsHistoryModalOpen(true);
                  }}
                  title="View past simulation runs"
                >
                  <IconHistory className="mr-2 h-4 w-4" />
                  Simulation History
                </Button>
              </div>

              <SimulationSettingsCard
                simulationSettings={simulationSettings}
                isSimulating={isSimulating}
                isFullDayView={isFullDayView}
                onSettingChange={handleSettingChange}
                onStationDistanceChange={handleStationDistanceChange}
                onStationSchemeChange={handleStationSchemeChange}
                onSkipStopToggle={handleSkipStopToggle}
                onToggleFullDayView={() => setIsFullDayView(!isFullDayView)}
                loadedSimulationId={loadedSimulationId}
                hasSimulationData={
                  !!simulationResult && simulationResult.length > 0
                }
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
              {apiError && (
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
                  !simulationSettings ||
                  !simulationInput.filename
                }
                className="w-full bg-mrt-blue hover:bg-blue-700 text-white h-12 text-lg font-semibold border-2 border-gray-300 dark:border-transparent shadow-md hover:shadow-lg"
              >
                {isSimulating ? (
                  <>
                    <IconLoader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                    Running Simulation...
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

      <div className="flex-grow h-full flex flex-col p-4 overflow-y-auto transition-all duration-300 ease-in-out">
        {showUploadView ? (
          <div className="flex-grow flex items-center justify-center">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <IconUpload className="mr-2" /> Data Input
                </CardTitle>
                <CardDescription>
                  Upload passenger flow data (CSV) to begin.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CsvUpload onFileSelect={handleFileSelect} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div className="flex-1 min-h-0">
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
                  stationConfigData={simulationSettings?.stations}
                  turnaroundTime={simulationSettings?.turnaroundTime}
                  maxCapacity={simulationSettings?.maxCapacity ?? 0}
                  selectedScheme={selectedScheme}
                />
              </div>

              <div
                className={cn(
                  "flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
                  selectedStation !== null
                    ? "opacity-100 max-h-[500px] mt-4"
                    : "opacity-0 max-h-0 mt-0 pointer-events-none"
                )}
              >
                {selectedStation !== null && simulationResult && (
                  <StationInfo {...stationData} />
                )}
              </div>

              <div
                className={cn(
                  "flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
                  selectedTrainId !== null && selectedTrainDetails !== null
                    ? "opacity-100 max-h-[500px] mt-4"
                    : "opacity-0 max-h-0 mt-0 pointer-events-none"
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
                  />
                )}
              </div>
            </div>

            <div className="flex-shrink-0">
              <SimulationController
                startTime={
                  isFullDayView ? FULL_DAY_HOURS.start : PEAK_HOURS.AM.start
                }
                endTime={isFullDayView ? FULL_DAY_HOURS.end : PEAK_HOURS.PM.end}
                onTimeUpdate={handleTimeUpdate}
                onSimulationStateChange={handleSimulationStateChange}
                isLoading={isSimulating}
                hasTimetableData={
                  !!simulationResult && simulationResult.length > 0
                }
                onSchemeChange={handleSchemeChange}
                isFullDayView={isFullDayView}
                selectedPeak={selectedPeak}
                onPeakChange={setSelectedPeak}
              />
            </div>
          </div>
        )}
      </div>

      <SimulationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        simulations={historySimulations}
        onLoadSimulation={(id) => {
          handleLoadSimulation(id);
        }}
        isLoading={isHistoryLoading}
      />
    </main>
  );
}
