"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconTrain,
  IconUpload,
  IconSettings,
  IconMap,
  IconInfoCircle,
  IconPlayerPlay,
  IconLoader2,
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconReplace,
} from "@tabler/icons-react";
import CsvUpload from "@/components/CsvUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import MrtMap from "@/components/MrtMap";
import SimulationController from "@/components/SimulationController";
import StationInfo from "@/components/StationInfo";
import { TrainSchedule } from "@/components/MrtMap";
import {
  getStationPassengerData,
  getPassengerDistribution,
} from "@/lib/csvDataUtils";
import { parseTime, formatTime } from "@/lib/timeUtils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// Define interface for the passenger distribution
interface PassengerDistribution {
  hour: string;
  count: number;
}

// Define interface for the raw data (potentially less relevant now)
interface RawPassengerData {
  currentBoarding: number;
  currentAlighting: number;
  nextBoarding: number;
  nextAlighting: number;
  progress: number;
}

// Define type for the processed passenger arrival data from the API
type PassengerArrivalData = Record<number, Record<number, number>>; // { stationId: { hour: count } }

// Combined settings interface
interface SimulationSettings {
  dwellTime: number;
  turnaroundTime: number;
  acceleration: number;
  deceleration: number;
  maxSpeed: number;
  maxCapacity: number;
  schemeType: "Regular" | "Skip-Stop";
  stations: { name: string; distance: number }[];
}

// Define peak hour ranges (also needed here for setting initial time)
const PEAK_HOURS = {
  AM: { start: "07:00:00", end: "09:00:00" },
  PM: { start: "17:00:00", end: "20:00:00" },
};

