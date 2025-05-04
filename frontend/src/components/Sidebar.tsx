import React from "react";
import {
  IconTrain,
  IconLoader2,
  IconReplace,
  IconHistory,
  IconAlertCircle,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import SimulationSettingsCard from "@/components/SimulationSettingsCard";
import { cn } from "@/lib/utils";
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

interface SidebarProps {
  isSidebarCollapsed: boolean;
  isLoading: boolean;
  simulationSettings: any | null;
  showInitialState: boolean;
  isMapLoading: boolean;
  isClearConfirmOpen: boolean;
  setIsClearConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleLoadNewData: () => void;
  hasFetchedInitialHistory: boolean;
  handleFetchHistory: (fetchFullHistory?: boolean) => Promise<void>;
  setHasFetchedInitialHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setIsHistoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSimulating: boolean;
  isFullDayView: boolean;
  loadedSimulationId: number | null;
  hasSimulationData: boolean;
  simulatePassengers: boolean;
  onSimulatePassengersToggle: (checked: boolean) => void;
  hasResults: boolean;
  simulationInputFilename: string | null;
  handleFileSelect: (file: File | null, backendFilename: string | null) => void;
  apiError: string | null;
  handleRunSimulation: () => Promise<void>;
  nextRunFilename: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarCollapsed,
  isLoading,
  simulationSettings,
  showInitialState,
  isMapLoading,
  isClearConfirmOpen,
  setIsClearConfirmOpen,
  handleLoadNewData,
  hasFetchedInitialHistory,
  handleFetchHistory,
  setHasFetchedInitialHistory,
  setIsHistoryModalOpen,
  isSimulating,
  isFullDayView,
  loadedSimulationId,
  hasSimulationData,
  simulatePassengers,
  onSimulatePassengersToggle,
  hasResults,
  simulationInputFilename,
  handleFileSelect,
  apiError,
  handleRunSimulation,
  nextRunFilename,
}) => {
  return (
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
                          and does NOT reset your current settings adjustments.
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
              isSimulating={isSimulating || isMapLoading}
              isFullDayView={isFullDayView}
              loadedSimulationId={loadedSimulationId}
              hasSimulationData={hasSimulationData}
              simulatePassengers={simulatePassengers}
              onSimulatePassengersToggle={onSimulatePassengersToggle}
              hasResults={hasResults}
              simulationInputFilename={simulationInputFilename}
              nextRunFilename={nextRunFilename}
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
              onClick={handleRunSimulation}
              disabled={
                isSimulating ||
                isMapLoading ||
                !simulationSettings ||
                (simulatePassengers &&
                  !simulationInputFilename &&
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
  );
};

export default Sidebar;
