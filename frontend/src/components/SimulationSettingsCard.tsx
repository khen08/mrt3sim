"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  IconSettings,
  IconClock,
  IconInfoCircle,
  IconFile,
  IconReplace,
  IconRotateClockwise,
  IconLoader2,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import React, { useRef, useEffect, useState } from "react";
import { cn, formatFileName } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulationStore";
import { useFileStore } from "@/store/fileStore";
import { useAPIStore } from "@/store/apiStore";
import { toast } from "@/components/ui/use-toast";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";

// Define SimulationSettings type locally (copied from page.tsx)
interface SimulationSettings {
  dwellTime: number;
  turnaroundTime: number;
  trainSpecs: {
    acceleration: number;
    deceleration: number;
    cruisingSpeed: number;
    passthroughSpeed: number;
    maxCapacity: number;
  };
  schemeType: "REGULAR" | "SKIP-STOP";
  schemePattern: string[];
  stations: {
    name: string;
    distance: number;
    scheme?: "AB" | "A" | "B";
  }[];
  servicePeriods: ServicePeriodConfig[];
}

// Define the ServicePeriod interface to match the backend structure
interface ServicePeriodConfig {
  NAME: string;
  START_HOUR: number;
  REGULAR_TRAIN_COUNT: number;
  SKIP_STOP_TRAIN_COUNT: number;
  REGULAR_HEADWAY?: number;
  SKIP_STOP_HEADWAY?: number;
  REGULAR_LOOP_TIME_MINUTES?: number;
  SKIP_STOP_LOOP_TIME_MINUTES?: number;
}

// Define interface for the simulation settings passed as props
interface SimulationSettingsCardProps {
  isSimulating: boolean;
  isFullDayView: boolean;
  hasSimulationData: boolean;
  hasResults: boolean;
  handleFileSelect: (file: File | null, backendFilename: string | null) => void;
}

