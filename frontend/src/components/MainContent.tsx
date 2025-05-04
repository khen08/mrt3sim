import React, { ReactNode, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconUpload,
  IconLoader2,
  IconInfoCircle,
  IconSettings,
  IconFile,
} from "@tabler/icons-react";
import CsvUpload from "@/components/CsvUpload";
import MrtMap, { MrtMapHandle } from "@/components/MrtMap";
import SimulationController from "@/components/SimulationController";
import StationInfo from "@/components/StationInfo";
import TrainInfo from "@/components/TrainInfo";
import { cn } from "@/lib/utils";
import { PeakPeriod, PEAK_HOURS, FULL_DAY_HOURS } from "@/lib/constants";

// LoadingPlaceholder component
interface LoadingPlaceholderProps {
  message?: string;
}

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

interface MainContentProps {
  isMapLoading: boolean;
  hasResults: boolean;
  simulatePassengers: boolean;
  loadedSimulationId: number | null;
  simulationInput: {
    filename: string | null;
    config: any | null;
  };
  nextRunFilename: string | null;
  setNextRunFilename: (filename: string | null) => void;
  setSimulationInput: React.Dispatch<
    React.SetStateAction<{
      filename: string | null;
      config: any | null;
    }>
  >;
  simulationResult: any[] | null;
  selectedStation: number | null;
  onStationClick: (stationId: number) => void;
  selectedTrainId: number | null;
  onTrainClick: (trainId: number, details: any) => void;
  simulationTime: string;
  isSimulationRunning: boolean;
  onTimeUpdate: (time: string) => void;
  onSimulationStateChange: (isRunning: boolean) => void;
  mapRefreshKey: number;
  activeSimulationSettings: any | null;
  selectedScheme: "REGULAR" | "SKIP-STOP";
  onSchemeChange: (scheme: "REGULAR" | "SKIP-STOP") => void;
  showDebugInfo: boolean;
  onShowDebugInfoChange: (show: boolean) => void;
  isFullDayView: boolean;
  onToggleFullDayView: () => void;
  selectedPeak: PeakPeriod;
  onPeakChange: (peak: PeakPeriod) => void;
  selectedTrainDetails: any | null;
  loadedServicePeriodsData: any | null;
  passengerDistributionData: any | null;
  mrtMapRef: React.RefObject<MrtMapHandle | null>;
  stationData: any;
  isSimulating: boolean;
}

