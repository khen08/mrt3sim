"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerTrackPrev,
  IconPlayerTrackNext,
  IconClock,
  IconRotateClockwise,
  IconRewindBackward30,
  IconRewindForward30,
  IconRoute,
} from "@tabler/icons-react";
import { parseTime, formatTime, addSeconds } from "@/lib/timeUtils";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PEAK_HOURS,
  FULL_DAY_HOURS,
  type PeakPeriod,
  SIMULATION_SPEED_PRESETS,
} from "@/lib/constants"; // Import constants
import { useSimulationStore } from "@/store/simulationStore";

interface SimulationControllerProps {
  startTime: string; // Now dynamically passed based on view mode
  endTime: string; // Now dynamically passed based on view mode
  onTimeUpdate: (time: string) => void;
  onSimulationStateChange: (isRunning: boolean) => void;
  onSchemeChange?: (scheme: "REGULAR" | "SKIP-STOP") => void;
  onToggleFullDayView: () => void;
  isLoading: boolean;
  hasTimetableData: boolean;
  hasSimulationData: boolean;
  // New props
  isFullDayView: boolean;
  selectedPeak: PeakPeriod; // Receive selected peak from parent
  onPeakChange: (peak: PeakPeriod) => void; // Add prop for callback
  showDebugInfo?: boolean; // <-- Add prop to receive state
  onShowDebugInfoChange?: (show: boolean) => void; // <-- Add handler prop
  className?: string; // Add className prop
}

type OperationalScheme = "Regular" | "Skip-Stop"; // Type for visual scheme

