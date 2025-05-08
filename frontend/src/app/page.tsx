"use client";

import { useEffect, useRef, ReactNode, useState } from "react";
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
  IconTable,
  IconCheck,
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
import { cn, formatFileName } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import SimulationHistoryModal from "@/components/SimulationHistoryModal";
import SimulationSettingsCard from "@/components/SimulationSettingsCard";
import {
  PEAK_HOURS,
  FULL_DAY_HOURS,
  type PeakPeriod,
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
import { useSimulationStore } from "@/store/simulationStore";
import { useUIStore } from "@/store/uiStore";
import { useAPIStore } from "@/store/apiStore";
import { useFileStore } from "@/store/fileStore";
import { DataViewerButton } from "@/components/DataViewerButton";
import { DataViewerModal } from "@/components/DataViewerModal";
import { SimulationNameDialog } from "@/components/SimulationNameDialog";
import TourManager from "@/components/tour/TourManager";
import { useTourStore } from "@/store/tourStore";

// Define props for the LoadingPlaceholder component
interface LoadingPlaceholderProps {
  message?: string;
}

// Define the LoadingPlaceholder component structure
const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
  message = "Loading...",
}) => {
  // Create a more descriptive message for loading simulations
  const detailMessage = message.includes("Running")
    ? "Please wait while we generate the simulation..."
    : message.includes("Processing")
    ? "Please wait while we process the simulation data..."
    : message.includes("Loading existing")
    ? "Please wait while we restore the selected simulation..."
    : "Please wait while we load the simulation data...";

  return (
    <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-4 space-y-4">
      <div className="bg-card/90 backdrop-blur-sm rounded-lg p-8 shadow-xl flex flex-col items-center border-2 border-mrt-blue">
        <IconLoader2 className="h-20 w-20 animate-spin text-mrt-blue mb-6" />
        <p className="text-2xl font-bold text-card-foreground">{message}</p>
        <p className="text-lg text-muted-foreground mt-3">{detailMessage}</p>
      </div>
    </div>
  );
};

