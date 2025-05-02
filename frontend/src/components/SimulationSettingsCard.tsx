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
import { IconSettings, IconClock } from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define interface for the simulation settings passed as props
interface SimulationSettings {
  dwellTime: number;
  turnaroundTime: number;
  acceleration: number;
  deceleration: number;
  cruisingSpeed: number;
  maxCapacity: number;
  schemeType: "REGULAR" | "SKIP-STOP";
  schemePattern: string[]; // Array of station schemes: ["AB", "A", "AB", "B", ...]
  stations: {
    name: string;
    distance: number;
    scheme?: "AB" | "A" | "B";
  }[];
}

interface SimulationSettingsCardProps {
  simulationSettings: SimulationSettings | null;
  isSimulating: boolean;
  isFullDayView: boolean;
  onSettingChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string,
    field?: string
  ) => void;
  onStationDistanceChange: (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  onStationSchemeChange: (index: number, value: "AB" | "A" | "B") => void;
  onSkipStopToggle: (checked: boolean) => void;
  onToggleFullDayView: () => void;
}

const SimulationSettingsCard = ({
  simulationSettings,
  isSimulating,
  isFullDayView,
  onSettingChange,
  onStationDistanceChange,
  onStationSchemeChange,
  onSkipStopToggle,
  onToggleFullDayView,
}: SimulationSettingsCardProps) => {
  if (!simulationSettings) {
    // Render nothing or a loading indicator if settings are not yet loaded
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        {/* Wrap title and add toggle icon */}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <IconSettings className="mr-2 inline-block h-5 w-5" />
            Simulation Settings
          </CardTitle>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleFullDayView}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <IconClock size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Full Day / Peak Hours Timeline View</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Configure simulation parameters. Applied when "Run Simulation" is
          clicked.
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
                  onChange={onSettingChange}
                  className="mt-1"
                  disabled={isSimulating}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Train stop duration at stations.
                </p>
              </div>
              <div>
                <Label htmlFor="turnaroundTime">Turnaround Time (s)</Label>
                <Input
                  id="turnaroundTime"
                  name="turnaroundTime"
                  type="number"
                  step="1"
                  min="0"
                  value={simulationSettings.turnaroundTime}
                  onChange={onSettingChange}
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
                <Label htmlFor="acceleration">Acceleration (m/s²)</Label>
                <Input
                  id="acceleration"
                  name="acceleration"
                  type="number"
                  step="0.01"
                  min="0"
                  value={simulationSettings.acceleration}
                  onChange={onSettingChange}
                  className="mt-1"
                  disabled={isSimulating}
                />
              </div>
              <div>
                <Label htmlFor="deceleration">Deceleration (m/s²)</Label>
                <Input
                  id="deceleration"
                  name="deceleration"
                  type="number"
                  step="0.01"
                  min="0"
                  value={simulationSettings.deceleration}
                  onChange={onSettingChange}
                  className="mt-1"
                  disabled={isSimulating}
                />
              </div>
              <div>
                <Label htmlFor="cruisingSpeed">Max Speed (km/h)</Label>
                <Input
                  id="cruisingSpeed"
                  name="cruisingSpeed"
                  type="number"
                  step="1"
                  min="0"
                  value={simulationSettings.cruisingSpeed}
                  onChange={onSettingChange}
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
                  onChange={onSettingChange}
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
            {/* Place Label and Toggle on the same row */}
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold">
                Station Management
              </Label>
              {/* Skip-Stop Toggle - Moved here */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useSkipStop"
                  checked={simulationSettings.schemeType === "SKIP-STOP"}
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
                {simulationSettings.stations.map((station, index) => (
                  <div
                    key={`station-${index}`}
                    className="grid grid-cols-16 gap-4 items-center mb-2 text-xs"
                  >
                    <div className="col-span-1 text-gray-500">{index + 1}</div>
                    <div className="col-span-5">{station.name}</div>
                    {/* New scheme selector */}
                    <div className="col-span-6">
                      <Select
                        disabled={
                          simulationSettings.schemeType !== "SKIP-STOP" ||
                          isSimulating
                        }
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
                        onChange={(e) => onStationDistanceChange(index, e)}
                        // Disable first station and if simulating
                        disabled={index === 0 || isSimulating}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SimulationSettingsCard;