export default function Home() {
  // State for uploaded file object
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  // State for processed passenger data from API
  const [passengerArrivalData, setPassengerArrivalData] =
    useState<PassengerArrivalData | null>(null);

  // --- Combined Settings State --- //
  const [simulationSettings, setSimulationSettings] =
    useState<SimulationSettings | null>(null);

  // State for simulation control/display
  const [simulationTime, setSimulationTime] = useState("05:00:00"); // Default start time based on backend
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  // State for API call
  const [simulationResult, setSimulationResult] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // --- Toast Hook ---
  const { toast } = useToast();

  // --- State for Sidebar Collapse ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- Fetch Default Settings on Mount ---
  useEffect(() => {
    const fetchDefaults = async () => {
      setIsLoading(true);
      setApiError(null);
      console.log("Fetching default settings...");
      try {
        const response = await fetch(
          "http://localhost:5001/get_default_settings"
        );
        if (!response.ok) {
          throw new Error(
            `API Error (${response.status}): ${response.statusText}`
          );
        }
        const defaults = await response.json();
        console.log("Received default settings:", defaults);

        // Directly set the combined simulation settings state
        setSimulationSettings({
          dwellTime: defaults.dwellTime,
          turnaroundTime: defaults.turnaroundTime,
          acceleration: defaults.acceleration,
          deceleration: defaults.deceleration,
          maxSpeed: defaults.maxSpeed,
          maxCapacity: defaults.maxCapacity,
          schemeType: defaults.schemeType,
          stations: defaults.stations,
        });
      } catch (error: any) {
        console.error("Failed to fetch default settings:", error);
        setApiError(`Failed to load default settings: ${error.message}`);
        setSimulationSettings(null); // Ensure state is null on error
        // Toast Notification: Failed to load default settings
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
  }, []); // Empty dependency array ensures this runs only once on mount

  // Get station data based on current selection and simulation time
  const stationData = (() => {
    // Default structure including NB/SB placeholders
    let data = {
      stationId: selectedStation || 1,
      stationName: selectedStation
        ? [
            "North Avenue",
            "Quezon Avenue",
            "GMA-Kamuning",
            "Cubao",
            "Santolan-Annapolis",
            "Ortigas",
            "Shaw Boulevard",
            "Boni Avenue",
            "Guadalupe",
            "Buendia",
            "Ayala",
            "Magallanes",
            "Taft Avenue",
          ][selectedStation - 1]
        : "North Avenue",
      waitingPassengers: 0, // Remains aggregate for now
      nextTrainArrivalNB: "--:--:--",
      nextTrainArrivalSB: "--:--:--",
      passengerFlowNB: { boarding: 0, alighting: 0 },
      passengerFlowSB: { boarding: 0, alighting: 0 },
      passengerDistribution: [] as PassengerDistribution[],
      rawData: null as any | null, // Update type later if needed
    };

    if (passengerArrivalData && selectedStation) {
      const stationArrivals = passengerArrivalData[selectedStation];
      if (stationArrivals) {
        // Convert {hour: count} to [{hour: string, count: number}] format
        data.passengerDistribution = Object.entries(stationArrivals).map(
          ([hour, count]) => ({
            hour: `${String(hour).padStart(2, "0")}:00`, // Format hour as HH:00
            count: count,
          })
        );
        // Sort distribution by hour
        data.passengerDistribution.sort((a, b) => a.hour.localeCompare(b.hour));
      }

      // Placeholder values for other fields - need logic based on simulation results
      data.waitingPassengers = 0; // TODO: Calculate based on arrivals/departures up to simulationTime
      data.passengerFlowNB = { boarding: 0, alighting: 0 }; // TODO: Derive from simulationResult
      data.passengerFlowSB = { boarding: 0, alighting: 0 }; // TODO: Derive from simulationResult
      data.rawData = null; // TODO: What should this be now?

      // --- Keep the logic for finding next train arrivals from simulationResult ---
      const currentTimeSeconds = parseTime(simulationTime);
      let nextArrivalNB: number | null = null;
      let nextArrivalSB: number | null = null;

      if (simulationResult) {
        for (const entry of simulationResult) {
          if (entry.NStation === selectedStation && entry["Arrival Time"]) {
            try {
              const arrivalSeconds = parseTime(entry["Arrival Time"]);
              if (arrivalSeconds > currentTimeSeconds) {
                const dir = entry.Direction.toLowerCase();
                if (
                  dir === "northbound" &&
                  (!nextArrivalNB || arrivalSeconds < nextArrivalNB)
                ) {
                  nextArrivalNB = arrivalSeconds;
                } else if (
                  dir === "southbound" &&
                  (!nextArrivalSB || arrivalSeconds < nextArrivalSB)
                ) {
                  nextArrivalSB = arrivalSeconds;
                }
              }
            } catch (e) {
              // console.error("Error parsing arrival time from result:", entry['Arrival Time']);
            }
          }
        }
      }

      // Assign formatted arrival times
      if (nextArrivalNB) {
        data.nextTrainArrivalNB = formatTime(nextArrivalNB);
      }
      if (nextArrivalSB) {
        data.nextTrainArrivalSB = formatTime(nextArrivalSB);
      }
    }

    return data;
  })();

  // Handle file upload: send to /process_passenger_data API
  const handleFileUpload = async (file: File) => {
    console.log("File selected:", file.name);
    setIsLoading(true);
    setApiError(null);
    setPassengerArrivalData(null); // Clear previous processed data
    setSimulationResult(null); // Clear previous simulation results
    setUploadedFile(null); // Clear previous file state

    const formData = new FormData();
    formData.append("passenger_data", file);

    console.log("Sending file to /process_passenger_data API...");
    // Toast Notification: Processing passenger data started
    toast({
      title: "Processing Data",
      description: `Processing passenger data from '${file.name}'...`,
      variant: "default",
    });

    try {
      const response = await fetch(
        "http://localhost:5001/process_passenger_data",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to parse error response." }));
        throw new Error(
          `API Error (${response.status}): ${
            errorData?.error || response.statusText
          }`
        );
      }

      const processedData = await response.json();
      console.log("Passenger data processed successfully:", processedData);
      setPassengerArrivalData(processedData);
      setUploadedFile(file);
      // Toast Notification: Passenger data processed successfully
      toast({
        title: "Data Processed",
        description: `Passenger data processed successfully for '${file.name}'.`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Passenger data processing failed:", error);
      setApiError(error.message || "Failed to process passenger data file.");
      setPassengerArrivalData(null);
      setUploadedFile(null);
      // Toast Notification: Error processing passenger data
      toast({
        title: "Data Processing Error",
        description: `Error processing passenger data: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handle Setting Changes --- //
  const handleSettingChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string,
    field?: string
  ) => {
    setSimulationSettings((prev) => {
      if (!prev) return null; // Should not happen if form is rendered

      let name: string;
      let value: any;

      // Handle RadioGroup case where value is passed directly
      if (typeof e === "string" && field) {
        name = field;
        value = e;
      } else if (typeof e === "object" && "target" in e) {
        // Handle standard input change event
        name = e.target.name;
        value =
          e.target.type === "number"
            ? parseFloat(e.target.value) || 0
            : e.target.value;
        // Special handling for integers if needed (e.g., capacity, dwell, turnaround)
        if (["dwellTime", "turnaroundTime", "maxCapacity"].includes(name)) {
          value = parseInt(e.target.value, 10) || 0;
        }
      } else {
        return prev; // Ignore if event type is unexpected
      }

      console.log(`Setting change: ${name} = ${value}`); // Debug log

      return { ...prev, [name]: value };
    });
  };

  // --- Handle Station Distance Change --- //
  const handleStationDistanceChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newDistance = parseFloat(event.target.value) || 0;
    setSimulationSettings((prev) => {
      if (!prev) return null;

      // Create a new stations array with the updated distance
      const updatedStations = prev.stations.map((station, i) => {
        if (i === index) {
          return { ...station, distance: newDistance };
        }
        return station;
      });

      console.log(
        `Station distance change: Index ${index}, New Distance ${newDistance}`
      ); // Debug log

      return { ...prev, stations: updatedStations };
    });
  };

  // Update simulation time state
  const handleTimeUpdate = useCallback((time: string) => {
    // Prevent unnecessary re-renders if time hasn't changed
    setSimulationTime((prevTime) => {
      if (time !== prevTime) {
        return time;
      }
      return prevTime;
    });
  }, []); // Empty dependency array, setSimulationTime is stable

  // Update simulation play/pause state
  const handleSimulationStateChange = useCallback(
    (isRunning: boolean) => {
      console.log("Simulation state change requested:", isRunning);
      // Ensure simulation result exists before starting
      if (isRunning && (!simulationResult || simulationResult.length === 0)) {
        console.warn("Start clicked, but simulationResult is null or empty.");
        alert(
          "Please run the simulation via the API first to get timetable data."
        );
        setIsSimulationRunning(false);
        return;
      }
      // Check simulationSettings before setting state
      if (isRunning && !simulationSettings) {
        alert(
          "Please configure and save settings before starting the simulation."
        );
        setIsSimulationRunning(false);
        return;
      }

      setIsSimulationRunning(isRunning);
      // Update map key to potentially force re-render if needed when starting
      if (isRunning) {
        setMapRefreshKey((prev) => prev + 1);
      }
    },
    [simulationResult, simulationSettings]
  );

  // Update selected station state when a station is clicked on the map
  const handleStationClick = useCallback(
    (stationId: number) => {
      console.log("Station clicked:", stationId);
      // Toggle selection: If same station clicked, deselect (set to null)
      setSelectedStation((prevSelected) =>
        prevSelected === stationId ? null : stationId
      );
    },
    [selectedStation]
  ); // Dependency needed to check previous value

  // Call the /run_simulation API with current settings
  const handleRunSimulation = async () => {
    // Check prerequisites: passenger data processed, settings loaded
    if (!uploadedFile) {
      setApiError("Please upload and process a passenger data CSV file first.");
      return;
    }
    // Check if settings have loaded
    if (!simulationSettings) {
      setApiError(
        "Default settings are still loading or failed to load. Please wait or refresh."
      );
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setSimulationResult(null);

    // Use the combined simulationSettings state directly as the payload
    const settingsPayload = simulationSettings;

    console.log("Sending request to /run_simulation API...");
    // Toast Notification: Simulation API request started
    toast({
      title: "Running Simulation",
      description: "Requesting simulation timetable from API...",
      variant: "default",
    });

    try {
      const response = await fetch("http://localhost:5001/run_simulation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsPayload), // Send combined settings
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to parse error response." }));
        throw new Error(
          `API Error (${response.status}): ${
            errorData?.error || response.statusText
          }`
        );
      }

      const resultData = await response.json();
      console.log("Simulation API Success:", resultData);

      // Log number of timetable entries received
      if (Array.isArray(resultData) && resultData.length > 0) {
        console.log(
          `Updating simulationResult state with ${resultData.length} entries.`
        );
      } else {
        console.warn(
          "Simulation API returned null, empty array, or non-array data:",
          resultData
        );
      }

      setSimulationResult(resultData);

      // Reset time to the start of the AM Peak
      const defaultPeakStart = PEAK_HOURS.AM.start;
      console.log(
        `Resetting simulation time to default peak start: ${defaultPeakStart}`
      );
      setSimulationTime(defaultPeakStart);

      setIsSimulationRunning(false); // Start paused
      setMapRefreshKey((prev) => prev + 1);
      // Toast Notification: Simulation API success
      toast({
        title: "Simulation Complete",
        description: `Simulation timetable generated successfully (${
          resultData?.length || 0
        } entries).`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Simulation API Failed:", error);
      setApiError(error.message || "An unknown error occurred");
      // Toast Notification: Simulation API failed
      toast({
        title: "Simulation API Error",
        description: `Simulation API failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Function to handle loading new data --- //
  const handleLoadNewData = () => {
    console.log("Resetting for new data upload...");
    setUploadedFile(null);
    setPassengerArrivalData(null);
    setSimulationResult(null);
    setSelectedStation(null);
    setSimulationTime(PEAK_HOURS.AM.start); // Reset time to default start
    setIsSimulationRunning(false); // Ensure simulation is paused
    setApiError(null); // Clear any previous errors
    // Reset other relevant states if necessary
  };

  return (
    <main className="flex h-screen bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
      {/* Sidebar for Settings */}
      <aside
        className={cn(
          "h-full flex flex-col bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-0 p-0 overflow-hidden" : "w-[500px]"
        )}
      >
        {/* Only render sidebar content if not collapsed to avoid unnecessary processing */}
        {!isSidebarCollapsed && (
          <>
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                MRT-3 Simulation
              </h2>
            </div>
            <div className="flex-grow overflow-y-auto p-4">
              {/* Loading Indicator for fetching default settings */}
              {isLoading && !simulationSettings && (
                <div className="flex justify-center items-center p-4">
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Loading default settings...</span>
                </div>
              )}

              {/* Load New Data Button */}
              {passengerArrivalData && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={handleLoadNewData}
                  >
                    <IconReplace className="mr-2 h-4 w-4" />
                    Load New Passenger Data
                  </Button>
                </div>
              )}

              {/* Settings Card - Render forms only when default settings are loaded */}
              {simulationSettings && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>
                      <IconSettings className="mr-2 inline-block h-5 w-5" />
                      Simulation Settings
                    </CardTitle>
                    <CardDescription>
                      Configure simulation parameters.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="train" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="train">Train Settings</TabsTrigger>
                        <TabsTrigger value="station">
                          Station Settings
                        </TabsTrigger>
                      </TabsList>

                      {/* Train Settings Tab */}
                      <TabsContent value="train" className="space-y-6">
                        {/* Basic Settings Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <Label htmlFor="dwellTime">Dwell Time (s)</Label>
                            <Input
                              id="dwellTime"
                              name="dwellTime"
                              type="number"
                              step="1"
                              value={simulationSettings.dwellTime}
                              onChange={handleSettingChange}
                              className="mt-1"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Train stop duration at stations.
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="turnaroundTime">
                              Turnaround Time (s)
                            </Label>
                            <Input
                              id="turnaroundTime"
                              name="turnaroundTime"
                              type="number"
                              step="1"
                              value={simulationSettings.turnaroundTime}
                              onChange={handleSettingChange}
                              className="mt-1"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Time to reverse at terminals.
                            </p>
                          </div>
                        </div>

                        {/* Advanced Settings Fields - Train Specs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <Label htmlFor="acceleration">
                              Acceleration (m/s²)
                            </Label>
                            <Input
                              id="acceleration"
                              name="acceleration"
                              type="number"
                              step="0.1"
                              value={simulationSettings.acceleration}
                              onChange={handleSettingChange}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="deceleration">
                              Deceleration (m/s²)
                            </Label>
                            <Input
                              id="deceleration"
                              name="deceleration"
                              type="number"
                              step="0.1"
                              value={simulationSettings.deceleration}
                              onChange={handleSettingChange}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="maxSpeed">Max Speed (km/h)</Label>
                            <Input
                              id="maxSpeed"
                              name="maxSpeed"
                              type="number"
                              value={simulationSettings.maxSpeed}
                              onChange={handleSettingChange}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {/* Advanced Settings Fields - Capacity & Scheme */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <Label htmlFor="maxCapacity">Max Capacity</Label>
                            <Input
                              id="maxCapacity"
                              name="maxCapacity"
                              type="number"
                              value={simulationSettings.maxCapacity}
                              onChange={handleSettingChange}
                              className="mt-1"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Max passengers per train.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Operational Scheme</Label>
                            <RadioGroup
                              name="schemeType"
                              value={simulationSettings.schemeType}
                              onValueChange={(value) =>
                                handleSettingChange(value, "schemeType")
                              } // Pass field name
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-3">
                                <RadioGroupItem
                                  value="Regular"
                                  id="scheme-regular"
                                />
                                <Label
                                  htmlFor="scheme-regular"
                                  className="font-normal"
                                >
                                  Regular (All stops)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-3">
                                <RadioGroupItem
                                  value="Skip-Stop"
                                  id="scheme-skipstop"
                                />
                                <Label
                                  htmlFor="scheme-skipstop"
                                  className="font-normal"
                                >
                                  Skip-Stop (A/B pattern)
                                </Label>
                              </div>
                            </RadioGroup>
                            <p className="text-sm text-muted-foreground pt-1">
                              Select train operation pattern.
                            </p>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Station Settings Tab */}
                      <TabsContent value="station" className="space-y-4">
                        {/* Advanced Settings Fields - Station List (Inputs for Distance) */}
                        <div>
                          <Label className="text-base font-semibold">
                            Station Management
                          </Label>
                          <div className="border rounded-md p-4 mt-2">
                            <div className="grid grid-cols-12 gap-4 mb-2 font-medium text-xs">
                              <div className="col-span-1">#</div>
                              <div className="col-span-7">Name</div>
                              <div className="col-span-4">
                                Dist. from Prev (km)
                              </div>
                            </div>
                            {simulationSettings.stations.map(
                              (station, index) => (
                                <div
                                  key={`station-${index}`}
                                  className="grid grid-cols-12 gap-4 items-center mb-1 text-xs"
                                >
                                  <div className="col-span-1 text-gray-500">
                                    {index + 1}
                                  </div>
                                  <div className="col-span-7">
                                    {station.name}
                                  </div>
                                  <div className="col-span-4">
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={station.distance}
                                      onChange={(e) =>
                                        handleStationDistanceChange(index, e)
                                      }
                                      disabled={index === 0} // Disable first station distance
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {/* Show error if default settings failed to load */}
              {apiError && !simulationSettings && (
                <Alert variant="destructive" className="mb-4">
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Loading Settings</AlertTitle>
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              )}
            </div>
            {/* Bottom area with Run Simulation button */}
            <div className="p-4 border-t mt-auto">
              <Button
                onClick={handleRunSimulation}
                // Disable button if prerequisites are not met
                disabled={!uploadedFile || isLoading || !simulationSettings}
                className="w-full bg-mrt-blue hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Please
                    wait...
                  </>
                ) : (
                  "Run Simulation API"
                )}
              </Button>
            </div>
          </>
        )}
      </aside>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 shadow-md transition-all duration-300 ease-in-out",
          isSidebarCollapsed
            ? "left-2" // Position when collapsed
            : "left-[490px]" // Position when expanded (just inside the sidebar edge)
        )}
        title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isSidebarCollapsed ? (
          <IconChevronRight size={18} />
        ) : (
          <IconChevronLeft size={18} />
        )}
      </button>

      {/* Main Content Area */}
      <div className="flex-grow h-full flex flex-col p-4 overflow-y-auto transition-all duration-300 ease-in-out">
        {!passengerArrivalData ? (
          // Show CSV Upload if passenger data hasn't been processed yet
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
                <CsvUpload onFileUpload={handleFileUpload} />
              </CardContent>
            </Card>
          </div>
        ) : (
          // Show Map, Controls, and Station Info once data is loaded
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            {/* Map and optional Station Info display */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              {/* Map display */}
              <div className="flex-1 min-h-0">
                <MrtMap
                  key={mapRefreshKey}
                  selectedStation={selectedStation}
                  onStationClick={handleStationClick}
                  simulationTime={simulationTime}
                  isRunning={isSimulationRunning}
                  simulationTimetable={simulationResult}
                  turnaroundTime={simulationSettings?.turnaroundTime}
                />
              </div>

              {/* Station details (shown when a station is selected) */}
              <div
                className={cn(
                  "flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden", // Added overflow-hidden
                  selectedStation !== null
                    ? "opacity-100 max-h-[500px] mt-4" // Visible state with margin (adjust max-h if needed)
                    : "opacity-0 max-h-0 mt-0" // Hidden state, no margin
                )}
              >
                {/* Render StationInfo only when selected to avoid unnecessary processing */}
                {selectedStation !== null && <StationInfo {...stationData} />}
              </div>
            </div>

            {/* Simulation time controls (Moved below map/station info) */}
            <div className="flex-shrink-0">
              <SimulationController
                startTime="05:00" // Example overall start
                endTime="22:00" // Example overall end
                onTimeUpdate={handleTimeUpdate}
                onSimulationStateChange={handleSimulationStateChange}
                isLoading={isLoading}
                hasTimetableData={
                  simulationResult !== null && simulationResult.length > 0
                }
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
