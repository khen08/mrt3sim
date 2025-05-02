"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconTrain, // Re-use train icon
  IconMapPin, // Keep for station name
  IconClock, // For scheduled time
  IconUsers, // For load
  IconInfoCircle, // General info?
  IconArrowUp, // Correct icon for Northbound
  IconArrowDown, // Correct icon for Southbound
  IconRoute, // For Status
  IconListCheck, // For stop pattern
  IconBuildingSkyscraper, // For stations
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";

// Match the interface defined in page.tsx
interface TrainInfoData {
  id: number;
  direction: "northbound" | "southbound";
  status: string;
  load: number;
  capacity: number;
  relevantStationName: string | null;
  scheduledTime: string | null;
  // New fields for skip-stop pattern
  serviceType?: "A" | "B" | "AB" | string | null;
  nextStops?: { id: number; name: string; time: string | null }[];
  servedStations?: string[];
}

// Interface for train event pairs (from MrtMap)
interface TrainEventPair {
  eventA: any | null; // Current event
  eventB: any | null; // Next event
}

// Interface for train state (from MrtMap)
interface TrainState {
  id: number;
  x: number;
  y: number;
  direction: "northbound" | "southbound";
  isStopped: boolean;
  isActive: boolean;
  isTurningAround: boolean;
  isInDepot: boolean;
  isNewlyInserted?: boolean;
  serviceType?: "A" | "B" | "AB" | string | null;
  rotation: number;
  currentStationIndex: number;
  turnaroundProgress: number | null;
}

// Add props for simulation update capability
interface TrainInfoProps extends TrainInfoData {
  simulationTime?: string;
  simulationTimetable?: any[] | null;
  trainEventPairs?: Record<number, TrainEventPair>;
  trainStates?: TrainState[];
  stationsById?: Record<number, { name: string; id: number }>;
}

