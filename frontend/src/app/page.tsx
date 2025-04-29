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
  IconUpload,
  IconSettings,
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
import MrtMap from "@/components/MrtMap";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  useSkipStop: boolean;
  stations: {
    name: string;
    distance: number;
    scheme?: "AB" | "A" | "B";
  }[];
}

// New interface for the global state sent to backend
interface SimulationInput {
  filename: string | null; // Store only the filename now
  config: SimulationSettings | null;
}

// Define the new interface for data passed to TrainInfo
interface TrainInfoData {
  id: number;
  direction: "northbound" | "southbound";
  status: string; // e.g., "At Station", "In Transit", "Turning Around", "Inactive"
  load: number; // Hardcoded 0 for now
  capacity: number;
  relevantStationName: string | null; // Current or next station
  scheduledTime: string | null; // Arrival or Departure time
}

// Define peak hour ranges (also needed here for setting initial time)
const PEAK_HOURS = {
  AM: { start: "07:00:00", end: "09:00:00" },
  PM: { start: "17:00:00", end: "20:00:00" },
};

export default function Home() {
  // State for uploaded file object - Store the File object if needed, or just filename
  // Let's store the File object for now, though only filename is sent for simulation run
  const [uploadedFileObject, setUploadedFileObject] = useState<File | null>(
    null
  );
  // State for processed passenger data from API (remains the same)
  const [passengerArrivalData, setPassengerArrivalData] =
    useState<PassengerArrivalData | null>(null);

  // --- State for Global JSON Input --- //
  // Filename is derived from uploadedFileObject.name when needed
  const [simulationInput, setSimulationInput] = useState<SimulationInput>({
    filename: null,
    config: null, // Config will be populated from simulationSettings on run
  });

  // --- Combined Settings State --- //
  const [simulationSettings, setSimulationSettings] =
    useState<SimulationSettings | null>(null);

  // State for simulation control/display
  const [simulationTime, setSimulationTime] = useState(PEAK_HOURS.AM.start); // Default start time
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [selectedTrainDetails, setSelectedTrainDetails] =
    useState<TrainInfoData | null>(null);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  // State for API call
  const [simulationResult, setSimulationResult] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false); // General loading state (used for settings fetch and sim run)
  const [isSimulating, setIsSimulating] = useState(false); // Specific state for simulation run API call
  const [apiError, setApiError] = useState<string | null>(null);

  // --- Toast Hook --- //
  const { toast } = useToast();

  // --- State for Sidebar Collapse --- //
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- Fetch Default Settings on Mount --- //
  useEffect(() => {
    const fetchDefaults = async () => {
      setIsLoading(true); // Use general loading for initial setup
      setApiError(null);
      console.log("Fetching default settings...");
      try {
        const response = await fetch(
          "http://localhost:5001/get_default_settings"
        );
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
        console.log("Received default settings:", defaults);

        // Add scheme to stations if not present
        const defaultScheme = [
          "AB",
          "A",
          "AB",
          "B",
          "AB",
          "A",
          "AB",
          "B",
          "AB",
          "A",
          "AB",
          "B",
          "AB",
        ];
        const stationsWithScheme = defaults.stations.map(
          (station: any, index: number) => ({
            ...station,
            scheme: defaultScheme[index] || "AB",
          })
        );

        // Set the simulation settings state with added fields
        setSimulationSettings({
          ...defaults,
          useSkipStop: false,
          stations: stationsWithScheme,
        });

        // Initially set the config part of simulationInput as well
        setSimulationInput((prev) => ({
          ...prev,
          config: {
            ...defaults,
            useSkipStop: false,
            stations: stationsWithScheme,
          },
        }));
      } catch (error: any) {
        console.error("Failed to fetch default settings:", error);
        setApiError(`Failed to load default settings: ${error.message}`);
        setSimulationSettings(null); // Ensure state is null on error
        setSimulationInput((prev) => ({ ...prev, config: null })); // Clear config on error
        // Toast Notification: Failed to load default settings
        toast({
          title: "Error Loading Settings",
          description: `Failed to load default simulation settings: ${error.message}. Please try refreshing.`,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false); // Finish initial loading
      }
    };

    fetchDefaults();
  }, [toast]);

  // Get station data based on current selection and simulation time
  const stationData = (() => {
    // Default structure including NB/SB placeholders
    let data = {
      stationId: selectedStation || 1,
      stationName: selectedStation
        ? simulationSettings?.stations[selectedStation - 1]?.name ??
          `Station ${selectedStation}`
        : simulationSettings?.stations[0]?.name ?? "Station 1",
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
          // Adjust key based on actual backend simulation result structure
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
                const dir = String(entry[directionKey]).toLowerCase();
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
              // console.error("Error parsing arrival time from result:", entry[arrivalTimeKey]);
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

  // Handle file selection (callback from CsvUpload after successful upload)
  const handleFileSelect = useCallback(
    (file: File | null) => {
      setUploadedFileObject(file); // Store the File object

      // Reset simulation results and related state when file changes/is removed
      if (file) {
        console.log(`File upload confirmed: ${file.name}`);
        // Update filename in simulationInput state
        setSimulationInput((prev) => ({ ...prev, filename: file.name }));
        // Reset things related to the previous simulation run
        setSimulationResult(null);
        setSelectedStation(null);
        setSelectedTrainId(null);
        setSelectedTrainDetails(null);
        setSimulationTime(PEAK_HOURS.AM.start); // Reset time to default start
        setIsSimulationRunning(false); // Ensure simulation is paused
        setApiError(null); // Clear any previous errors
        // Toast notification handled by CsvUpload
      } else {
        console.log("File removed or upload failed.");
        // Clear filename in simulationInput state
        setSimulationInput((prev) => ({ ...prev, filename: null }));
        // Optionally clear more state if needed when file is removed
        setSimulationResult(null);
        setSelectedStation(null);
        setSelectedTrainId(null);
        setSelectedTrainDetails(null);
        setIsSimulationRunning(false);
      }
    },
    [] // No dependencies needed, set functions are stable
  );

  // --- Handle Setting Changes (Updated) --- //
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
        return; // Ignore if event type is unexpected
      }

      if (name) {
        console.log(`Setting change: ${name} = ${value}`); // Debug log
        setSimulationSettings((prev) => {
          if (!prev) return null; // Should not happen if defaults loaded
          const updatedSettings = { ...prev, [name as string]: value };
          // Also update the config part of the global state
          setSimulationInput((prevInput) => ({
            ...prevInput,
            config: updatedSettings,
          }));
          return updatedSettings;
        });
      }
    },
    [] // No dependencies needed as setSimulationSettings/Input are stable
  );

  // --- Handle Station Distance Change (Unchanged) --- //
  const handleStationDistanceChange = useCallback(
    (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
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

        const updatedSettings = { ...prev, stations: updatedStations };
        // Also update the config part of the global state
        setSimulationInput((prevInput) => ({
          ...prevInput,
          config: updatedSettings,
        }));
        return updatedSettings;
      });
    },
    [] // No dependencies needed
  );

  // --- Handle Station Scheme Change --- //
  const handleStationSchemeChange = useCallback(
    (index: number, value: "AB" | "A" | "B") => {
      setSimulationSettings((prev) => {
        if (!prev) return null;

        // Create a new stations array with the updated scheme
        const updatedStations = prev.stations.map((station, i) => {
          if (i === index) {
            return { ...station, scheme: value };
          }
          return station;
        });

        console.log(
          `Station scheme change: Index ${index}, New Scheme ${value}`
        ); // Debug log

        const updatedSettings = { ...prev, stations: updatedStations };
        // Also update the config part of the global state
        setSimulationInput((prevInput) => ({
          ...prevInput,
          config: updatedSettings,
        }));
        return updatedSettings;
      });
    },
    [] // No dependencies needed
  );

  // --- Handle Skip-Stop Toggle --- //
  const handleSkipStopToggle = useCallback(
    (checked: boolean) => {
      setSimulationSettings((prev) => {
        if (!prev) return null;

        // Ensure schemeType is correctly typed as "Regular" | "Skip-Stop"
        const updatedSettings = {
          ...prev,
          useSkipStop: checked,
          schemeType: checked ? ("Skip-Stop" as const) : ("Regular" as const),
        };

        // Also update the config part of the global state
        setSimulationInput((prevInput) => ({
          ...prevInput,
          config: updatedSettings,
        }));
        return updatedSettings;
      });
    },
    [] // No dependencies needed
  );

  // Update simulation time state (Unchanged)
  const handleTimeUpdate = useCallback((time: string) => {
    // Prevent unnecessary re-renders if time hasn't changed
    setSimulationTime((prevTime) => {
      if (time !== prevTime) {
        return time;
      }
      return prevTime;
    });
  }, []);

  // Update simulation play/pause state
  const handleSimulationStateChange = useCallback(
    (isRunning: boolean) => {
      console.log("Simulation state change requested:", isRunning);
      // Ensure simulation result exists before starting
      if (isRunning && (!simulationResult || simulationResult.length === 0)) {
        console.warn("Start clicked, but simulationResult is null or empty.");
        toast({
          title: "Cannot Start Simulation",
          description:
            "Please run the simulation first to generate the timetable.",
          variant: "default", // Changed from warning
        });
        setIsSimulationRunning(false);
        return;
      }
      // Check simulationSettings (should always be populated if run was successful)
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

  // Update selected station state when a station is clicked on the map (Unchanged)
  const handleStationClick = useCallback(
    (stationId: number) => {
      console.log("Station clicked:", stationId);
      // Toggle selection: If same station clicked, deselect (set to null)
      setSelectedStation((prevSelected) =>
        prevSelected === stationId ? null : stationId
      );
      // Deselect train when station is clicked
      setSelectedTrainId(null);
      setSelectedTrainDetails(null);
    },
    [] // Removed selectedStation dependency, toggle logic doesn't need it
  );

  // --- NEW: Handle Train Click from Map --- //
  const handleTrainClick = useCallback(
    (trainId: number, details: TrainInfoData) => {
      console.log("Train clicked:", trainId, "Details:", details);
      // Toggle selection: If same train clicked, deselect
      setSelectedTrainId((prevSelected) =>
        prevSelected === trainId ? null : trainId
      );
      // Set details only if selecting, clear if deselecting
      if (selectedTrainId === trainId) {
        // If clicking the already selected train, deselect details
        setSelectedTrainDetails(null);
      } else {
        // Otherwise, set the new details
        setSelectedTrainDetails(details);
      }
      // Deselect station when train is clicked
      setSelectedStation(null);
    },
    [] // No dependencies needed
  );

  // Call the /run_simulation API with JSON data
  const handleRunSimulation = async () => {
    // Check prerequisites
    if (!simulationInput.filename) {
      // Check filename in state
      setApiError("Please upload a passenger data CSV file first.");
      toast({
        title: "Missing File",
        description: "Please upload a CSV file first.",
        variant: "destructive", // Changed from warning
      });
      return;
    }
    if (!simulationSettings) {
      // Check settings state
      setApiError("Simulation settings are missing or still loading.");
      toast({
        title: "Missing Settings",
        description: "Simulation settings not loaded.",
        variant: "destructive", // Changed from warning
      });
      return;
    }

    setIsSimulating(true); // Use dedicated loading state for this action
    setApiError(null);
    setSimulationResult(null); // Clear previous results

    // --- Transform settings for backend payload --- //
    if (!simulationSettings) {
      // This check is technically redundant due to earlier checks, but good practice
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
      .slice(1); // Slice(1) because the backend expects distances *between* stations

    // Add station schemes if skip-stop is enabled
    const stationSchemes = simulationSettings.useSkipStop
      ? simulationSettings.stations.map((station) => station.scheme || "AB")
      : [];

    // Destructure settings to exclude the original 'stations' key
    const { stations, ...otherSettings } = simulationSettings;

    // Create the payload with the new structure for config
    const payload = {
      filename: simulationInput.filename,
      config: {
        // Spread the other settings
        ...otherSettings,
        // Add the new separated arrays with camelCase keys
        stationNames: stationNames,
        stationDistances: stationDistances,
        // Include station schemes if skip-stop is enabled
        ...(simulationSettings.useSkipStop && {
          stationSchemes: stationSchemes,
        }),
      },
    };

    console.log("Sending request to /run_simulation API...");
    console.log("Payload (JSON):", payload);
    toast({
      title: "Running Simulation",
      description: "Requesting timetable from backend...",
      variant: "default",
    });

    try {
      // --- NEW API ENDPOINT and METHOD --- //
      const response = await fetch(
        "http://localhost:5001/run_simulation", // Updated endpoint
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json", // Set content type to JSON
          },
          body: JSON.stringify(payload), // Send JSON string
        }
      );

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

      // The response could come back in various formats, handle accordingly
      const resultData = await response.json();
      console.log("Simulation API Response:", resultData);

      let timetableData;

      // Check for known response formats based on simulation_id success message or actual timetable array
      if (resultData.simulation_id) {
        // Success message with simulation_id, need to fetch timetable data
        console.log("Simulation completed with ID:", resultData.simulation_id);

        // Additional call to fetch the timetable data for this simulation
        try {
          const timetableResponse = await fetch(
            `http://localhost:5001/get_timetable/${resultData.simulation_id}`,
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
          console.log("Timetable data fetched:", timetableData);
        } catch (timetableError: any) {
          console.error("Error fetching timetable:", timetableError);
          toast({
            title: "Timetable Fetch Error",
            description: `Simulation completed but couldn't fetch timetable: ${timetableError.message}`,
            variant: "destructive",
          });
          // Continue with empty array as fallback
          timetableData = [];
        }
      } else if (Array.isArray(resultData)) {
        // Direct timetable array in response
        timetableData = resultData;
      } else if (
        resultData.message === "Simulation completed successfully." &&
        resultData.simulation_id
      ) {
        // Success message with simulation ID
        console.log("Simulation completed with ID:", resultData.simulation_id);
        // Use empty array as placeholder since we don't have actual data yet
        timetableData = [];
      } else {
        // Unknown format, log and use empty array
        console.warn("Unexpected response format:", resultData);
        timetableData = [];
      }

      if (Array.isArray(timetableData)) {
        // We have a valid array of timetable entries
        console.log(
          `Updating simulationResult state with ${timetableData.length} entries.`
        );
        setSimulationResult(timetableData);

        // Reset time to the start of the AM Peak after successful run
        const defaultPeakStart = PEAK_HOURS.AM.start;
        console.log(
          `Resetting simulation time to default peak start: ${defaultPeakStart}`
        );
        setSimulationTime(defaultPeakStart);
        setIsSimulationRunning(false); // Start paused
        setMapRefreshKey((prev) => prev + 1); // Refresh map

        toast({
          title: "Simulation Complete",
          description: `Timetable generated successfully (${timetableData.length} entries).`,
          variant: "default",
        });
      } else {
        // Handle cases where we have a success response but no timetable data yet
        console.warn("No timetable data available yet:", timetableData);
        setSimulationResult([]); // Set to empty array
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
      setSimulationResult(null); // Clear results on error
      toast({
        title: "Simulation API Error",
        description: `Simulation failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false); // Finish simulation loading state
    }
  };

  // --- Function to handle loading new data --- //
  const handleLoadNewData = useCallback(() => {
    console.log("Resetting for new data upload...");
    // Use handleFileSelect(null) to trigger resets in this component
    handleFileSelect(null);
    // CsvUpload component handles resetting its own input/state via its handleRemoveFile logic
  }, [handleFileSelect]);

  // Determine if the main content area should show upload or simulation view
  // Show upload if no file *object* is stored (meaning no successful upload yet)
  const showUploadView = !uploadedFileObject;

  return (
    <main className="flex h-screen bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
      {/* Sidebar for Settings */}
      <aside
        className={cn(
          "h-full flex flex-col bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-0 p-0 overflow-hidden" : "w-[500px]"
        )}
      >
        {/* Only render sidebar content if not collapsed */}
        {!isSidebarCollapsed && (
          <>
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                MRT-3 Simulation
              </h2>
              <DarkModeToggle />
            </div>
            <div className="flex-grow overflow-y-auto p-4">
              {/* Loading Indicator for fetching default settings */}
              {isLoading && !simulationSettings && (
                <div className="flex justify-center items-center p-4">
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Loading default settings...</span>
                </div>
              )}

              {/* Load New Data Button - Show only if a file object exists */}
              {uploadedFileObject && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={handleLoadNewData}
                    // Disable if currently simulating
                    disabled={isSimulating}
                  >
                    <IconReplace className="mr-2 h-4 w-4" />
                    Clear Current Data & Settings
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
                      Configure simulation parameters. Applied when "Run
                      Simulation" is clicked.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="train" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="train" disabled={isSimulating}>
                          Train Settings
                        </TabsTrigger>
                        <TabsTrigger value="station" disabled={isSimulating}>
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
                              min="0"
                              value={simulationSettings.dwellTime}
                              onChange={handleSettingChange}
                              className="mt-1"
                              disabled={isSimulating}
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
                              min="0"
                              value={simulationSettings.turnaroundTime}
                              onChange={handleSettingChange}
                              className="mt-1"
                              disabled={isSimulating}
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
                              step="0.01"
                              min="0"
                              value={simulationSettings.acceleration}
                              onChange={handleSettingChange}
                              className="mt-1"
                              disabled={isSimulating}
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
                              step="0.01"
                              min="0"
                              value={simulationSettings.deceleration}
                              onChange={handleSettingChange}
                              className="mt-1"
                              disabled={isSimulating}
                            />
                          </div>
                          <div>
                            <Label htmlFor="maxSpeed">Max Speed (km/h)</Label>
                            <Input
                              id="maxSpeed"
                              name="maxSpeed"
                              type="number"
                              step="1"
                              min="0"
                              value={simulationSettings.maxSpeed}
                              onChange={handleSettingChange}
                              className="mt-1"
                              disabled={isSimulating}
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
                              step="1"
                              min="0"
                              value={simulationSettings.maxCapacity}
                              onChange={handleSettingChange}
                              className="mt-1"
                              disabled={isSimulating}
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Max passengers per train.
                            </p>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Station Settings Tab */}
                      <TabsContent value="station" className="space-y-4">
                        <div>
                          <Label className="text-base font-semibold">
                            Station Management
                          </Label>

                          {/* Skip-Stop Toggle */}
                          <div className="flex items-center space-x-2 mt-2 mb-4">
                            <Checkbox
                              id="useSkipStop"
                              checked={simulationSettings.useSkipStop}
                              onCheckedChange={(checked: boolean) =>
                                handleSkipStopToggle(checked)
                              }
                              disabled={isSimulating}
                            />
                            <label
                              htmlFor="useSkipStop"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Change Skip-Stop Scheme
                            </label>
                          </div>

                          <div className="border rounded-md mt-2 flex-grow">
                            <div className="grid grid-cols-16 gap-4 mb-2 font-medium text-xs sticky top-0 z-10 bg-white dark:bg-gray-800 px-4 py-2 border-b">
                              <div className="col-span-1">#</div>
                              <div className="col-span-5">Name</div>
                              {/* New column for scheme type */}
                              <div className="col-span-6">
                                Scheme Type
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  (Skip-Stop)
                                </span>
                              </div>
                              <div className="col-span-4">
                                Dist. from Prev (km)
                              </div>
                            </div>
                            <div className="px-4 pt-2 pb-4 max-h-full flex-grow">
                              {simulationSettings.stations.map(
                                (station, index) => (
                                  <div
                                    key={`station-${index}`}
                                    className="grid grid-cols-16 gap-4 items-center mb-2 text-xs"
                                  >
                                    <div className="col-span-1 text-gray-500">
                                      {index + 1}
                                    </div>
                                    <div className="col-span-5">
                                      {station.name}
                                    </div>
                                    {/* New scheme selector */}
                                    <div className="col-span-6">
                                      <Select
                                        disabled={
                                          !simulationSettings.useSkipStop ||
                                          isSimulating
                                        }
                                        value={station.scheme || "AB"}
                                        onValueChange={(value) =>
                                          handleStationSchemeChange(
                                            index,
                                            value as "AB" | "A" | "B"
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue placeholder="Select Scheme" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="AB">
                                            AB (Both Stop)
                                          </SelectItem>
                                          <SelectItem value="A">
                                            A (A Trains Only)
                                          </SelectItem>
                                          <SelectItem value="B">
                                            B (B Trains Only)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="col-span-4">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={station.distance}
                                        onChange={(e) =>
                                          handleStationDistanceChange(index, e)
                                        }
                                        // Disable first station and if simulating
                                        disabled={index === 0 || isSimulating}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
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
              {/* Display general API errors here as well */}
              {apiError && (
                <Alert variant="destructive" className="mb-4">
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleRunSimulation}
                // Disable button if no file uploaded, settings missing, or already simulating
                disabled={
                  !uploadedFileObject || isSimulating || !simulationSettings
                }
                className="w-full bg-mrt-blue hover:bg-blue-700 text-white h-12 text-lg font-semibold"
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

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-mrt-blue hover:bg-blue-700 text-white shadow-md transition-all duration-300 ease-in-out",
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

      {/* Main Content Area */}
      <div className="flex-grow h-full flex flex-col p-4 overflow-y-auto transition-all duration-300 ease-in-out">
        {showUploadView ? (
          // Show CSV Upload view
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
                {/* Pass handleFileSelect and null for initialFileName (it's handled internally now) */}
                <CsvUpload
                  onFileSelect={handleFileSelect}
                  // initialFileName={simulationInput.filename} // Remove initialFileName prop
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          // Show Map, Controls, and Station Info view
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            {/* Map and optional Station Info display */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              {/* Map display */}
              <div className="flex-1 min-h-0">
                <MrtMap
                  key={mapRefreshKey}
                  selectedStation={selectedStation}
                  onStationClick={handleStationClick}
                  selectedTrainId={selectedTrainId}
                  onTrainClick={handleTrainClick}
                  simulationTime={simulationTime}
                  isRunning={isSimulationRunning}
                  simulationTimetable={simulationResult}
                  // Pass station list and turnaround time from settings
                  stations={simulationSettings?.stations.map(
                    (station, index) => ({
                      ...station, // Keep name and distance
                      id: index + 1, // Assign ID based on index
                      x: 50 + index * 70, // Simple placeholder x coordinate
                      y: 150, // Simple placeholder y coordinate
                      severity: 1, // Default severity
                    })
                  )}
                  turnaroundTime={simulationSettings?.turnaroundTime}
                  maxCapacity={simulationSettings?.maxCapacity ?? 0}
                />
              </div>

              {/* Station details */}
              <div
                className={cn(
                  "flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
                  selectedStation !== null
                    ? "opacity-100 max-h-[500px] mt-4"
                    : "opacity-0 max-h-0 mt-0 pointer-events-none"
                )}
              >
                {selectedStation !== null &&
                  simulationResult && ( // Render only if selected and results exist
                    <StationInfo {...stationData} />
                  )}
              </div>

              {/* Train details - NEW */}
              <div
                className={cn(
                  "flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
                  selectedTrainId !== null && selectedTrainDetails !== null
                    ? "opacity-100 max-h-[500px] mt-4" // Show train info
                    : "opacity-0 max-h-0 mt-0 pointer-events-none" // Hide train info
                )}
              >
                {selectedTrainId !== null && selectedTrainDetails !== null && (
                  <TrainInfo {...selectedTrainDetails} /> // Display TrainInfo component
                )}
              </div>
            </div>

            {/* Simulation time controls */}
            <div className="flex-shrink-0">
              <SimulationController
                // Pass actual data range if available, otherwise keep defaults or disable
                startTime={PEAK_HOURS.AM.start}
                endTime={PEAK_HOURS.PM.end}
                onTimeUpdate={handleTimeUpdate}
                onSimulationStateChange={handleSimulationStateChange}
                isLoading={isSimulating} // Controller loading state tied to simulation run
                // Enable controls only when simulation results are available
                hasTimetableData={
                  !!simulationResult && simulationResult.length > 0
                }
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