const SimulationController = ({
  startTime, // Use passed prop
  endTime, // Use passed prop
  onTimeUpdate,
  onSimulationStateChange,
  onSchemeChange,
  onToggleFullDayView,
  isLoading,
  hasTimetableData,
  hasSimulationData,
  // New props
  isFullDayView,
  selectedPeak,
  onPeakChange,
  showDebugInfo = false,
  onShowDebugInfoChange,
  className, // Destructure className
}: SimulationControllerProps) => {
  // Use Zustand store
  const simulationTime = useSimulationStore((state: any) => state.simulationTime);
  const isSimulationRunning = useSimulationStore(
    (state: any) => state.isSimulationRunning
  );
  const setSimulationTime = useSimulationStore(
    (state: any) => state.setSimulationTime
  );
  const setIsSimulationRunning = useSimulationStore(
    (state: any) => state.setIsSimulationRunning
  );
  const selectedScheme = useSimulationStore((state: any) => state.selectedScheme);
  const setSelectedScheme = useSimulationStore(
    (state: any) => state.setSelectedScheme
  );
  const setShowDebugInfo = useSimulationStore(
    (state: any) => state.setShowDebugInfo
  );

  // Local state for UI
  const [speed, setSpeed] = useState(1);
  // State for manual time input
  const [manualTimeInput, setManualTimeInput] = useState(simulationTime);
  const [timeInputError, setTimeInputError] = useState<string | null>(null);
  const [visualScheme, setVisualScheme] = useState<OperationalScheme>(
    selectedScheme === "REGULAR" ? "Regular" : "Skip-Stop"
  );

  // Ref to hold the latest speed value for the interval
  const speedRef = useRef(speed);
  // Toast Hook
  const { toast } = useToast();

  // Derive view window start/end times based on selected peak
  const viewStartTime = startTime;
  const viewEndTime = endTime;

  // Convert times to seconds for calculations within the selected view window
  const viewStartTimeSeconds = parseTime(viewStartTime);
  const viewEndTimeSeconds = parseTime(viewEndTime);
  const currentTimeSeconds = parseTime(simulationTime);
  const totalDuration = viewEndTimeSeconds - viewStartTimeSeconds;

  // Update parent component whenever time changes
  useEffect(() => {
    onTimeUpdate(simulationTime);
    // Also update the manual input field to stay synchronized
    setManualTimeInput(simulationTime);
    setTimeInputError(null); // Clear error when time changes externally
  }, [simulationTime, onTimeUpdate]);

  // Effect to update visualScheme when selectedScheme changes
  useEffect(() => {
    setVisualScheme(selectedScheme === "REGULAR" ? "Regular" : "Skip-Stop");
  }, [selectedScheme]);

  // Keep speedRef updated
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Timer effect for advancing simulation time
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isSimulationRunning) {
      intervalId = setInterval(() => {
        const newTime = addSeconds(simulationTime, 1 * speedRef.current);
        const newTimeSeconds = parseTime(newTime);

        // Stop simulation at the end of the selected view window
        if (newTimeSeconds >= viewEndTimeSeconds) {
          setIsSimulationRunning(false);
          // Toast Notification: Reached end of peak period
          toast({
            title: "Simulation Paused",
            description: `Reached end of ${selectedPeak} peak period (${viewEndTime}).`,
            variant: "default",
          });
          setSimulationTime(viewEndTime);
        }
        // Prevent time from going below the start of the window
        else if (newTimeSeconds < viewStartTimeSeconds) {
          setSimulationTime(viewStartTime);
        } else {
          setSimulationTime(newTime);
        }
      }, 500); // Update every 500ms
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    isSimulationRunning,
    simulationTime,
    viewEndTimeSeconds,
    viewStartTimeSeconds,
    selectedPeak,
    viewEndTime,
    viewStartTime,
    toast,
    setSimulationTime,
    setIsSimulationRunning,
  ]);

  // Update parent component about simulation state
  useEffect(() => {
    onSimulationStateChange(isSimulationRunning);
  }, [isSimulationRunning, onSimulationStateChange]);

  const togglePlayPause = useCallback(() => {
    setIsSimulationRunning(!isSimulationRunning);
  }, [isSimulationRunning, setIsSimulationRunning]);

  // Reset simulation to the start of the current peak period
  const resetSimulation = useCallback(() => {
    setIsSimulationRunning(false);
    setSimulationTime(PEAK_HOURS[selectedPeak].start);
  }, [selectedPeak, setIsSimulationRunning, setSimulationTime]);

  // Skip simulation time back by 30 seconds
  const skipBack = useCallback(() => {
    const newTime = addSeconds(simulationTime, -30); // Subtract 30 seconds
    const newTimeSeconds = parseTime(newTime);

    // Prevent going below the start of the peak window
    if (newTimeSeconds < viewStartTimeSeconds) {
      setSimulationTime(viewStartTime);
    } else {
      setSimulationTime(newTime);
    }
  }, [simulationTime, viewStartTimeSeconds, viewStartTime, setSimulationTime]);

  // Skip simulation time ahead by 30 seconds
  const skipAhead = useCallback(() => {
    const newTime = addSeconds(simulationTime, 30);
    const newTimeSeconds = parseTime(newTime);

    // Stop at the end of the peak window if skipping goes past it
    if (newTimeSeconds >= viewEndTimeSeconds) {
      setIsSimulationRunning(false);
      setSimulationTime(viewEndTime);
    } else {
      setSimulationTime(newTime);
    }
  }, [
    simulationTime,
    viewEndTimeSeconds,
    viewEndTime,
    setIsSimulationRunning,
    setSimulationTime,
  ]);

  // Update simulation speed
  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      // Prevent update if speed hasn't changed
      if (newSpeed !== speed) {
        setSpeed(newSpeed);
      }
    },
    [speed]
  );

  // Handle selection of a different peak period (AM/PM)
  const handlePeakChange = useCallback(
    (newPeak: PeakPeriod) => {
      if (newPeak !== selectedPeak && !isFullDayView) {
        // Only allow change if not full day
        onPeakChange(newPeak);
        // Set current time to the start of the newly selected peak
        setSimulationTime(PEAK_HOURS[newPeak].start);
        // Ensure simulation is paused when changing peak
        setIsSimulationRunning(false);
      }
    },
    [
      selectedPeak,
      onPeakChange,
      isFullDayView,
      setSimulationTime,
      setIsSimulationRunning,
    ]
  );

  // Handle selection of a different visual operational scheme
  const handleSchemeChange = useCallback(
    (newScheme: OperationalScheme) => {
      if (newScheme !== visualScheme) {
        setVisualScheme(newScheme);

        // Call the parent component's handler if provided
        if (onSchemeChange) {
          // Convert from UI scheme type to backend scheme type
          const backendScheme =
            newScheme === "Regular" ? "REGULAR" : "SKIP-STOP";
          onSchemeChange(backendScheme);
          // Update the store
          setSelectedScheme(backendScheme);
        }
      }
    },
    [visualScheme, onSchemeChange, setSelectedScheme]
  );

  // --- Manual Time Input Handlers --- //
  const validateAndSetTime = (inputTime: string) => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    if (!timeRegex.test(inputTime)) {
      setTimeInputError("Invalid format (HH:MM:SS)");
      return false;
    }

    const inputSeconds = parseTime(inputTime);
    if (
      inputSeconds < viewStartTimeSeconds ||
      inputSeconds > viewEndTimeSeconds
    ) {
      setTimeInputError(
        `Time must be within ${viewStartTime} - ${viewEndTime}`
      );
      return false;
    }

    // If valid and within range, update the main time state
    setTimeInputError(null);
    setIsSimulationRunning(false); // Pause simulation when manually setting time
    setSimulationTime(inputTime);
    return true;
  };

  const handleManualTimeInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setManualTimeInput(event.target.value);
    // Optionally clear error on input change
    if (timeInputError) {
      setTimeInputError(null);
    }
  };

  const handleManualTimeKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      validateAndSetTime(manualTimeInput);
    }
  };

  const handleManualTimeBlur = () => {
    // Validate on blur only if there isn't already an error,
    // or if the input value actually changed since the last validation attempt
    // This prevents re-validating immediately if the user clicks away from an invalid input
    validateAndSetTime(manualTimeInput);
  };

  // Handler for slider value change
  const handleSliderChange = (value: number[]) => {
    const newTimeSeconds = value[0];
    // Prevent updates if the value is somehow out of bounds
    if (
      newTimeSeconds >= viewStartTimeSeconds &&
      newTimeSeconds <= viewEndTimeSeconds
    ) {
      const newTime = formatTime(newTimeSeconds);
      if (newTime !== simulationTime) {
        setIsSimulationRunning(false); // Pause simulation on manual scrub
        setSimulationTime(newTime);
      }
    }
  };

  const handleDebugToggle = (checked: boolean) => {
    if (onShowDebugInfoChange) {
      onShowDebugInfoChange(checked);
    }
    // Also update the store
    setShowDebugInfo(checked);
  };

  return (
    <div className={cn("bg-card rounded-lg border shadow-sm p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-medium mr-4 text-card-foreground">
          Simulation Control
        </h3>

        {/* Peak Period Selector */}
        <div className="flex items-center ml-4">
          <IconRoute
            size={16}
            className="mr-2 text-gray-500 dark:text-gray-400"
          />
          <RadioGroup
            value={selectedPeak}
            onValueChange={(value) => handlePeakChange(value as PeakPeriod)}
            className={cn(
              "flex space-x-2 bg-muted/70 dark:bg-gray-800 p-1 rounded-md",
              // Disable if no data OR if full day view is active
              (!hasTimetableData || isFullDayView) &&
                "opacity-50 pointer-events-none"
            )}
            // Explicitly disable based on props
            disabled={!hasTimetableData || isFullDayView}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="AM"
                id="peak-am"
                className="peer sr-only"
              />
              <Label
                htmlFor="peak-am"
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors",
                  selectedPeak === "AM" && !isFullDayView // Highlight only if selected and not full day
                    ? "bg-mrt-blue text-white shadow-sm"
                    : "text-muted-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-gray-700",
                  isFullDayView && "cursor-not-allowed" // Add not-allowed cursor when disabled
                )}
              >
                AM Peak (7-9)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="PM"
                id="peak-pm"
                className="peer sr-only"
              />
              <Label
                htmlFor="peak-pm"
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors",
                  selectedPeak === "PM" && !isFullDayView // Highlight only if selected and not full day
                    ? "bg-mrt-blue text-white shadow-sm"
                    : "text-muted-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-gray-700",
                  isFullDayView && "cursor-not-allowed" // Add not-allowed cursor when disabled
                )}
              >
                PM Peak (5-8)
              </Label>
            </div>
          </RadioGroup>

          {/* --- MOVED Toggle Button --- */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleFullDayView}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1" // Added ml-1 for spacing
                  disabled={!hasSimulationData}
                >
                  <IconClock size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Full Day / Peak Hours Timeline View</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* --- END MOVED Toggle Button --- */}
        </div>

        {/* Operational Scheme Selector */}
        <div className="flex items-center ml-4">
          <IconRoute
            size={16}
            className="mr-2 text-gray-500 dark:text-gray-400"
          />
          <RadioGroup
            value={visualScheme}
            onValueChange={(value) =>
              handleSchemeChange(value as OperationalScheme)
            }
            className={cn(
              "flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-md",
              !hasTimetableData && "opacity-50 pointer-events-none"
            )}
            disabled={!hasTimetableData}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="Regular"
                id="scheme-regular"
                className="peer sr-only"
              />
              <Label
                htmlFor="scheme-regular"
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors",
                  visualScheme === "Regular"
                    ? "bg-gray-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                Regular
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="Skip-Stop"
                id="scheme-skipstop"
                className="peer sr-only"
              />
              <Label
                htmlFor="scheme-skipstop"
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors",
                  visualScheme === "Skip-Stop"
                    ? "bg-gray-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                Skip-Stop
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* NEW: Debug Info Toggle Checkbox */}
        <div className="flex items-center ml-4">
          <Checkbox
            id="show-debug"
            checked={showDebugInfo}
            onCheckedChange={handleDebugToggle}
            disabled={!hasTimetableData} // Disable if no data
          />
          <Label
            htmlFor="show-debug"
            className="text-xs font-medium text-muted-foreground cursor-pointer ml-1"
          >
            Show Debug Info
          </Label>
        </div>
      </div>

      {/* Wrap controls in a div for disabling effect */}
      <div
        className={cn(
          "flex flex-col space-y-4",
          !hasTimetableData && "opacity-50 pointer-events-none"
        )}
      >
        {/* Time Slider */}
        <div className="flex items-center space-x-4">
          <Slider
            min={viewStartTimeSeconds}
            max={viewEndTimeSeconds}
            step={1} // Step by 1 second
            value={[currentTimeSeconds]}
            onValueChange={handleSliderChange}
            disabled={!hasTimetableData}
            className="flex-grow"
          />
        </div>

        {/* Bottom Row: Play/Pause, Skip, Reset, Speed, Manual Time */}
        <div className="flex items-center justify-between">
          {/* Left Side: Play/Pause, Skip, Reset */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={skipBack}
              title="Skip back 30 seconds"
              className="border-2 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-all"
              disabled={!hasTimetableData}
            >
              <IconRewindBackward30 size={18} />
            </Button>
            <Button
              variant={isSimulationRunning ? "destructive" : "cta"}
              onClick={togglePlayPause}
              disabled={isLoading || !hasTimetableData}
              className="w-28 h-10 font-medium text-base shadow-md hover:shadow-lg transition-all"
              style={{
                fontWeight: "600",
              }}
            >
              {isSimulationRunning ? (
                <>
                  <IconPlayerPause size={18} className="mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <IconPlayerPlay size={18} className="mr-2" />
                  Start
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={skipAhead}
              title="Skip ahead 30 seconds"
              className="border-2 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-all"
              disabled={!hasTimetableData}
            >
              <IconRewindForward30 size={18} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetSimulation}
              title="Reset to start of peak"
              className="border-2 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-all ml-4"
              disabled={!hasTimetableData}
            >
              <IconRotateClockwise size={18} />
            </Button>
          </div>

          {/* Right Side: Speed Controls and Manual Time Input */}
          <div className="flex items-center space-x-4">
            {/* Speed Controls Group */}
            <div className="flex items-center space-x-2">
              <IconClock size={18} className="text-mrt-blue" />
              <span className="text-sm font-medium mr-2 text-muted-foreground dark:text-muted-foreground">
                Speed:
              </span>
              <div className="flex space-x-1">
                {SIMULATION_SPEED_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant={speed === preset ? "cta" : "outline"}
                    size="sm"
                    onClick={() => handleSpeedChange(preset)}
                    className="min-w-[40px] h-7 px-2 justify-center text-xs font-medium shadow-sm hover:shadow-md transition-all"
                    disabled={!hasTimetableData}
                  >
                    {preset}x
                  </Button>
                ))}
              </div>
            </div>

            {/* Manual Time Input - Moved here */}
            {!isSimulationRunning && (
              <div className="flex items-center gap-1 relative">
                {timeInputError && (
                  <p className="text-xs text-red-600 dark:text-red-500 absolute -top-4 right-0">
                    {timeInputError}
                  </p>
                )}
                <Input
                  type="text"
                  value={manualTimeInput}
                  onChange={handleManualTimeInputChange}
                  onKeyDown={handleManualTimeKeyDown}
                  onBlur={handleManualTimeBlur}
                  placeholder="HH:MM:SS"
                  className={cn(
                    `h-8 text-sm font-mono w-24`, // Keep size consistent
                    timeInputError ? "border-red-500 dark:border-red-600" : ""
                  )}
                  title={`Set time within ${viewStartTime} - ${viewEndTime}`}
                  disabled={!hasTimetableData}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationController;