// Define a placeholder component inline
const FileReadyPlaceholder = ({ fileName }: { fileName: string }) => {
  const displayFileName = formatFileName(fileName);

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 space-y-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center text-green-700 dark:text-green-400">
            <IconCheck className="mr-2" size={24} /> File Ready
          </CardTitle>
          <CardDescription>
            <span className="font-medium">{displayFileName}</span> is validated
            and ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Click the <span className="font-medium">Run Simulation</span> button
            in the sidebar to start.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default function Home() {
  // Get state from Zustand stores
  // Simulation store
  const simulationSettings = useSimulationStore(
    (state: any) => state.simulationSettings
  );
  const activeSimulationSettings = useSimulationStore(
    (state: any) => state.activeSimulationSettings
  );
  const simulationInput = useSimulationStore(
    (state: any) => state.simulationInput
  );
  const simulationTime = useSimulationStore(
    (state: any) => state.simulationTime
  );
  const isSimulationRunning = useSimulationStore(
    (state: any) => state.isSimulationRunning
  );
  const simulatePassengers = useSimulationStore(
    (state: any) => state.simulatePassengers
  );
  const selectedScheme = useSimulationStore(
    (state: any) => state.selectedScheme
  );
  const simulationResult = useSimulationStore(
    (state: any) => state.simulationResult
  );
  const isLoading = useSimulationStore((state: any) => state.isLoading);
  const isSimulating = useSimulationStore((state: any) => state.isSimulating);
  const isMapLoading = useSimulationStore((state: any) => state.isMapLoading);
  const apiError = useSimulationStore((state: any) => state.apiError);
  const nextRunFilename = useSimulationStore(
    (state: any) => state.nextRunFilename
  );
  const loadedSimulationId = useSimulationStore(
    (state: any) => state.loadedSimulationId
  );
  const isFullDayView = useSimulationStore((state: any) => state.isFullDayView);
  const selectedPeak = useSimulationStore((state: any) => state.selectedPeak);
  const showDebugInfo = useSimulationStore((state: any) => state.showDebugInfo);
  const loadedServicePeriodsData = useSimulationStore(
    (state: any) => state.loadedServicePeriodsData
  );
  const passengerDistributionData = useSimulationStore(
    (state: any) => state.passengerDistributionData
  );
  const mapRefreshKey = useSimulationStore((state: any) => state.mapRefreshKey);

  // UI store
  const isSidebarCollapsed = useUIStore(
    (state: any) => state.isSidebarCollapsed
  );
  const isHistoryModalOpen = useUIStore(
    (state: any) => state.isHistoryModalOpen
  );
  const isClearConfirmOpen = useUIStore(
    (state: any) => state.isClearConfirmOpen
  );
  const selectedStation = useUIStore((state: any) => state.selectedStation);
  const selectedTrainId = useUIStore((state: any) => state.selectedTrainId);
  const selectedTrainDetails = useUIStore(
    (state: any) => state.selectedTrainDetails
  );
  const isHistoryLoading = useUIStore((state: any) => state.isHistoryLoading);
  const historySimulations = useUIStore(
    (state: any) => state.historySimulations
  );
  const hasFetchedInitialHistory = useUIStore(
    (state: any) => state.hasFetchedInitialHistory
  );

  // File store
  const uploadedFileObject = useFileStore(
    (state: any) => state.uploadedFileObject
  );
  const validationStatus = useFileStore((state: any) => state.validationStatus);
  const uploadedFileName = useFileStore((state: any) => state.uploadedFileName);

  // Get actions from Zustand stores
  // Simulation store actions
  const setSimulationSettings = useSimulationStore(
    (state: any) => state.setSimulationSettings
  );
  const setActiveSimulationSettings = useSimulationStore(
    (state: any) => state.setActiveSimulationSettings
  );
  const setSimulationInput = useSimulationStore(
    (state: any) => state.setSimulationInput
  );
  const setSimulationTime = useSimulationStore(
    (state: any) => state.setSimulationTime
  );
  const setIsSimulationRunning = useSimulationStore(
    (state: any) => state.setIsSimulationRunning
  );
  const setSimulatePassengers = useSimulationStore(
    (state: any) => state.setSimulatePassengers
  );
  const setSelectedScheme = useSimulationStore(
    (state: any) => state.setSelectedScheme
  );
  const setIsFullDayView = useSimulationStore(
    (state: any) => state.setIsFullDayView
  );
  const setSelectedPeak = useSimulationStore(
    (state: any) => state.setSelectedPeak
  );
  const setShowDebugInfo = useSimulationStore(
    (state: any) => state.setShowDebugInfo
  );
  const setNextRunFilename = useSimulationStore(
    (state: any) => state.setNextRunFilename
  );
  const incrementMapRefreshKey = useSimulationStore(
    (state: any) => state.incrementMapRefreshKey
  );
  const resetSimulation = useSimulationStore(
    (state: any) => state.resetSimulation
  );

  // UI store actions
  const setSidebarCollapsed = useUIStore(
    (state: any) => state.setSidebarCollapsed
  );
  const setHistoryModalOpen = useUIStore(
    (state: any) => state.setHistoryModalOpen
  );
  const setClearConfirmOpen = useUIStore(
    (state: any) => state.setClearConfirmOpen
  );
  const setDataViewerModalOpen = useUIStore(
    (state: any) => state.setDataViewerModalOpen
  );
  const selectStation = useUIStore((state: any) => state.selectStation);
  const selectTrain = useUIStore((state: any) => state.selectTrain);
  const setHasFetchedInitialHistory = useUIStore(
    (state: any) => state.setHasFetchedInitialHistory
  );

  // File store actions
  const setUploadedFileObject = useFileStore(
    (state: any) => state.setUploadedFileObject
  );

  // API store actions
  const fetchDefaultSettings = useAPIStore(
    (state: any) => state.fetchDefaultSettings
  );
  const fetchSimulationHistory = useAPIStore(
    (state: any) => state.fetchSimulationHistory
  );
  const runSimulation = useAPIStore((state: any) => state.runSimulation);
  const loadSimulation = useAPIStore((state: any) => state.loadSimulation);

  // Add tour store
  const startTour = useTourStore((state: any) => state.startTour);
  const resetTour = useTourStore((state: any) => state.resetTour);

  const { toast } = useToast();
  const mrtMapRef = useRef<MrtMapHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize settings on component mount
  useEffect(() => {
    const initializeSettings = async () => {
      useSimulationStore.getState().setIsLoading(true);
      useSimulationStore.getState().setApiError(null);

      const defaults = await fetchDefaultSettings();

      if (defaults) {
        setSimulationSettings(defaults);
        setActiveSimulationSettings(defaults);
        setSimulationInput({ config: defaults });
      } else {
        setSimulationSettings(null);
        setActiveSimulationSettings(null);
        setSimulationInput({ config: null });
        useSimulationStore
          .getState()
          .setApiError("Failed to load initial default settings.");
        toast({
          title: "Error Loading Settings",
          description:
            "Failed to load default simulation settings. Please try refreshing.",
          variant: "destructive",
        });
      }

      useSimulationStore.getState().setIsLoading(false);
    };

    initializeSettings();
  }, [
    toast,
    fetchDefaultSettings,
    setSimulationSettings,
    setActiveSimulationSettings,
    setSimulationInput,
  ]);

  // Compute station data based on current selection
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
      passengerDistribution: [] as { hour: string; count: number }[],
      rawData: null as any | null,
    };

    // If a station is selected and we have passenger data
    if (selectedStation) {
      // Set passenger distribution data from the store
      if (passengerDistributionData && passengerDistributionData.length > 0) {
        data.passengerDistribution = [...passengerDistributionData];
      }

      data.waitingPassengers = 0;
      data.passengerFlowNB = { boarding: 0, alighting: 0 };
      data.passengerFlowSB = { boarding: 0, alighting: 0 };
      data.rawData = null;

      const currentTimeSeconds = parseTime(simulationTime);
      let nextArrivalNB: number | null = null;
      let nextArrivalSB: number | null = null;

      // Calculate next train arrivals from the simulation result
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

  // Handle file selection
  const handleFileSelect = (
    file: File | null,
    backendFilename: string | null,
    inheritedFromSimulation: boolean = false,
    simulationId: number | undefined = undefined
  ) => {
    setUploadedFileObject(file);

    // Update file metadata in the store
    useFileStore.getState().updateFileMetadata({
      isInherited: inheritedFromSimulation,
      simulationId: simulationId,
      isRequired: simulatePassengers && !backendFilename,
    });

    // Don't reset nextRunFilename when called from SimulationSettingsCard's change button
    if (useFileStore.getState().uploadSource !== "settings-change") {
      setNextRunFilename(null);
    }

    if (file && backendFilename) {
      setSimulationInput({ filename: backendFilename });

      // Only reset visual state when NOT called from settings card change button
      if (useFileStore.getState().uploadSource !== "settings-change") {
        useSimulationStore.getState().setSimulationResult(null);
        selectStation(null);
        selectTrain(null, null);
        setSimulationTime(PEAK_HOURS.AM.start);
        setIsSimulationRunning(false);
      }

      // Always make sure simulatePassengers is true when a file is provided
      if (!simulatePassengers) {
        setSimulatePassengers(true);
      }

      useSimulationStore.getState().setApiError(null);
    }
    // If passenger simulation is enabled but no file is provided
    else if (simulatePassengers && !file && !backendFilename) {
      // Mark that a file is required but not yet selected
      useFileStore.getState().updateFileMetadata({
        isRequired: true,
      });
    } else {
      // This block should only run when not called from settings change button
      if (useFileStore.getState().uploadSource !== "settings-change") {
        setSimulationInput({ filename: null });
        useSimulationStore.getState().setSimulationResult(null);
        selectStation(null);
        selectTrain(null, null);
        setIsSimulationRunning(false);
      }
    }
  };

  // When loading a simulation, handle the file appropriately
  useEffect(() => {
    if (loadedSimulationId && simulationInput.filename) {
      // Update file metadata to indicate it was inherited from a loaded simulation
      useFileStore.getState().updateFileMetadata({
        isInherited: true,
        simulationId: loadedSimulationId,
        isRequired: false,
      });
    }
  }, [loadedSimulationId, simulationInput.filename]);

  // Handler for toggling full day view
  const handleToggleFullDayView = () => {
    setIsFullDayView(!isFullDayView);
  };

  // Handler for updating simulation time
  const handleTimeUpdate = (time: string) => {
    setSimulationTime(time);
  };

  // Handler for simulation state change
  const handleSimulationStateChange = (isRunning: boolean) => {
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
  };

  // Handler for station click
  const handleStationClick = (stationId: number) => {
    selectStation(stationId);
  };

  // Handler for train click
  const handleTrainClick = (trainId: number, details: any) => {
    selectTrain(trainId, details);
  };

  // Handler for scheme change
  const handleSchemeChange = (scheme: "REGULAR" | "SKIP-STOP") => {
    setSelectedScheme(scheme);
    incrementMapRefreshKey();
  };

  // Handler for showing/hiding debug info
  const handleShowDebugInfoChange = (show: boolean) => {
    setShowDebugInfo(show);
  };

  // Handler for loading new data
  const handleLoadNewData = () => {
    // Perform a complete reset of relevant state
    useFileStore.getState().resetFileState(); // Corrected: Use resetFileState
    resetSimulation(); // Reset simulation store
    useUIStore.getState().resetState(); // Reset UI store

    // Explicitly reset key values to ensure they're cleared
    setSimulationInput({ filename: null });
    useSimulationStore.getState().setLoadedSimulationId(null);
    useSimulationStore.getState().setSimulationResult(null);
    setNextRunFilename(null);
    setIsSimulationRunning(false);

    // Reset time to default
    setSimulationTime(PEAK_HOURS.AM.start);

    // Reset selections
    selectStation(null);
    selectTrain(null, null);

    // Refresh the map
    incrementMapRefreshKey();

    // Close the modal
    setClearConfirmOpen(false);
  };

  // Handle train icon click in the sidebar to start the tour
  const handleTrainIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset and start the tour with the appropriate section
    resetTour();
    if (simulationResult) {
      startTour(2); // Start section 2 if a simulation is loaded
    } else {
      startTour(1); // Start section 1 if no simulation is loaded
    }
  };

  // Determine what to show in the main content area
  const hasResults = !!simulationResult && simulationResult.length > 0;
  const showInitialState = !isMapLoading && !hasResults;
  const uploadSource = useFileStore((state: any) => state.uploadSource);

  // Only show CsvUpload in main area when NO simulation is loaded
  // This is a critical condition - must be strictly enforced
  const showCsvUploadCard =
    !loadedSimulationId && // NEVER show when simulation is loaded
    simulatePassengers &&
    !hasResults &&
    !nextRunFilename &&
    validationStatus !== "valid" &&
    uploadSource !== "settings-change";

  const showPassengerDisabledCard =
    !simulatePassengers && !hasResults && !loadedSimulationId;

  // **New Condition**
  const showFileReadyPlaceholder =
    !loadedSimulationId && // Only show when no simulation is loaded
    simulatePassengers &&
    !hasResults &&
    !isMapLoading &&
    validationStatus === "valid" &&
    uploadedFileName;

  // --- Define content for the main area ---
  let mainContent: ReactNode;

  // Even more aggressively check for any loading state to ensure spinner shows
  const isAnyLoading =
    isLoading ||
    isSimulating ||
    isMapLoading ||
    useSimulationStore.getState().isLoading ||
    useSimulationStore.getState().isSimulating ||
    useSimulationStore.getState().isMapLoading;

  if (isAnyLoading) {
    // Show different loading messages based on the loading state
    let loadingMessage = "Loading...";

    // Make the conditions completely separate to avoid any potential nesting issues
    if (
      loadedSimulationId &&
      (isSimulating || useSimulationStore.getState().isSimulating)
    ) {
      loadingMessage = "Loading existing simulation...";
    } else if (isSimulating || useSimulationStore.getState().isSimulating) {
      loadingMessage = "Running simulation...";
    } else if (isMapLoading || useSimulationStore.getState().isMapLoading) {
      loadingMessage = "Processing simulation data...";
    }

    mainContent = (
      <LoadingPlaceholder
        key={`loading-${loadingMessage}`}
        message={loadingMessage}
      />
    );
  } else if (hasResults) {
    mainContent = (
      <div className="flex-1 flex flex-col overflow-y-auto px-4">
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
            simulationTimetable={simulationResult?.filter(
              (entry: any) =>
                !entry.SCHEME_TYPE ||
                entry.SCHEME_TYPE === selectedScheme ||
                entry.SERVICE_TYPE === selectedScheme
            )}
            stationConfigData={activeSimulationSettings?.stations}
            turnaroundTime={activeSimulationSettings?.turnaroundTime}
            maxCapacity={activeSimulationSettings?.trainSpecs.maxCapacity ?? 0}
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
                : PEAK_HOURS[selectedPeak as PeakPeriod].start
            }
            endTime={
              isFullDayView
                ? FULL_DAY_HOURS.end
                : PEAK_HOURS[selectedPeak as PeakPeriod].end
            }
            onTimeUpdate={handleTimeUpdate}
            onSimulationStateChange={handleSimulationStateChange}
            isLoading={isSimulating}
            hasSimulationData={hasResults}
            hasTimetableData={!!simulationResult && simulationResult.length > 0}
            onSchemeChange={handleSchemeChange}
            onToggleFullDayView={handleToggleFullDayView}
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
  } else if (showFileReadyPlaceholder) {
    mainContent = <FileReadyPlaceholder fileName={uploadedFileName!} />;
  } else {
    // Initial State (CSV Upload or Passenger Sim Disabled message)
    mainContent = (
      <div className="flex-grow flex items-center justify-center p-4">
        {showCsvUploadCard && (
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
                onFileSelect={(file, backendFilename) => {
                  setNextRunFilename(backendFilename);
                  setSimulationInput({ filename: backendFilename });
                }}
                initialFileName={nextRunFilename ?? simulationInput.filename}
              />
            </CardContent>
          </Card>
        )}
        {showPassengerDisabledCard && (
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
                <IconTrain
                  className="mr-2 text-mrt-blue cursor-pointer hover:text-mrt-blue/80 transition-colors"
                  size={24}
                  onClick={handleTrainIconClick}
                  title="Start guided tour"
                />
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
                    onOpenChange={setClearConfirmOpen}
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
                  className="w-full justify-start text-left history-button"
                  onClick={() => {
                    if (!hasFetchedInitialHistory) {
                      console.log(
                        "First history button click: Fetching full history."
                      );
                      fetchSimulationHistory(true);
                      setHasFetchedInitialHistory(true);
                    } else {
                      console.log(
                        "Subsequent history button click: Fetching incremental history."
                      );
                      fetchSimulationHistory();
                    }
                    setHistoryModalOpen(true);
                  }}
                  title="View past simulation runs"
                  disabled={isMapLoading}
                >
                  <IconHistory className="mr-2 h-4 w-4" />
                  Simulation History
                </Button>

                <DataViewerButton />
              </div>

              <SimulationSettingsCard
                isSimulating={isSimulating || isMapLoading}
                isFullDayView={isFullDayView}
                hasSimulationData={hasResults}
                hasResults={hasResults}
                handleFileSelect={handleFileSelect}
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
                onClick={runSimulation}
                disabled={
                  isSimulating ||
                  isMapLoading ||
                  !simulationSettings ||
                  (simulatePassengers &&
                    !simulationInput.filename &&
                    !nextRunFilename)
                }
                className={cn(
                  "w-full bg-mrt-blue hover:bg-blue-700 text-white h-12 text-lg font-semibold border-2 border-gray-300 dark:border-transparent shadow-md hover:shadow-lg",
                  (isSimulating || isMapLoading) && "bg-mrt-blue/70 relative"
                )}
              >
                {isSimulating || isMapLoading ? (
                  <>
                    <div className="absolute inset-0 bg-mrt-blue/20 backdrop-blur-[1px] flex items-center justify-center">
                      <IconLoader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span>
                        {isSimulating
                          ? "Running Simulation..."
                          : "Loading Data..."}
                      </span>
                    </div>
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
        onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
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
        onClose={() => setHistoryModalOpen(false)}
        simulations={historySimulations}
        onLoadSimulation={(id) => loadSimulation(id)}
        onRefreshHistory={() => fetchSimulationHistory(true)}
        isLoading={isHistoryLoading}
        loadedSimulationId={loadedSimulationId}
        isSimulating={isSimulating || isMapLoading}
      />

      <DataViewerModal
        isOpen={useUIStore((state: any) => state.isDataViewerModalOpen)}
        onClose={() => useUIStore.getState().setDataViewerModalOpen(false)}
      />

      {/* Add the Simulation Name Dialog */}
      <SimulationNameDialog />

      {/* Add TourManager component */}
      <TourManager />
    </main>
  );
}
