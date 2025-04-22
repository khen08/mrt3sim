"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerTrackPrev,
  IconPlayerTrackNext,
  IconClock,
  IconRotateClockwise,
  IconRewindBackward30,
  IconRewindForward30,
} from "@tabler/icons-react";
import { parseTime, formatTime, addSeconds } from "@/lib/timeUtils";
import { MRT_COLORS } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface SimulationControllerProps {
  startTime: string;
  endTime: string;
  onTimeUpdate: (time: string) => void;
  onSimulationStateChange: (isRunning: boolean) => void;
  isLoading: boolean;
  hasTimetableData: boolean;
}

// Define peak hour ranges
const PEAK_HOURS = {
  AM: { start: "07:00:00", end: "09:00:00" },
  PM: { start: "17:00:00", end: "20:00:00" },
};

type PeakPeriod = keyof typeof PEAK_HOURS; // Type will be 'AM' | 'PM'

// Define custom styles using the MRT color palette
const progressStyles = {
  bg: `bg-[${MRT_COLORS.blue}]`,
  progressBg: `bg-[${MRT_COLORS.blue}/20]`,
  text: `text-[${MRT_COLORS.blue}]`,
};

const SimulationController = ({
  startTime: dataStartTime,
  endTime: dataEndTime,
  onTimeUpdate,
  onSimulationStateChange,
  isLoading,
  hasTimetableData,
}: SimulationControllerProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPeak, setSelectedPeak] = useState<PeakPeriod>("AM");
  const [currentTime, setCurrentTime] = useState(PEAK_HOURS.AM.start);
  const [speed, setSpeed] = useState(1);
  // State for manual time input
  const [manualTimeInput, setManualTimeInput] = useState(currentTime);
  const [timeInputError, setTimeInputError] = useState<string | null>(null);

  // Ref to hold the latest speed value for the interval
  const speedRef = useRef(speed);
  // Toast Hook
  const { toast } = useToast();

  // Derive view window start/end times based on selected peak
  const viewStartTime = PEAK_HOURS[selectedPeak].start;
  const viewEndTime = PEAK_HOURS[selectedPeak].end;

  // Convert times to seconds for calculations within the selected view window
  const viewStartTimeSeconds = parseTime(viewStartTime);
  const viewEndTimeSeconds = parseTime(viewEndTime);
  const currentTimeSeconds = parseTime(currentTime);
  const totalDuration = viewEndTimeSeconds - viewStartTimeSeconds;

  // Update parent component whenever time changes
  useEffect(() => {
    onTimeUpdate(currentTime);
    // Also update the manual input field to stay synchronized
    setManualTimeInput(currentTime);
    setTimeInputError(null); // Clear error when time changes externally
  }, [currentTime, onTimeUpdate]);

  // Keep speedRef updated
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Timer effect for advancing simulation time
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isRunning) {
      intervalId = setInterval(() => {
        setCurrentTime((prevTime) => {
          const newTime = addSeconds(prevTime, 1 * speedRef.current);
          const newTimeSeconds = parseTime(newTime);

          // Stop simulation at the end of the selected view window
          if (newTimeSeconds >= viewEndTimeSeconds) {
            setIsRunning(false);
            // Toast Notification: Reached end of peak period
            toast({
              title: "Simulation Paused",
              description: `Reached end of ${selectedPeak} peak period (${viewEndTime}).`,
              variant: "default",
            });
            return viewEndTime;
          }

          // Prevent time from going below the start of the window
          if (newTimeSeconds < viewStartTimeSeconds) {
            return viewStartTime;
          }

          return newTime;
        });
      }, 500); // Update every 500ms
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    isRunning,
    viewEndTimeSeconds,
    viewStartTimeSeconds,
    selectedPeak,
    viewEndTime,
    toast,
  ]);

  // Update parent component about simulation state
  useEffect(() => {
    onSimulationStateChange(isRunning);
  }, [isRunning, onSimulationStateChange]);

  // Update visual speed if actual speed changes (e.g., via buttons)
  useEffect(() => {
    // This effect seems redundant now, visualSpeed state was removed.
    // Consider removing if not used elsewhere.
  }, [speed]);

  const togglePlayPause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  // Reset simulation to the start of the current peak period
  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    setCurrentTime(PEAK_HOURS[selectedPeak].start);
  }, [selectedPeak]);

  // Skip simulation time back by 30 seconds
  const skipBack = useCallback(() => {
    setCurrentTime((prevTime) => {
      const newTime = addSeconds(prevTime, -30); // Subtract 30 seconds
      const newTimeSeconds = parseTime(newTime);

      // Prevent going below the start of the peak window
      if (newTimeSeconds < viewStartTimeSeconds) {
        return viewStartTime;
      }
      return newTime;
    });
  }, [viewStartTimeSeconds, viewStartTime]);

  // Skip simulation time ahead by 30 seconds
  const skipAhead = useCallback(() => {
    setCurrentTime((prevTime) => {
      const newTime = addSeconds(prevTime, 30);
      const newTimeSeconds = parseTime(newTime);

      // Stop at the end of the peak window if skipping goes past it
      if (newTimeSeconds >= viewEndTimeSeconds) {
        setIsRunning(false);
        return viewEndTime;
      }
      return newTime;
    });
  }, [viewEndTimeSeconds, viewEndTime]);

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
      if (newPeak !== selectedPeak) {
        console.log(`Switching view to: ${newPeak} Peak`);
        setIsRunning(false); // Stop simulation
        setSelectedPeak(newPeak);
        setCurrentTime(PEAK_HOURS[newPeak].start); // Reset time to new peak start
      }
    },
    [selectedPeak]
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
    setIsRunning(false); // Pause simulation when manually setting time
    setCurrentTime(inputTime);
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
      if (newTime !== currentTime) {
        setIsRunning(false); // Pause simulation on manual scrub
        setCurrentTime(newTime);
      }
    }
  };

  // Speed preset options
  const speedPresets = [0.5, 1, 2, 5, 10];

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-medium mr-4">Simulation Control</h3>

        {/* Peak Period Selector */}
        <RadioGroup
          value={selectedPeak}
          onValueChange={(value) => handlePeakChange(value as PeakPeriod)}
          className="flex space-x-2 bg-gray-100 p-1 rounded-md"
          disabled={!hasTimetableData}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="AM" id="peak-am" className="peer sr-only" />
            <Label
              htmlFor="peak-am"
              className={`px-3 py-1 rounded text-sm font-medium cursor-pointer transition-colors ${
                selectedPeak === "AM"
                  ? "bg-mrt-blue text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              AM Peak (7-9)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="PM" id="peak-pm" className="peer sr-only" />
            <Label
              htmlFor="peak-pm"
              className={`px-3 py-1 rounded text-sm font-medium cursor-pointer transition-colors ${
                selectedPeak === "PM"
                  ? "bg-mrt-blue text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              PM Peak (5-8)
            </Label>
          </div>
        </RadioGroup>

        {/* Current Time Display & Manual Input */}
        {/* Manual Time Input - Only show when simulation is NOT running */}
        {!isRunning && (
          <div className="flex items-center gap-2 ml-4 relative w-32">
            <Input
              type="text"
              value={manualTimeInput}
              onChange={handleManualTimeInputChange}
              onKeyDown={handleManualTimeKeyDown}
              onBlur={handleManualTimeBlur}
              placeholder="HH:MM:SS"
              className={`h-8 text-sm font-mono ${
                timeInputError ? "border-red-500" : ""
              }`}
              title={`Set time within ${viewStartTime} - ${viewEndTime}`}
            />
            {timeInputError && (
              <p className="absolute top-full left-0 mt-1 text-xs text-red-600">
                {timeInputError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Wrap controls in a div for disabling effect */}
      <div
        className={cn(
          "flex flex-col space-y-4",
          !hasTimetableData && "opacity-50 pointer-events-none"
        )}
      >
        <div className="flex items-center space-x-4">
          {/* Time Slider */}
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

        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={skipBack}
              title="Skip back 30 seconds"
              className="border-2 hover:bg-gray-100 hover:border-gray-400 transition-all"
              disabled={!hasTimetableData}
            >
              <IconRewindBackward30 size={18} />
            </Button>
            <Button
              variant={isRunning ? "destructive" : "cta"}
              onClick={togglePlayPause}
              disabled={isLoading || !hasTimetableData}
              className="w-28 h-10 font-medium text-base shadow-md hover:shadow-lg transition-all"
              style={{
                fontWeight: "600",
              }}
            >
              {isRunning ? (
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
              className="border-2 hover:bg-gray-100 hover:border-gray-400 transition-all"
              disabled={!hasTimetableData}
            >
              <IconRewindForward30 size={18} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetSimulation}
              title="Reset to start of peak"
              className="border-2 hover:bg-gray-100 hover:border-gray-400 transition-all ml-4"
              disabled={!hasTimetableData}
            >
              <IconRotateClockwise size={18} />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <IconClock size={18} style={{ color: MRT_COLORS.blue }} />
            <span className="text-sm font-medium mr-2">Speed:</span>

            {/* Speed preset buttons */}
            <div className="flex space-x-1">
              {speedPresets.map((preset) => (
                <Button
                  key={preset}
                  variant={speed === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSpeedChange(preset)}
                  className="px-3 py-1 h-auto text-xs font-medium shadow-sm hover:shadow-md transition-all"
                  disabled={!hasTimetableData}
                >
                  {preset}x
                </Button>
              ))}
            </div>

            <span
              className="text-sm font-mono px-2 py-1 rounded font-bold"
              style={{
                backgroundColor: `${MRT_COLORS.blue}20`,
                color: MRT_COLORS.blue,
              }}
            >
              {speed}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationController;