const TrainInfo = ({
  // Use the interface name for props
  id,
  direction,
  status,
  load,
  capacity,
  relevantStationName,
  scheduledTime,
  serviceType = "AB", // Default to regular service
  nextStops = [],
  servedStations = [],
  simulationTime,
  simulationTimetable,
  trainEventPairs,
  trainStates,
  stationsById,
}: TrainInfoProps) => {
  // State for real-time train information
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentRelevantStationName, setCurrentRelevantStationName] =
    useState(relevantStationName);
  const [currentScheduledTime, setCurrentScheduledTime] =
    useState(scheduledTime);
  const [currentLoad, setCurrentLoad] = useState(load);
  const [currentNextStops, setCurrentNextStops] = useState(nextStops);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Setup a refresh interval to handle potential delayed data from refs
  useEffect(() => {
    // Only refresh if data might be available but not yet loaded
    if (simulationTime && (!trainEventPairs || !trainStates || !stationsById)) {
      const refreshTimer = setInterval(() => {
        setRefreshCounter((prev) => prev + 1);
      }, 500); // Check every 500ms

      return () => clearInterval(refreshTimer);
    }
  }, [simulationTime, trainEventPairs, trainStates, stationsById]);

  // Update train information in real-time based on simulation time and MrtMap's calculated state
  useEffect(() => {
    if (!simulationTime || !trainEventPairs || !trainStates) return;

    // Parse current simulation time to seconds for comparison
    const timeToSeconds = (timeStr: string): number => {
      if (!timeStr || typeof timeStr !== "string") return 0;

      let timePart = timeStr;
      if (timeStr.includes(" ")) {
        timePart = timeStr.split(" ")[1];
      }

      if (!timePart.includes(":")) return 0;

      const parts = timePart.split(":").map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return 0;
      const [hours, minutes, seconds] = parts;
      return hours * 3600 + minutes * 60 + seconds;
    };

    // Get the pre-calculated event pair for this train from MrtMap
    const trainEvents = trainEventPairs[id];
    if (!trainEvents) return;

    const { eventA: currentEvent, eventB: nextEvent } = trainEvents;

    // Get the train state from MrtMap
    const trainState = trainStates.find((ts) => ts.id === id);
    if (!trainState) return;

    // Update status based on current/next events
    if (currentEvent) {
      // Get station ID and name (prefer lookup from stationsById if available)
      const stationId = currentEvent.STATION_ID || currentEvent.NStation || 0;
      const stationName =
        stationsById && stationsById[stationId]
          ? stationsById[stationId].name
          : `Station ${stationId}`;

      const arrivalTime =
        currentEvent.ARRIVAL_TIME || currentEvent["Arrival Time"];
      const departureTime =
        currentEvent.DEPARTURE_TIME || currentEvent["Departure Time"];

      // Use the train state flags from MrtMap for status determination
      if (trainState.isInDepot) {
        setCurrentStatus("Inactive");
        setCurrentRelevantStationName(stationName);
        setCurrentScheduledTime(null);
      } else if (trainState.isTurningAround) {
        setCurrentStatus("Turning Around");
        setCurrentRelevantStationName(stationName);
        // Use the next event's arrival time as schedule if available, otherwise null
        setCurrentScheduledTime(
          nextEvent?.ARRIVAL_TIME || nextEvent?.["Arrival Time"] || null
        );
      } else if (trainState.isStopped) {
        setCurrentStatus("At Station");
        setCurrentRelevantStationName(stationName);
        setCurrentScheduledTime(departureTime);
      } else if (nextEvent) {
        // In transit
        const nextStationId = nextEvent.STATION_ID || nextEvent.NStation || 0;
        const nextStationName =
          stationsById && stationsById[nextStationId]
            ? stationsById[nextStationId].name
            : `Station ${nextStationId}`;

        const nextArrivalTime =
          nextEvent.ARRIVAL_TIME || nextEvent["Arrival Time"];

        setCurrentStatus("In Transit");
        setCurrentRelevantStationName(nextStationName);
        setCurrentScheduledTime(nextArrivalTime);
      }

      // Update passenger load if available from different possible properties
      if (currentEvent.CURRENT_PASSENGER_COUNT !== undefined) {
        setCurrentLoad(currentEvent.CURRENT_PASSENGER_COUNT);
      } else if (
        currentEvent.PASSENGERS_BOARDED !== undefined &&
        currentEvent.PASSENGERS_ALIGHTED !== undefined
      ) {
        // Simplistic calculation: starting load + boarded - alighted
        const currentLoad = Math.max(
          0,
          (currentEvent.STARTING_LOAD || 0) +
            (currentEvent.PASSENGERS_BOARDED || 0) -
            (currentEvent.PASSENGERS_ALIGHTED || 0)
        );
        setCurrentLoad(currentLoad);
      }
    } else if (nextEvent) {
      // Train hasn't started its journey yet
      const nextStationId = nextEvent.STATION_ID || nextEvent.NStation || 0;
      const nextStationName =
        stationsById && stationsById[nextStationId]
          ? stationsById[nextStationId].name
          : `Station ${nextStationId}`;

      const nextArrivalTime =
        nextEvent.ARRIVAL_TIME || nextEvent["Arrival Time"];

      setCurrentStatus("Not Started");
      setCurrentRelevantStationName(nextStationName);
      setCurrentScheduledTime(nextArrivalTime);
    }

    // Update next stops
    if (nextEvent && simulationTimetable) {
      const currentSimSeconds = timeToSeconds(simulationTime);

      // Filter timetable for this train's upcoming stops
      const trainEntries = simulationTimetable.filter(
        (entry) => entry.TRAIN_ID === id || entry["Train ID"] === id
      );

      // Sort by arrival time
      const sortedEntries = [...trainEntries].sort((a, b) => {
        const timeA = a.ARRIVAL_TIME || a["Arrival Time"] || "00:00:00";
        const timeB = b.ARRIVAL_TIME || b["Arrival Time"] || "00:00:00";
        return timeToSeconds(timeA) - timeToSeconds(timeB);
      });

      const futureStops = sortedEntries
        .filter((entry) => {
          const arrivalTime = entry.ARRIVAL_TIME || entry["Arrival Time"];
          if (!arrivalTime) return false;
          return timeToSeconds(arrivalTime) > currentSimSeconds;
        })
        .slice(0, 3) // Show next 3 stops
        .map((entry) => {
          const stationId = entry.STATION_ID || entry.NStation;
          const stationName =
            stationsById && stationsById[stationId]
              ? stationsById[stationId].name
              : `Station ${stationId}`;

          return {
            id: stationId,
            name: stationName,
            time: entry.ARRIVAL_TIME || entry["Arrival Time"],
          };
        });

      setCurrentNextStops(futureStops);
    }
  }, [
    id,
    simulationTime,
    simulationTimetable,
    trainEventPairs,
    trainStates,
    stationsById,
    refreshCounter,
  ]);

  const directionColor =
    direction === "northbound" ? "text-[#00844e]" : "text-[#ffcf26]";
  const directionBg =
    direction === "northbound" ? "bg-[#00844e]/10" : "bg-[#ffcf26]/10";
  const directionDarkBg =
    direction === "northbound"
      ? "dark:bg-[#00844e]/20"
      : "dark:bg-[#ffcf26]/20";

  // Make southbound train IDs text black for better readability
  const textColor = direction === "southbound" ? "text-black" : "";

  // Get service type styling
  const serviceTypeColor =
    serviceType === "A"
      ? "bg-mrt-red text-white"
      : serviceType === "B"
      ? "bg-mrt-green text-white"
      : "bg-mrt-blue text-white";

  return (
    <Card>
      <CardHeader className="bg-gray-700 text-white p-3">
        {" "}
        {/* Darker header for trains */}
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center">
              <IconTrain className={`mr-2 ${directionColor}`} size={20} />
              Train {id}
            </CardTitle>
            <CardDescription className="text-gray-300 mt-0.5">
              Details & Status
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* New service type badge */}
            {serviceType && serviceType !== "AB" && (
              <Badge
                className={`uppercase px-2 py-1 font-bold text-xs ${serviceTypeColor}`}
              >
                {serviceType}-train
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`border-none text-xs px-1.5 py-0.5 ${directionColor} ${directionBg} ${directionDarkBg} ${textColor}`}
            >
              {/* Render icon conditionally inline */}
              {direction === "northbound" ? (
                <IconArrowUp size={12} className="mr-1" /> // Use correct icon
              ) : (
                <IconArrowDown size={12} className="mr-1" /> // Use correct icon
              )}
              {direction.charAt(0).toUpperCase() + direction.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 grid grid-cols-1 gap-4">
        {/* Section 1: Status & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <IconRoute className="mr-2 text-gray-500" size={16} />
              <span className="text-gray-600 dark:text-gray-400 mr-2">
                Status:
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {currentStatus}
              </span>
            </div>

            <div className="flex items-center text-sm">
              <IconMapPin className="mr-2 text-gray-500" size={16} />
              <span className="text-gray-600 dark:text-gray-400 mr-2">
                {currentStatus.includes("Transit") ? "Next Stop:" : "Location:"}
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {currentRelevantStationName ?? "N/A"}
              </span>
            </div>
          </div>

          {/* Column 2: Load & Time */}
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <IconUsers className="mr-2 text-gray-500" size={16} />
              <span className="text-gray-600 dark:text-gray-400 mr-2">
                Load:
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {currentLoad} / {capacity}
              </span>
            </div>

            <div className="flex items-center text-sm">
              <IconClock className="mr-2 text-gray-500" size={16} />
              <span className="text-gray-600 dark:text-gray-400 mr-2">
                {currentStatus.includes("Transit")
                  ? "ETA:"
                  : "Departure Schedule:"}
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {currentScheduledTime ?? "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Add separator */}
        <Separator className="my-1" />

        {/* Section 2: Service Pattern Information */}
        {serviceType && serviceType !== "AB" && (
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <IconBuildingSkyscraper
                className="mr-2 text-gray-500"
                size={16}
              />
              <span className="text-gray-600 dark:text-gray-400 mr-2">
                Serves:
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-100">
                {serviceType === "A"
                  ? "All A and AB stations"
                  : serviceType === "B"
                  ? "All B and AB stations"
                  : "All stations"}
              </span>
            </div>

            {/* Next stops section */}
            {currentNextStops && currentNextStops.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center text-sm font-medium">
                  <IconListCheck className="mr-2 text-gray-500" size={16} />
                  <span className="text-gray-600 dark:text-gray-400">
                    Next Stops:
                  </span>
                </div>
                <div className="ml-6 space-y-1">
                  {currentNextStops.map((stop, index) => (
                    <div key={stop.id} className="flex justify-between text-sm">
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {stop.name}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {stop.time ?? "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show list of served stations */}
            {servedStations && servedStations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center text-sm font-medium">
                  <IconRoute className="mr-2 text-gray-500" size={16} />
                  <span className="text-gray-600 dark:text-gray-400">
                    Stop Pattern:
                  </span>
                </div>
                <div className="ml-6 flex flex-wrap gap-1">
                  {servedStations.map((station, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {station}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrainInfo;
