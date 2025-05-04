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
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import { uploadCsvFile } from "@/lib/fileUpload";
import { toast } from "@/components/ui/use-toast";

// Define SimulationSettings type locally (copied from page.tsx)
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

// Define interface for the simulation settings passed as props
interface SimulationSettingsCardProps {
  simulationSettings: SimulationSettings | null;
  isSimulating: boolean;
  isFullDayView: boolean;
  onSettingChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string,
    field?: string
  ) => void;
  onStationDistanceChange: (index: number, value: number) => void;
  onStationSchemeChange: (index: number, value: "AB" | "A" | "B") => void;
  onSkipStopToggle: (checked: boolean) => void;
  loadedSimulationId: number | null;
  hasSimulationData: boolean;
  simulatePassengers: boolean;
  onSimulatePassengersToggle: (checked: boolean) => void;
  hasResults: boolean;
  simulationInputFilename: string | null;
  nextRunFilename?: string | null;
  handleFileSelect: (file: File | null, backendFilename: string | null) => void;
}

const SimulationSettingsCard: React.FC<SimulationSettingsCardProps> = ({
  simulationSettings,
  isSimulating,
  isFullDayView,
  onSettingChange,
  onStationDistanceChange,
  onStationSchemeChange,
  onSkipStopToggle,
  loadedSimulationId,
  hasSimulationData,
  simulatePassengers,
  onSimulatePassengersToggle,
  hasResults,
  simulationInputFilename,
  nextRunFilename = null,
  handleFileSelect,
}: SimulationSettingsCardProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!simulationSettings) {
    // Render nothing or a loading indicator if settings are not yet loaded
    return null;
  }

  const { stations, ...trainSettings } = simulationSettings;
  const isSkipStop = simulationSettings.schemeType === "SKIP-STOP";

  return (
    <Card className="mb-4">
      <CardHeader>
        {/* Wrap title and add toggle icon */}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <IconSettings className="mr-2 inline-block h-5 w-5" />
            Simulation Settings
          </CardTitle>
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
            onCheckedChange={onSimulatePassengersToggle}
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

        {/* -- Inserted Selected File Info Card -- */}
        {(simulationInputFilename !== null || nextRunFilename !== null) &&
          simulatePassengers && (
            <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/50 p-3 mb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-hidden">
                  <IconFile
                    size={20}
                    className="text-blue-600 dark:text-blue-400 flex-shrink-0"
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                      {nextRunFilename
                        ? "Selected for next run:"
                        : "Using file from loaded simulation:"}
                    </span>
                    <span className="text-xs font-medium text-blue-800 dark:text-blue-200 truncate">
                      {nextRunFilename || simulationInputFilename}
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {nextRunFilename
                        ? "selected for next simulation run"
                        : "inherited from loaded simulation"}
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
                        console.log(
                          "File selected via Change button:",
                          file.name
                        );

                        // Show loading state using toast
                        toast({
                          title: "Uploading File",
                          description: `Uploading '${file.name}'. Please wait.`,
                          variant: "default",
                        });

                        try {
                          // Use uploadCsvFile utility directly
                          const result = await uploadCsvFile(file);
                          console.log("Upload result:", result);

                          // Handle the result
                          if (result.success && result.filename) {
                            console.log(
                              "Setting nextRunFilename to:",
                              result.filename
                            );
                            // Call handleFileSelect with ONLY the backend filename
                            // This will set only nextRunFilename without changing UI
                            handleFileSelect(file, result.filename);

                            toast({
                              title: "File Uploaded",
                              description: `'${file.name}' will be used for the next simulation run.`,
                              variant: "default",
                            });
                          } else {
                            throw new Error("Upload failed with unknown error");
                          }
                        } catch (error: any) {
                          console.error("File upload error:", error);
                          toast({
                            title: "Upload Failed",
                            description:
                              error.message || "Failed to upload file",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSimulating}
                  >
                    <IconReplace size={14} className="mr-1" /> Change
                  </Button>
                </div>
              </div>
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
                    value={trainSettings.dwellTime}
                    onChange={onSettingChange}
                    className="pr-8 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                  />
                  <span className="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                    seconds
                  </span>
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
                    value={trainSettings.turnaroundTime}
                    onChange={onSettingChange}
                    className="pr-8 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                  />
                  <span className="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                    seconds
                  </span>
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
                    value={trainSettings.acceleration}
                    onChange={onSettingChange}
                    className="pr-12 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                  />
                  <span className="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                    m/s²
                  </span>
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
                    value={trainSettings.deceleration}
                    onChange={onSettingChange}
                    className="pr-12 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                  />
                  <span className="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                    m/s²
                  </span>
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
                    value={trainSettings.cruisingSpeed}
                    onChange={onSettingChange}
                    className="pr-14 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                  />
                  <span className="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                    km/h
                  </span>
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
                    value={trainSettings.maxCapacity}
                    onChange={onSettingChange}
                    className="pr-16 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSimulating}
                  />
                  <span className="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                    pax
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Max passengers per train.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Station Settings Tab */}
          <TabsContent value="station" className="space-y-4">
            {/* Place Label and Toggle on the same row */}
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold">
                Station Management
              </Label>
              {/* Skip-Stop Toggle - Moved here */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useSkipStop"
                  checked={isSkipStop}
                  onCheckedChange={(checked: boolean) =>
                    onSkipStopToggle(checked)
                  }
                  disabled={isSimulating}
                />
                <label
                  htmlFor="useSkipStop"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Change Skip-Stop Pattern
                </label>
              </div>
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
                      {/* New scheme selector */}
                      <div className="col-span-6">
                        <Select
                          disabled={!isSkipStop || isSimulating}
                          value={station.scheme || "AB"}
                          onValueChange={(value) =>
                            onStationSchemeChange(
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
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={station.distance}
                          onChange={(e) =>
                            onStationDistanceChange(
                              index,
                              Number(e.target.value)
                            )
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SimulationSettingsCard;