const MainContent: React.FC<MainContentProps> = ({
  isMapLoading,
  hasResults,
  simulatePassengers,
  loadedSimulationId,
  simulationInput,
  nextRunFilename,
  setNextRunFilename,
  setSimulationInput,
  simulationResult,
  selectedStation,
  onStationClick,
  selectedTrainId,
  onTrainClick,
  simulationTime,
  isSimulationRunning,
  onTimeUpdate,
  onSimulationStateChange,
  mapRefreshKey,
  activeSimulationSettings,
  selectedScheme,
  onSchemeChange,
  showDebugInfo,
  onShowDebugInfoChange,
  isFullDayView,
  onToggleFullDayView,
  selectedPeak,
  onPeakChange,
  selectedTrainDetails,
  loadedServicePeriodsData,
  passengerDistributionData,
  mrtMapRef,
  stationData,
  isSimulating,
}) => {
  // Use useState instead of a variable to manage content
  const [contentState, setContentState] = useState<ReactNode>(null);

  // Determine the base content based on current state
  useEffect(() => {
    let newContent: ReactNode;

    if (isMapLoading) {
      newContent = <LoadingPlaceholder message="Processing simulation..." />;
    } else if (hasResults) {
      // When we have simulation results, ALWAYS show the map
      // regardless of nextRunFilename state
      newContent = (
        <div className="flex-1 flex flex-col overflow-y-auto px-4">
          {/* Conditionally show CsvUpload if loading a file-less sim and enabling passengers */}
          {loadedSimulationId !== null &&
            simulationInput.filename === null &&
            nextRunFilename === null && // Only show if no file has been selected via the "Change" button
            simulatePassengers && (
              <Card className="border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/50">
                <CardHeader>
                  <CardTitle className="text-amber-700 dark:text-amber-300 flex items-center">
                    <IconUpload className="mr-2" /> Passenger Data Required
                  </CardTitle>
                  <CardDescription className="text-amber-600 dark:text-amber-400">
                    You've enabled passenger simulation for a run that didn't
                    originally include passenger data. Please upload a CSV file
                    to use for the next simulation run.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CsvUpload
                    onFileSelect={(file, backendFilename) =>
                      setNextRunFilename(backendFilename)
                    }
                    initialFileName={nextRunFilename}
                    forceHide={!!nextRunFilename} // Hide if we already have a file selected
                  />
                </CardContent>
              </Card>
            )}

          {/* Map takes remaining space */}
          <div className="mt-2 flex-1 min-h-0">
            <MrtMap
              ref={mrtMapRef}
              key={mapRefreshKey}
              selectedStation={selectedStation}
              onStationClick={onStationClick}
              selectedTrainId={selectedTrainId}
              onTrainClick={onTrainClick}
              simulationTime={simulationTime}
              isRunning={isSimulationRunning}
              simulationTimetable={simulationResult?.filter((entry) => {
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
                isFullDayView
                  ? FULL_DAY_HOURS.end
                  : PEAK_HOURS[selectedPeak].end
              }
              onTimeUpdate={onTimeUpdate}
              onSimulationStateChange={onSimulationStateChange}
              isLoading={isSimulating}
              hasSimulationData={
                !!simulationResult && simulationResult.length > 0
              }
              hasTimetableData={
                !!simulationResult && simulationResult.length > 0
              }
              onSchemeChange={onSchemeChange}
              onToggleFullDayView={onToggleFullDayView}
              isFullDayView={isFullDayView}
              selectedPeak={selectedPeak}
              onPeakChange={onPeakChange}
              showDebugInfo={showDebugInfo}
              onShowDebugInfoChange={onShowDebugInfoChange}
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
    } else if (!hasResults && nextRunFilename) {
      // ONLY show the "File Selected" screen when we DON'T have simulation results
      // This ensures we never replace the current simulation with the file selected screen
      newContent = (
        <div className="flex-grow flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <IconFile className="mr-2 text-blue-600" /> File Selected
              </CardTitle>
              <CardDescription>
                A file has been selected for the next simulation run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 p-4 rounded-md border border-blue-200 dark:border-blue-900">
                <IconFile
                  size={24}
                  className="text-blue-600 dark:text-blue-400 flex-shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Ready to run simulation with:
                  </span>
                  <span className="text-xs font-medium text-blue-800 dark:text-blue-200 truncate">
                    {nextRunFilename}
                  </span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Click the "Run Simulation" button to proceed with this file.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    } else {
      // Initial State (CSV Upload or Passenger Sim Disabled message)
      newContent = (
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
                  onFileSelect={(file, backendFilename) => {
                    console.log(
                      "CsvUpload onFileSelect called with:",
                      backendFilename
                    );
                    setNextRunFilename(backendFilename);
                  }}
                  initialFileName={nextRunFilename}
                  forceHide={!!nextRunFilename}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <IconSettings className="mr-2" /> Ready to Simulate
                </CardTitle>
                <CardDescription>
                  Configure your simulation settings and run the simulation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Passenger simulation is disabled. You can enable it in the
                  sidebar if you want to simulate passenger traffic.
                </p>
                <div className="mt-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 p-4 rounded-md border border-amber-200 dark:border-amber-900">
                  <IconInfoCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Click "Run Simulation" in the sidebar to generate a
                    timetable based on your configuration.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    setContentState(newContent);
  }, [
    isMapLoading,
    hasResults,
    simulatePassengers,
    nextRunFilename,
    loadedSimulationId,
    simulationInput.filename,
    // Include all other dependencies to ensure content updates properly
    mrtMapRef,
    mapRefreshKey,
    selectedStation,
    onStationClick,
    selectedTrainId,
    onTrainClick,
    simulationTime,
    isSimulationRunning,
    simulationResult,
    activeSimulationSettings,
    selectedScheme,
    showDebugInfo,
    loadedServicePeriodsData,
    isFullDayView,
    selectedPeak,
    onTimeUpdate,
    onSimulationStateChange,
    isSimulating,
    onSchemeChange,
    onToggleFullDayView,
    onPeakChange,
    onShowDebugInfoChange,
    selectedTrainDetails,
    passengerDistributionData,
    stationData,
    setNextRunFilename,
  ]);

  return (
    <div className="w-full h-full flex flex-col relative">{contentState}</div>
  );
};

export default MainContent;