const SimulationSettingsCard: React.FC<SimulationSettingsCardProps> = ({
  isSimulating,
  isFullDayView,
  hasSimulationData,
  hasResults,
  handleFileSelect,
}: SimulationSettingsCardProps) => {
  // Get state from Zustand store
  const simulationSettings = useSimulationStore(
    (state) => state.simulationSettings
  );
  const loadedSimulationId = useSimulationStore(
    (state) => state.loadedSimulationId
  );
  const simulatePassengers = useSimulationStore(
    (state) => state.simulatePassengers
  );
  const simulationInput = useSimulationStore((state) => state.simulationInput);
  const nextRunFilename = useSimulationStore((state) => state.nextRunFilename);

  // Get actions from Zustand store
  const updateSimulationSetting = useSimulationStore(
    (state) => state.updateSimulationSetting
  );
  const updateStationDistance = useSimulationStore(
    (state) => state.updateStationDistance
  );
  const updateStationScheme = useSimulationStore(
    (state) => state.updateStationScheme
  );
  const toggleSkipStop = useSimulationStore((state) => state.toggleSkipStop);
  const setSimulatePassengers = useSimulationStore(
    (state) => state.setSimulatePassengers
  );
  const setNextRunFilename = useSimulationStore(
    (state) => state.setNextRunFilename
  );

  // Get upload status from fileStore
  const uploadStatus = useFileStore((state) => state.uploadStatus);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store default settings for per-input reset
  const [defaultSettings, setDefaultSettings] =
    useState<SimulationSettings | null>(null);
  useEffect(() => {
    useAPIStore
      .getState()
      .fetchDefaultSettings()
      .then((defaults) => {
        if (defaults) setDefaultSettings(defaults);
      });
  }, []);

  if (!simulationSettings) {
    // Render nothing or a loading indicator if settings are not yet loaded
    return null;
  }

  const { stations } = simulationSettings;
  const isSkipStop = simulationSettings.schemeType === "SKIP-STOP";

  const handleSettingChange = (
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
      const inputValue = e.target.value;

      // For number inputs, handle them differently
      if (e.target.type === "number") {
        // Remove leading zeros by converting to string first
        if (inputValue !== "") {
          // Parse as number and then back to string to remove leading zeros
          const numValue = parseFloat(inputValue);
          if (!isNaN(numValue)) {
            value = numValue;
          } else {
            value = 0;
          }
        } else {
          // Empty input - use 0 for the model but display empty
          value = 0;
        }
      } else {
        value = inputValue;
      }

      if (["dwellTime", "turnaroundTime"].includes(name)) {
        if (inputValue !== "") {
          // Parse and remove leading zeros
          const numValue = parseInt(inputValue, 10);
          if (!isNaN(numValue)) {
            value = numValue;
          } else {
            value = 0;
          }
        } else {
          value = 0;
        }
      }

      // Handle train specs properties
      if (
        [
          "acceleration",
          "deceleration",
          "cruisingSpeed",
          "passthroughSpeed",
          "maxCapacity",
        ].includes(name)
      ) {
        if (name === "maxCapacity") {
          if (inputValue !== "") {
            // Parse and remove leading zeros
            const numValue = parseInt(inputValue, 10);
            if (!isNaN(numValue)) {
              value = numValue;
            } else {
              value = 0;
            }
          } else {
            value = 0;
          }
        }

        // For train specs, update the nested object
        updateSimulationSetting("trainSpecs", {
          ...simulationSettings.trainSpecs,
          [name]: value,
        });
        return; // Exit early since we've handled the update
      }
    } else {
      return;
    }

    if (name) {
      updateSimulationSetting(name, value);
    }
  };

  const handleSimulatePassengersToggle = (checked: boolean) => {
    setSimulatePassengers(checked);

    // If enabling passenger simulation
    if (checked) {
      // If simulation is loaded and has existing passenger file
      if (loadedSimulationId && simulationInput.filename) {
        // Make sure fileStore has proper data to show "inherited" file
        useFileStore.setState({
          uploadedFileName: simulationInput.filename,
          uploadStatus: {
            success: true,
            message: "Inherited from loaded simulation",
          },
          validationStatus: "valid",
          uploadSource: "settings-change",
        });

        useFileStore.getState().updateFileMetadata({
          isInherited: true,
          simulationId: loadedSimulationId,
          isRequired: false,
        });

        toast({
          title: "Passenger Simulation Enabled",
          description: `Using inherited file: ${simulationInput.filename}`,
          variant: "default",
        });
      }
      // If no file is selected yet
      else if (!nextRunFilename) {
        toast({
          title: "Passenger Simulation Enabled",
          description: "Please select a CSV file for passenger data.",
          variant: "default",
        });
      }
    } else {
      // If disabling passenger simulation, keep the file reference for later
      // but update UI to show it's not being used
      toast({
        title: "Passenger Simulation Disabled",
        description:
          "Train simulation will run without passenger boarding/alighting.",
        variant: "default",
      });
    }
  };

  // Determine if a passenger data file is needed but missing
  const needsFileUpload =
    simulatePassengers && !simulationInput.filename && !nextRunFilename;

  // Helper to reset a single field to default
  const handleResetField = (field: string) => {
    if (!defaultSettings) return;
    if (["dwellTime", "turnaroundTime"].includes(field)) {
      updateSimulationSetting(field, (defaultSettings as any)[field]);
    } else if (
      [
        "acceleration",
        "deceleration",
        "cruisingSpeed",
        "passthroughSpeed",
        "maxCapacity",
      ].includes(field)
    ) {
      updateSimulationSetting("trainSpecs", {
        ...simulationSettings.trainSpecs,
        [field]: (defaultSettings.trainSpecs as any)[field],
      });
    }
  };

  // Helper to reset a single service period field
  const handleResetServicePeriodField = (
    index: number,
    field: "REGULAR_TRAIN_COUNT" | "SKIP_STOP_TRAIN_COUNT"
  ) => {
    if (!defaultSettings) return;
    const updatedPeriods = [...simulationSettings.servicePeriods];
    updatedPeriods[index] = {
      ...updatedPeriods[index],
      [field]: defaultSettings.servicePeriods[index][field],
    };
    updateSimulationSetting("servicePeriods", updatedPeriods);
  };

  // Add this helper for station scheme reset:
  const handleResetStationScheme = (index: number) => {
    if (!defaultSettings) return;
    const defaultScheme = defaultSettings.stations[index]?.scheme || "AB";
    updateStationScheme(index, defaultScheme);
  };

  // Add this helper for START_HOUR reset:
  const handleResetServicePeriodStartHour = (index: number) => {
    if (!defaultSettings) return;
    const updatedPeriods = [...simulationSettings.servicePeriods];
    updatedPeriods[index] = {
      ...updatedPeriods[index],
      START_HOUR: defaultSettings.servicePeriods[index].START_HOUR,
    };
    updateSimulationSetting("servicePeriods", updatedPeriods);
  };

  return (
    <Card className="simulation-settings mb-4 relative">
      {/* Loading overlay */}
      {isSimulating && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-md">
          <IconLoader2 className="h-10 w-10 animate-spin text-mrt-blue mb-4" />
          <TextShimmer
            as="p"
            className="text-center font-medium"
            duration={1.5}
          >
            Loading simulation settings...
          </TextShimmer>
        </div>
      )}

      <CardHeader>
        {/* Wrap title and add toggle icon */}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <IconSettings className="mr-2 inline-block h-5 w-5" />
            Simulation Settings
          </CardTitle>
          {/* Add Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Call fetchDefaultSettings and update current settings
              useAPIStore
                .getState()
                .fetchDefaultSettings()
                .then((defaults) => {
                  if (defaults) {
                    useSimulationStore
                      .getState()
                      .setSimulationSettings(defaults);
                    useSimulationStore
                      .getState()
                      .setActiveSimulationSettings(defaults);
                  }
                });
            }}
            disabled={isSimulating}
            className="text-xs"
          >
            <IconRotateClockwise size={14} className="mr-1" /> Reset to Default
            Settings
          </Button>
        </div>
        <CardDescription>
          Configure simulation parameters. Applied when "Run Simulation" is
          clicked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* --- Display Loaded Simulation ID --- */}
        {loadedSimulationId !== null && (
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-center text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Loaded Simulation ID: <strong>{loadedSimulationId}</strong>
          </div>
        )}

        {/* New Toggle */}
        <div className="flex items-center space-x-2 p-3 border bg-muted/50 rounded-md">
          <Checkbox
            id="simulatePassengers"
            checked={simulatePassengers}
            onCheckedChange={handleSimulatePassengersToggle}
            disabled={isSimulating} // Disable while simulating
          />
          <label
            htmlFor="simulatePassengers"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Simulate Passenger Flow (Requires CSV)
          </label>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconInfoCircle
                  size={16}
                  className="text-muted-foreground ml-1 cursor-help"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[250px]">
                  If checked, requires a passenger data CSV. If unchecked, the
                  simulation runs based on train operational logic only (no
                  passenger boarding/alighting).
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Conditionally show file information card only if a simulation is loaded AND passenger simulation is enabled */}
        {simulatePassengers && loadedSimulationId !== null && (
          <Card
            className={cn(
              "mt-2 p-2",
              needsFileUpload
                ? "border-amber-400 dark:border-amber-700"
                : "border-blue-400 dark:border-blue-700"
            )}
          >
            <div className="flex items-start gap-2 justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-xs uppercase font-semibold mb-0.5",
                      needsFileUpload
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-blue-700 dark:text-blue-300"
                    )}
                  >
                    {needsFileUpload
                      ? "Passenger data required"
                      : "Selected for next run:"}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium truncate",
                      needsFileUpload
                        ? "text-amber-800 dark:text-amber-200"
                        : "text-blue-800 dark:text-blue-200"
                    )}
                  >
                    {needsFileUpload
                      ? "No file selected yet"
                      : formatFileName(
                          simulationInput.filename ||
                            nextRunFilename ||
                            "Unknown file"
                        )}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      needsFileUpload
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    {needsFileUpload
                      ? "Please select a file to proceed with passenger simulation"
                      : loadedSimulationId &&
                        simulationInput.filename &&
                        !nextRunFilename
                      ? "Inherited from loaded simulation"
                      : nextRunFilename
                      ? "Newly uploaded file"
                      : "From previous run"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {/* Hidden file input */}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Enable passenger simulation when selecting a file
                      if (!simulatePassengers) {
                        setSimulatePassengers(true);
                      }

                      // Use the uploadFile function from fileStore with settings-change source
                      const result = await useFileStore
                        .getState()
                        .uploadFile(file, "settings-change");
                      if (result.success && result.filename) {
                        // Set the next run filename directly without changing UI
                        setNextRunFilename(result.filename);

                        // Update the file selection state for the next run (but not the current UI)
                        handleFileSelect(file, result.filename);

                        // Notify the user with a toast
                        toast({
                          title: "File Changed Successfully",
                          description: `New file "${file.name}" will be used for the next simulation run.`,
                          variant: "default",
                        });

                        useFileStore.getState().setUploadStatus({
                          success: true,
                          message: "File uploaded successfully",
                        });
                      } else {
                        // Handle CSV format errors with more details
                        if (result.errorType === "format_error") {
                          useFileStore.getState().setUploadStatus({
                            success: false,
                            message: result.error || "Invalid file format",
                            details: result.details || [],
                            errorType: "format_error",
                          });

                          // Show toast with detailed error
                          toast({
                            title: "CSV Format Error",
                            description:
                              result.error ||
                              "Invalid CSV format. Please check the file format and try again.",
                            variant: "destructive",
                          });
                        } else {
                          useFileStore.getState().setUploadStatus({
                            success: false,
                            message: result.error || "Upload failed",
                            errorType:
                              (result.errorType as
                                | "server_error"
                                | "network_error"
                                | "format_error") || "server_error",
                          });
                        }
                      }
                    }
                  }}
                />
                <Button
                  variant={needsFileUpload ? "default" : "outline"}
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSimulating}
                  className={
                    needsFileUpload
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : ""
                  }
                >
                  <IconReplace size={14} className="mr-1" />{" "}
                  {needsFileUpload ? "Select File" : "Change"}
                </Button>
              </div>
            </div>
            {/* Show upload status if present */}
            {uploadStatus && (
              <div
                className={`mt-2 text-xs ${
                  uploadStatus.success
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {uploadStatus.message}
              </div>
            )}
          </Card>
        )}

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
                <Label htmlFor="dwellTime">Dwell Time</Label>
                <div className="relative mt-1">
                  <Input
                    id="dwellTime"
                    name="dwellTime"
                    type="number"
                    step="1"
                    min="0"
                    pattern="[1-9][0-9]*"
                    inputMode="numeric"
                    value={simulationSettings.dwellTime || ""}
                    onChange={handleSettingChange}
                    className="pr-20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-10 top-0 bottom-0 flex items-center pr-2 text-sm text-muted-foreground pointer-events-none">
                    seconds
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => handleResetField("dwellTime")}
                    disabled={isSimulating || !defaultSettings}
                    tabIndex={-1}
                    aria-label="Reset to default"
                  >
                    <IconRotateClockwise size={16} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Passengers board/alight time
                </p>
              </div>
              <div>
                <Label htmlFor="turnaroundTime">Turnaround Time</Label>
                <div className="relative mt-1">
                  <Input
                    id="turnaroundTime"
                    name="turnaroundTime"
                    type="number"
                    step="1"
                    min="0"
                    pattern="[1-9][0-9]*"
                    inputMode="numeric"
                    value={simulationSettings.turnaroundTime || ""}
                    onChange={handleSettingChange}
                    className="pr-20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-10 top-0 bottom-0 flex items-center pr-2 text-sm text-muted-foreground pointer-events-none">
                    seconds
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => handleResetField("turnaroundTime")}
                    disabled={isSimulating || !defaultSettings}
                    tabIndex={-1}
                    aria-label="Reset to default"
                  >
                    <IconRotateClockwise size={16} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Switching directions at endpoints
                </p>
              </div>
            </div>

            {/* Advanced Settings Fields - Train Specs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="acceleration">Acceleration</Label>
                <div className="relative mt-1">
                  <Input
                    id="acceleration"
                    name="acceleration"
                    type="number"
                    step="0.01"
                    min="0"
                    pattern="[0-9]*\.?[0-9]*"
                    inputMode="decimal"
                    value={simulationSettings.trainSpecs.acceleration || ""}
                    onChange={handleSettingChange}
                    className="pr-20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-10 top-0 bottom-0 flex items-center pr-2 text-sm text-muted-foreground pointer-events-none">
                    m/s²
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => handleResetField("acceleration")}
                    disabled={isSimulating || !defaultSettings}
                    tabIndex={-1}
                    aria-label="Reset to default"
                  >
                    <IconRotateClockwise size={16} />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="deceleration">Deceleration</Label>
                <div className="relative mt-1">
                  <Input
                    id="deceleration"
                    name="deceleration"
                    type="number"
                    step="0.01"
                    min="0"
                    pattern="[0-9]*\.?[0-9]*"
                    inputMode="decimal"
                    value={simulationSettings.trainSpecs.deceleration || ""}
                    onChange={handleSettingChange}
                    className="pr-20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-10 top-0 bottom-0 flex items-center pr-2 text-sm text-muted-foreground pointer-events-none">
                    m/s²
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => handleResetField("deceleration")}
                    disabled={isSimulating || !defaultSettings}
                    tabIndex={-1}
                    aria-label="Reset to default"
                  >
                    <IconRotateClockwise size={16} />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="cruisingSpeed">Max Speed</Label>
                <div className="relative mt-1">
                  <Input
                    id="cruisingSpeed"
                    name="cruisingSpeed"
                    type="number"
                    step="1"
                    min="0"
                    pattern="[1-9][0-9]*"
                    inputMode="numeric"
                    value={simulationSettings.trainSpecs.cruisingSpeed || ""}
                    onChange={handleSettingChange}
                    className="pr-20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-10 top-0 bottom-0 flex items-center pr-2 text-sm text-muted-foreground pointer-events-none">
                    km/h
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => handleResetField("cruisingSpeed")}
                    disabled={isSimulating || !defaultSettings}
                    tabIndex={-1}
                    aria-label="Reset to default"
                  >
                    <IconRotateClockwise size={16} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Advanced Settings Fields - Capacity & Scheme */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="maxCapacity">Max Capacity</Label>
                <div className="relative mt-1">
                  <Input
                    id="maxCapacity"
                    name="maxCapacity"
                    type="number"
                    step="1"
                    min="0"
                    pattern="[1-9][0-9]*"
                    inputMode="numeric"
                    value={simulationSettings.trainSpecs.maxCapacity || ""}
                    onChange={handleSettingChange}
                    className="pr-20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.value = "";
                      }
                    }}
                  />
                  <span className="absolute right-10 top-0 bottom-0 flex items-center pr-2 text-sm text-muted-foreground pointer-events-none">
                    pax
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                    onClick={() => handleResetField("maxCapacity")}
                    disabled={isSimulating || !defaultSettings}
                    tabIndex={-1}
                    aria-label="Reset to default"
                  >
                    <IconRotateClockwise size={16} />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Max passengers per train.
                </p>
              </div>
            </div>

            {/* Service Periods Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Service Periods
                </Label>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconInfoCircle
                        size={16}
                        className="text-muted-foreground ml-1 cursor-help"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[250px]">
                        Define the train service periods throughout the day.
                        Each period has a starting hour and how many trains
                        should be in service for Regular and Skip-Stop.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Tabs defaultValue="regular" className="w-full">
                <TabsList className="mb-2 w-fit">
                  <TabsTrigger value="regular" disabled={isSimulating}>
                    Regular
                  </TabsTrigger>
                  <TabsTrigger value="skipstop" disabled={isSimulating}>
                    Skip-Stop
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="regular">
                  <div className="border rounded-md">
                    <div className="grid grid-cols-12 gap-4 mb-2 font-medium text-xs sticky top-0 z-10 bg-card px-4 py-2 border-b">
                      <div className="col-span-6">Period Name</div>
                      <div className="col-span-3">Start Hour</div>
                      <div className="col-span-3">Regular Train Count</div>
                    </div>
                    <div className="px-2 pt-2 pb-4 max-h-[250px] overflow-y-auto">
                      {simulationSettings.servicePeriods &&
                        simulationSettings.servicePeriods.map(
                          (period, index) => (
                            <div
                              key={`period-regular-${index}`}
                              className="grid grid-cols-12 gap-4 items-center mb-2 text-xs"
                            >
                              <div className="col-span-6">
                                <Input
                                  value={period.NAME}
                                  disabled={true}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div className="col-span-3 relative">
                                <Input
                                  type="number"
                                  min="0"
                                  max="23"
                                  pattern="[0-9]*"
                                  inputMode="numeric"
                                  value={period.START_HOUR || ""}
                                  onChange={(e) => {
                                    const updatedPeriods = [
                                      ...simulationSettings.servicePeriods,
                                    ];
                                    const value =
                                      e.target.value === ""
                                        ? 0
                                        : parseInt(e.target.value, 10) || 0;
                                    updatedPeriods[index] = {
                                      ...period,
                                      START_HOUR: value,
                                    };
                                    updateSimulationSetting(
                                      "servicePeriods",
                                      updatedPeriods
                                    );
                                  }}
                                  onFocus={(e) => {
                                    if (e.target.value === "0") {
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={isSimulating}
                                  className="h-7 text-xs pr-10"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                                  onClick={() =>
                                    handleResetServicePeriodStartHour(index)
                                  }
                                  disabled={isSimulating || !defaultSettings}
                                  tabIndex={-1}
                                  aria-label="Reset to default"
                                >
                                  <IconRotateClockwise size={14} />
                                </Button>
                              </div>
                              <div className="col-span-3 relative">
                                <Input
                                  type="number"
                                  min="1"
                                  pattern="[1-9][0-9]*"
                                  inputMode="numeric"
                                  value={period.REGULAR_TRAIN_COUNT || ""}
                                  onChange={(e) => {
                                    const updatedPeriods = [
                                      ...simulationSettings.servicePeriods,
                                    ];
                                    const value =
                                      e.target.value === ""
                                        ? 0
                                        : Math.max(
                                            1,
                                            parseInt(e.target.value, 10) || 1
                                          );
                                    updatedPeriods[index] = {
                                      ...period,
                                      REGULAR_TRAIN_COUNT: value,
                                    };
                                    updateSimulationSetting(
                                      "servicePeriods",
                                      updatedPeriods
                                    );
                                  }}
                                  onFocus={(e) => {
                                    if (e.target.value === "0") {
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={isSimulating}
                                  className="h-7 text-xs pr-10"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                                  onClick={() =>
                                    handleResetServicePeriodField(
                                      index,
                                      "REGULAR_TRAIN_COUNT"
                                    )
                                  }
                                  disabled={isSimulating || !defaultSettings}
                                  tabIndex={-1}
                                  aria-label="Reset to default"
                                >
                                  <IconRotateClockwise size={14} />
                                </Button>
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="skipstop">
                  <div className="border rounded-md">
                    <div className="grid grid-cols-12 gap-4 mb-2 font-medium text-xs sticky top-0 z-10 bg-card px-4 py-2 border-b">
                      <div className="col-span-6">Period Name</div>
                      <div className="col-span-3">Start Hour</div>
                      <div className="col-span-3">Skip-Stop Train Count</div>
                    </div>
                    <div className="px-2 pt-2 pb-4 max-h-[250px] overflow-y-auto">
                      {simulationSettings.servicePeriods &&
                        simulationSettings.servicePeriods.map(
                          (period, index) => (
                            <div
                              key={`period-skipstop-${index}`}
                              className="grid grid-cols-12 gap-4 items-center mb-2 text-xs"
                            >
                              <div className="col-span-6">
                                <Input
                                  value={period.NAME}
                                  disabled={true}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div className="col-span-3 relative">
                                <Input
                                  type="number"
                                  min="0"
                                  max="23"
                                  pattern="[0-9]*"
                                  inputMode="numeric"
                                  value={period.START_HOUR || ""}
                                  onChange={(e) => {
                                    const updatedPeriods = [
                                      ...simulationSettings.servicePeriods,
                                    ];
                                    const value =
                                      e.target.value === ""
                                        ? 0
                                        : parseInt(e.target.value, 10) || 0;
                                    updatedPeriods[index] = {
                                      ...period,
                                      START_HOUR: value,
                                    };
                                    updateSimulationSetting(
                                      "servicePeriods",
                                      updatedPeriods
                                    );
                                  }}
                                  onFocus={(e) => {
                                    if (e.target.value === "0") {
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={isSimulating}
                                  className="h-7 text-xs pr-10"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                                  onClick={() =>
                                    handleResetServicePeriodStartHour(index)
                                  }
                                  disabled={isSimulating || !defaultSettings}
                                  tabIndex={-1}
                                  aria-label="Reset to default"
                                >
                                  <IconRotateClockwise size={14} />
                                </Button>
                              </div>
                              <div className="col-span-3 relative">
                                <Input
                                  type="number"
                                  min="1"
                                  pattern="[1-9][0-9]*"
                                  inputMode="numeric"
                                  value={period.SKIP_STOP_TRAIN_COUNT || ""}
                                  onChange={(e) => {
                                    const updatedPeriods = [
                                      ...simulationSettings.servicePeriods,
                                    ];
                                    const value =
                                      e.target.value === ""
                                        ? 0
                                        : Math.max(
                                            1,
                                            parseInt(e.target.value, 10) || 1
                                          );
                                    updatedPeriods[index] = {
                                      ...period,
                                      SKIP_STOP_TRAIN_COUNT: value,
                                    };
                                    updateSimulationSetting(
                                      "servicePeriods",
                                      updatedPeriods
                                    );
                                  }}
                                  onFocus={(e) => {
                                    if (e.target.value === "0") {
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={isSimulating}
                                  className="h-7 text-xs pr-10"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                                  onClick={() =>
                                    handleResetServicePeriodField(
                                      index,
                                      "SKIP_STOP_TRAIN_COUNT"
                                    )
                                  }
                                  disabled={isSimulating || !defaultSettings}
                                  tabIndex={-1}
                                  aria-label="Reset to default"
                                >
                                  <IconRotateClockwise size={14} />
                                </Button>
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* Station Settings Tab */}
          <TabsContent value="station" className="space-y-4">
            {/* Place Label and Toggle on the same row */}
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold">
                Station Management
              </Label>
              {/* Skip-Stop Toggle removed */}
            </div>

            <div className="border rounded-md flex-grow">
              <div className="grid grid-cols-16 gap-4 mb-2 font-medium text-xs sticky top-0 z-10 bg-card px-4 py-2 border-b">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Name</div>
                {/* New column for scheme type */}
                <div className="col-span-6">Scheme Pattern</div>
                <div className="col-span-4">Dist. from Prev (km)</div>
              </div>
              <div className="px-4 pt-2 pb-4 max-h-full flex-grow">
                {stations.map(
                  (
                    station: {
                      name: string;
                      distance: number;
                      scheme?: "AB" | "A" | "B";
                    },
                    index: number
                  ) => (
                    <div
                      key={`station-${index}`}
                      className="grid grid-cols-16 gap-4 items-center mb-2 text-xs"
                    >
                      <div className="col-span-1 text-gray-500">
                        {index + 1}
                      </div>
                      <div className="col-span-5">{station.name}</div>
                      {/* Modified scheme selector - always enabled */}
                      <div className="col-span-6 relative flex items-center">
                        <Select
                          disabled={isSimulating}
                          value={station.scheme || "AB"}
                          onValueChange={(value) =>
                            updateStationScheme(
                              index,
                              value as "AB" | "A" | "B"
                            )
                          }
                        >
                          {/* Added fixed width w-20 */}
                          <SelectTrigger className="h-7 text-xs w-20">
                            <SelectValue placeholder="Select Scheme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AB">AB</SelectItem>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ml-1 p-1"
                          onClick={() => handleResetStationScheme(index)}
                          disabled={isSimulating || !defaultSettings}
                          tabIndex={-1}
                          aria-label="Reset to default"
                        >
                          <IconRotateClockwise size={14} />
                        </Button>
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          pattern="[0-9]*\.?[0-9]*"
                          inputMode="decimal"
                          value={station.distance || ""}
                          onChange={(e) => {
                            const value =
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value);
                            updateStationDistance(index, value);
                          }}
                          onFocus={(e) => {
                            // Clear value when focusing if it's 0
                            if (e.target.value === "0") {
                              e.target.value = "";
                            }
                          }}
                          disabled={true}
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
  );
};

export default SimulationSettingsCard;
