"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as React from "react";
import { IconClock, IconEye, IconEyeOff, IconRoute } from "@tabler/icons-react";
import { parseTime, formatTime } from "@/lib/timeUtils";

interface Station {
  id: number;
  name: string;
  x: number;
  y: number;
  passengers?: number;
  scheme?: "A" | "B" | "AB"; // Add station scheme type for skip-stop patterns
}

interface TrainScheduleEntry {
  stationId: number;
  stationName: string;
  direction: "northbound" | "southbound";
  arrivalTime: string;
  departureTime: string;
  skipType: string | null;
}

export interface TrainSchedule {
  trainId: number;
  schedule: TrainScheduleEntry[];
}

interface Train {
  id: number;
  direction: "northbound" | "southbound";
  currentPosition: { x: number; y: number };
  nextStationIndex: number;
  isAtStation: boolean;
  stationArrivalTime?: string;
  stationDepartureTime?: string;
  dwellTimeRemaining?: number;
}

// Define the structure for the API response (individual timetable entries)
// This can be refined based on the exact fields returned by the Flask API
interface SimulationTimetableEntry {
  // Updated to match TRAIN_MOVEMENTS table structure in schema.prisma
  MOVEMENT_ID?: number;
  SIMULATION_ID?: number;
  SERVICE_TYPE?: string; // Regular, Skip-stop
  SCHEME_TYPE?: string; // "REGULAR" or "SKIP-STOP" - This is the scheme type for the entry
  TRAIN_ID: number; // Changed from "Train ID"
  STATION_ID: number; // Changed from NStation
  DIRECTION: string; // northbound, southbound (case-sensitive!)
  TRAIN_STATUS: "active" | "inactive"; // Updated field
  ARRIVAL_TIME: string | null; // Changed from "Arrival Time"
  DEPARTURE_TIME: string | null; // Changed from "Departure Time"
  TRAVEL_TIME_SECONDS?: number;
  PASSENGERS_BOARDED?: number;
  PASSENGERS_ALIGHTED?: number;
  CURRENT_STATION_PASSENGER_COUNT?: number;

  // Keep backward compatibility with any code still using the old field names
  "Train ID"?: number;
  NStation?: number;
  "Arrival Time"?: string | null;
  "Departure Time"?: string | null;
}

interface TrainInfoData {
  id: number;
  direction: "northbound" | "southbound";
  status: string; // e.g., "At Station", "In Transit", "Turning Around", "Inactive"
  load: number; // Hardcoded 0 for now
  capacity: number;
  relevantStationName: string | null; // Current or next station
  scheduledTime: string | null; // Arrival or Departure time
}

interface MrtMapProps {
  stations?: Station[];
  trains?: Train[]; // This might become obsolete if positions are calculated from timetable
  selectedStation?: number | null;
  onStationClick?: (stationId: number) => void;
  selectedTrainId?: number | null; // NEW: Prop for selected train ID
  onTrainClick?: (trainId: number, details: TrainInfoData) => void; // NEW: Handler prop
  simulationTime?: string;
  isRunning?: boolean;
  // Replace trainSchedules with simulationTimetable from API
  // trainSchedules?: TrainSchedule[];
  simulationTimetable?: SimulationTimetableEntry[] | null; // Use the API response type
  turnaroundTime?: number; // Added prop for turnaround duration
  maxCapacity?: number; // NEW: Max capacity for calculating TrainInfoData

  // NEW: Current selected scheme (for displaying appropriate legend)
  selectedScheme?: "REGULAR" | "SKIP-STOP";
}

// Define the station positions along the HORIZONTAL line
// Assuming map width around 1200, Y midline around 250
const HORIZONTAL_STATION_SPACING = 70;
const MAP_START_X = 170;
const MAP_WIDTH = 1200;
const MAP_MID_Y = 120;
const TRACK_Y_OFFSET = 25; // Increased vertical offset for tracks
const STATION_RADIUS = 10;
const STATION_STROKE_WIDTH = 1.5;
const SELECTED_STATION_RADIUS = 11;
const SELECTED_STATION_STROKE_WIDTH = 3;
const LABEL_Y_OFFSET = -75;
const STATION_VISUAL_X_OFFSET = 120; // Offset to move station visuals right

const NORTH_TERMINUS_ID = 1;
const SOUTH_TERMINUS_ID = 13;
// --- End Turnaround Coordinates ---

// --- Theme Colors (using Tailwind class names for consistency) ---
const THEME = {
  background: "bg-background dark:bg-background", // Use shadcn theme variables
  textPrimary: "fill-foreground dark:fill-foreground",
  textSecondary: "fill-muted-foreground dark:fill-muted-foreground",
  textSelected: "fill-foreground dark:fill-foreground",
  station: {
    default:
      "fill-white dark:fill-gray-700 stroke-gray-400 dark:stroke-gray-500",
    selected:
      "fill-yellow-400 dark:fill-yellow-500 stroke-gray-700 dark:stroke-gray-300",
    hoverRing: "stroke-blue-500/50 dark:stroke-blue-400/50", // More visible hover
    selectedRing: "stroke-yellow-500/60 dark:stroke-yellow-400/60", // Ring for selected
  },
  track: {
    northbound: "stroke-[#00844e] dark:stroke-[#00844e]",
    southbound: "stroke-[#ffcf26] dark:stroke-[#ffcf26]",
  },
  train: {
    northbound: "fill-[#00844e] dark:fill-[#00844e]",
    southbound: "fill-[#ffcf26] dark:fill-[#ffcf26]",
    text: "fill-white font-semibold",
  },
  legend: "bg-card dark:bg-card text-card-foreground dark:text-card-foreground",
  textHtmlPrimary: "text-foreground dark:text-foreground", // For HTML text
  legendIndicator: {
    northbound: "bg-[#00844e] dark:bg-[#00844e]", // Update legend indicator too
    southbound: "bg-[#ffcf26] dark:bg-[#ffcf26]", // Update legend indicator too
  },
};
// --- End Theme Colors ---

const STATIONS: Station[] = Array.from({ length: 13 }, (_, i) => ({
  id: i + 1,
  name: [
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
  ][i],
  x: MAP_START_X + i * HORIZONTAL_STATION_SPACING,
  y: MAP_MID_Y, // Logical Y position
}));

// Helper to get station by ID more easily
const STATIONS_BY_ID = STATIONS.reduce((acc, station) => {
  acc[station.id] = station;
  return acc;
}, {} as { [key: number]: Station });

// Get X coordinate of the center station (Station 7)
const CENTER_STATION_X = STATIONS_BY_ID[7]?.x ?? MAP_WIDTH / 2; // Fallback to map center

// Track path coordinates for HORIZONTAL layout
const TRACK = {
  start: { x: STATIONS[0].x, y: MAP_MID_Y }, // Start at first station X
  end: { x: STATIONS[STATIONS.length - 1].x, y: MAP_MID_Y }, // End at last station X
  // Y coordinates for the parallel tracks
  northboundY: MAP_MID_Y - TRACK_Y_OFFSET,
  southboundY: MAP_MID_Y + TRACK_Y_OFFSET,
  stationCenterY: MAP_MID_Y, // Stations are on the midline
};

// Define U-turn paths
const northTurnaroundPathD = `M ${TRACK.start.x} ${TRACK.northboundY} A ${TRACK_Y_OFFSET} ${TRACK_Y_OFFSET} 0 0 0 ${TRACK.start.x} ${TRACK.southboundY}`;
const southTurnaroundPathD = `M ${TRACK.end.x} ${TRACK.southboundY} A ${TRACK_Y_OFFSET} ${TRACK_Y_OFFSET} 0 0 0 ${TRACK.end.x} ${TRACK.northboundY}`; // Sweep flag changed to 0

// --- Inactive Train Depot Coordinates --- //
const DEPOT_CENTER_Y = MAP_MID_Y + TRACK_Y_OFFSET + 60; // MOVED LOWER
const INACTIVE_TRAIN_SIZE = 16;
const INACTIVE_TRAIN_SPACING = 24; // Size (16) + padding (8)
// --- End Inactive Depot --- //

// Train directions
type Direction = "northbound" | "southbound";

interface TrainState {
  id: number;
  x: number;
  y: number;
  direction: Direction;
  isStopped: boolean;
  isActive: boolean;
  isTurningAround: boolean;
  isInDepot: boolean; // Added flag for inactive trains in the depot
  isNewlyInserted?: boolean; // New flag for trains in insertion state
  serviceType?: "A" | "B" | "AB" | string | null; // Updated to accept string type for Skip-Stop scheme
  rotation: number;
  currentStationIndex: number;
  turnaroundProgress: number | null; // Added for loading circle
}

// Helper function to parse time string to seconds since midnight
function timeToSeconds(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string") return 0;

  // Handle both HH:MM:SS and full datetime format (2023-04-12 07:00:00)
  let timePart = timeStr;
  if (timeStr.includes(" ")) {
    // Extract time part from datetime string
    timePart = timeStr.split(" ")[1];
  }

  if (!timePart.includes(":")) return 0;

  const parts = timePart.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

// Helper to get station X position by ID (Renamed from getStationYById)
function getStationXById(stationId: number): number {
  return STATIONS_BY_ID[stationId]?.x ?? 0;
}

// Remove SAMPLE_TRAIN_SCHEDULES as data comes from props now
// const SAMPLE_TRAIN_SCHEDULES: TrainSchedule[] = [ ... ];

// Define fixed animation duration (can be made a prop later)
// const TURNAROUND_ANIMATION_DURATION_SECONDS = 60; // Remove constant

// Define TrainEventPair interface for use in MrtMapHandle
interface TrainEventPair {
  eventA: any | null; // Current event
  eventB: any | null; // Next event
}

// Create an interface for the data we want to expose
export interface MrtMapHandle {
  getTrainEventPairs: () => Record<number, TrainEventPair>;
  getTrainStates: () => TrainState[];
  getStationsById: () => Record<number, Station>;
}

const MrtMap = forwardRef<MrtMapHandle, MrtMapProps>(
  (
    {
      stations = STATIONS,
      // trains prop might be removed later
      trains: initialTrains = [], // Keep for now, but likely needs rework
      selectedStation = null,
      onStationClick = () => {},
      selectedTrainId,
      onTrainClick,
      simulationTime = "07:00:00",
      isRunning = false,
      // Use simulationTimetable prop, default to null
      // trainSchedules = SAMPLE_TRAIN_SCHEDULES,
      simulationTimetable = null,
      turnaroundTime = 60, // Use prop with default
      maxCapacity = 0, // NEW: Accept maxCapacity prop
      selectedScheme,
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [trainStates, setTrainStates] = useState<TrainState[]>([]);
    // State for debug information displayed on the map
    const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
    const [inactiveTrainCount, setInactiveTrainCount] = useState(0); // State for dynamic box width

    // Debug states
    const [hasLoggedRawData, setHasLoggedRawData] = useState(false);
    const [hasLoggedNormalizedData, setHasLoggedNormalizedData] =
      useState(false);

    // Add visibility state for each visualization
    const [visibilitySettings, setVisibilitySettings] = useState({
      stations: true,
      trains: true,
      stationLabels: true,
    });

    // Toggle handler for visualizations
    const toggleVisualization = (key: keyof typeof visibilitySettings) => {
      setVisibilitySettings((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    };

    // Create empty visualization controls since we removed the button
    const visualizationControls = (
      <div className="absolute top-12 right-2 flex flex-col gap-2 z-20">
        {/* Track congestion button removed */}
      </div>
    );

    // Store event pairs for click handling - Memoize for performance
    const trainEventPairs = useMemo(() => {
      const pairs: Record<number, { eventA: any | null; eventB: any | null }> =
        {};
      if (!simulationTimetable || simulationTimetable.length === 0) {
        return pairs;
      }
      const currentSimSeconds = timeToSeconds(simulationTime);

      // Debug the raw data first
      if (selectedScheme === "SKIP-STOP" && !hasLoggedRawData) {
        console.log(
          "Raw timetable entries for train 1:",
          simulationTimetable
            .filter((entry) => {
              const anyEntry = entry as any;
              return anyEntry.TRAIN_ID === 1 || anyEntry["Train ID"] === 1;
            })
            .slice(0, 3)
        );
        setHasLoggedRawData(true);
      }

      const normalizedTimetable = simulationTimetable.map((entry) => {
        const anyEntry = entry as any;
        const isNewFormat = "TRAIN_ID" in anyEntry || "MOVEMENT_ID" in anyEntry;

        // Create the normalized entry - preserve ALL fields from original
        const normalizedEntry = {
          TRAIN_ID: isNewFormat ? anyEntry.TRAIN_ID : anyEntry["Train ID"],
          STATION_ID: isNewFormat ? anyEntry.STATION_ID : anyEntry.NStation,
          DIRECTION: (isNewFormat
            ? anyEntry.DIRECTION || "southbound"
            : anyEntry.Direction || "southbound"
          ).toLowerCase() as Direction,
          TRAIN_STATUS: isNewFormat
            ? anyEntry.TRAIN_STATUS || "active"
            : anyEntry["Train Status"] || "active",
          ARRIVAL_TIME: isNewFormat
            ? anyEntry.ARRIVAL_TIME
            : anyEntry["Arrival Time"],
          DEPARTURE_TIME: isNewFormat
            ? anyEntry.DEPARTURE_TIME
            : anyEntry["Departure Time"],
          SCHEME_TYPE: anyEntry.SCHEME_TYPE,
          TRAIN_SERVICE_TYPE: anyEntry.TRAIN_SERVICE_TYPE,
          SERVICE_TYPE: anyEntry.SERVICE_TYPE,
          // Add any other fields that might be needed
          ...anyEntry, // Include all original properties
        };

        return normalizedEntry;
      });

      // Debug the normalized data after processing
      if (selectedScheme === "SKIP-STOP" && !hasLoggedNormalizedData) {
        console.log(
          "Normalized timetable entries for train 1:",
          normalizedTimetable
            .filter((entry) => entry.TRAIN_ID === 1)
            .slice(0, 3)
        );
        setHasLoggedNormalizedData(true);
      }

      const timetableByTrain = normalizedTimetable.reduce((acc, entry) => {
        if (
          !entry ||
          typeof entry.TRAIN_ID === "undefined" ||
          entry.ARRIVAL_TIME === null
        ) {
          return acc;
        }
        const trainId = entry.TRAIN_ID;
        if (!acc[trainId]) acc[trainId] = [];
        acc[trainId].push(entry);
        return acc;
      }, {} as { [key: number]: any[] });

      for (const trainId in timetableByTrain) {
        timetableByTrain[trainId].sort((a: any, b: any) => {
          const arrA = timeToSeconds(a.ARRIVAL_TIME!);
          const arrB = timeToSeconds(b.ARRIVAL_TIME!);
          return arrA - arrB;
        });
      }

      for (const trainIdStr in timetableByTrain) {
        const trainId = parseInt(trainIdStr, 10);
        const trainSchedule = timetableByTrain[trainId];
        let eventA = null;
        let eventB = null;
        for (let i = 0; i < trainSchedule.length; i++) {
          const currentEvent = trainSchedule[i];
          const arrivalSec = timeToSeconds(currentEvent.ARRIVAL_TIME!);
          const departureSec = currentEvent.DEPARTURE_TIME
            ? timeToSeconds(currentEvent.DEPARTURE_TIME)
            : arrivalSec;

          if (
            arrivalSec <= currentSimSeconds &&
            currentSimSeconds < departureSec
          ) {
            eventA = currentEvent;
            eventB = null;
            break;
          } else if (departureSec <= currentSimSeconds) {
            const nextEvent = trainSchedule[i + 1];
            if (nextEvent) {
              const nextArrivalSec = timeToSeconds(nextEvent.ARRIVAL_TIME!);
              if (currentSimSeconds < nextArrivalSec) {
                eventA = currentEvent;
                eventB = nextEvent;
                break;
              }
            } else {
              eventA = currentEvent;
              eventB = null;
              break;
            }
          }
        }
        pairs[trainId] = { eventA, eventB };
      }
      return pairs;
    }, [
      simulationTimetable,
      simulationTime,
      selectedScheme,
      hasLoggedRawData,
      hasLoggedNormalizedData,
    ]);

    // Function to get train y position
    const getTrainYPosition = (direction: Direction) => {
      return direction === "southbound" ? TRACK.southboundY : TRACK.northboundY;
    };

    // Function to get train service type
    const getTrainServiceType = (trainId: number) => {
      // Get from eventPairs if possible
      const trainEvents = trainEventPairs[trainId];
      if (trainEvents && (trainEvents.eventA || trainEvents.eventB)) {
        const event = trainEvents.eventA || trainEvents.eventB;
        if (event?.TRAIN_SERVICE_TYPE) {
          return event.TRAIN_SERVICE_TYPE;
        }
      }

      // Fallback: search through the entire timetable
      if (simulationTimetable) {
        // Look through all entries for this train
        for (const entry of simulationTimetable) {
          const anyEntry = entry as any;
          if (
            (anyEntry.TRAIN_ID === trainId ||
              anyEntry["Train ID"] === trainId) &&
            anyEntry.TRAIN_SERVICE_TYPE
          ) {
            console.log(
              `Found TRAIN_SERVICE_TYPE for train ${trainId} in timetable:`,
              anyEntry.TRAIN_SERVICE_TYPE
            );
            return anyEntry.TRAIN_SERVICE_TYPE;
          }
        }
      }

      console.log(`No TRAIN_SERVICE_TYPE found for train ${trainId}`);
      return null;
    };

    // When all else fails, assign service types by train ID as fallback
    // This is used only if we can't get the data from backend
    const getFallbackTrainServiceType = (trainId: number): string => {
      if (selectedScheme !== "SKIP-STOP") return "AB";

      // For demo purposes, Train 1, 3, 5, etc. are A trains
      // Train 2, 4, 6, etc. are B trains
      if (trainId % 2 === 1) return "A";
      return "B";
    };

    // Get train service type with fallback
    const getEffectiveTrainServiceType = (trainId: number): string => {
      const serviceType = getTrainServiceType(trainId);
      if (serviceType) {
        return serviceType;
      }
      // Use fallback if no data from backend
      return getFallbackTrainServiceType(trainId);
    };

    // Function to determine if a train stops at a specific station in skip-stop mode
    const trainStopsAtStation = (
      trainId: number,
      stationId: number
    ): boolean => {
      const trainServiceType = getEffectiveTrainServiceType(trainId);

      // If it's not skip-stop or service type isn't A or B, train stops at all stations
      if (!trainServiceType || trainServiceType === "AB") return true;

      // Get corresponding station scheme pattern
      if (selectedScheme === "SKIP-STOP") {
        // Find the station by ID
        const station = stations.find((s) => s.id === stationId);

        if (!station) return true; // If station not found, assume it stops there (safety)

        // Get station scheme (default to "AB" if not specified)
        const stationScheme = station.scheme || "AB";

        // Determine if the train stops at this station based on actual schemes:
        // - A trains stop at A and AB stations
        // - B trains stop at B and AB stations
        if (trainServiceType === "A") {
          return stationScheme === "A" || stationScheme === "AB";
        } else if (trainServiceType === "B") {
          return stationScheme === "B" || stationScheme === "AB";
        }
      }

      return true; // Default behavior: train stops at all stations
    };

    // --- NEW: Handle Train Click on Map --- //
    const handleMapTrainClick = useCallback(
      (trainId: number) => {
        if (!onTrainClick) return;

        const state = trainStates.find((ts) => ts.id === trainId);
        const events = trainEventPairs[trainId];

        if (!state || !events) {
          console.error(
            `Could not find state or events for clicked train ${trainId}`
          );
          return;
        }

        const { eventA, eventB } = events;
        let statusString = "Unknown";
        let relevantStationName: string | null = null;
        let scheduledTime: string | null = null;

        if (state.isInDepot) {
          statusString = "Inactive";
        } else if (state.isTurningAround) {
          statusString = `Turning Around`;
          if (eventA) {
            relevantStationName =
              STATIONS_BY_ID[eventA.STATION_ID]?.name ??
              `Station ${eventA.STATION_ID}`;
            scheduledTime = eventB?.ARRIVAL_TIME ?? null; // Departure time of the turnaround completion
          }
        } else if (state.isStopped) {
          statusString = `At Station`;
          if (eventA) {
            relevantStationName =
              STATIONS_BY_ID[eventA.STATION_ID]?.name ??
              `Station ${eventA.STATION_ID}`;
            scheduledTime = eventA.DEPARTURE_TIME ?? null;
          }
        } else if (!state.isStopped && eventA && eventB) {
          statusString = `In Transit`;
          relevantStationName =
            STATIONS_BY_ID[eventB.STATION_ID]?.name ??
            `Station ${eventB.STATION_ID}`;
          scheduledTime = eventB.ARRIVAL_TIME ?? null;
        }

        const details: TrainInfoData = {
          id: trainId,
          direction: state.direction,
          status: statusString,
          load: 0, // Hardcoded as per requirement
          capacity: maxCapacity, // Use prop passed down
          relevantStationName,
          scheduledTime,
        };

        onTrainClick(trainId, details);
      },
      [trainStates, trainEventPairs, onTrainClick, maxCapacity] // Dependencies for the handler
    );

    // --- Timetable Processing useEffect (Now primarily sets trainStates) ---
    useEffect(() => {
      console.log(
        `[MapEffect] Update Start - SimTime: ${simulationTime}, TurnaroundTimeProp: ${turnaroundTime}`
      );

      if (!simulationTimetable || simulationTimetable.length === 0) {
        console.log(
          "[MapEffect] No simulation timetable data, clearing trains."
        );
        setTrainStates([]);
        setDebugInfo({});
        setInactiveTrainCount(0); // Reset inactive count
        return;
      }

      const currentSimSeconds = timeToSeconds(simulationTime);
      console.log(
        `Current simulation time: ${simulationTime} (${currentSimSeconds}s)`
      );

      // --- Normalize and Process Timetable Data ---
      const normalizedTimetable = simulationTimetable.map((entry) => {
        const anyEntry = entry as any;
        const isNewFormat = "TRAIN_ID" in anyEntry || "MOVEMENT_ID" in anyEntry;

        // Debug logging to inspect train service types to understand skip-stop behavior
        if (anyEntry.TRAIN_ID === 1 || anyEntry.TRAIN_ID === 2) {
          console.log(
            `Train ${anyEntry.TRAIN_ID} entry at Station ${anyEntry.STATION_ID}:`,
            {
              SCHEME_TYPE: anyEntry.SCHEME_TYPE,
              TRAIN_SERVICE_TYPE: anyEntry.TRAIN_SERVICE_TYPE,
              ARRIVAL_TIME: anyEntry.ARRIVAL_TIME,
              DEPARTURE_TIME: anyEntry.DEPARTURE_TIME,
              // When ARRIVAL_TIME equals DEPARTURE_TIME, the train is not stopping at this station
              SKIPPING:
                anyEntry.ARRIVAL_TIME === anyEntry.DEPARTURE_TIME
                  ? "YES"
                  : "NO",
            }
          );
        }

        return {
          TRAIN_ID: isNewFormat ? anyEntry.TRAIN_ID : anyEntry["Train ID"],
          STATION_ID: isNewFormat ? anyEntry.STATION_ID : anyEntry.NStation,
          DIRECTION: (isNewFormat
            ? anyEntry.DIRECTION || "southbound"
            : anyEntry.Direction || "southbound"
          ).toLowerCase() as Direction,
          TRAIN_STATUS: isNewFormat
            ? anyEntry.TRAIN_STATUS || "active"
            : anyEntry["Train Status"] || "active",
          ARRIVAL_TIME: isNewFormat
            ? anyEntry.ARRIVAL_TIME
            : anyEntry["Arrival Time"],
          DEPARTURE_TIME: isNewFormat
            ? anyEntry.DEPARTURE_TIME
            : anyEntry["Departure Time"],
          // Preserve these fields for skip-stop functionality
          SCHEME_TYPE: anyEntry.SCHEME_TYPE,
          TRAIN_SERVICE_TYPE: anyEntry.TRAIN_SERVICE_TYPE,
          SERVICE_TYPE: anyEntry.SERVICE_TYPE,
        };
      });

      const timetableByTrain = normalizedTimetable.reduce((acc, entry) => {
        if (
          !entry ||
          typeof entry.TRAIN_ID === "undefined" ||
          entry.ARRIVAL_TIME === null // Skip entries without arrival time for sorting
        ) {
          return acc;
        }
        const trainId = entry.TRAIN_ID;
        if (!acc[trainId]) acc[trainId] = [];
        acc[trainId].push(entry);
        return acc;
      }, {} as { [key: number]: any[] });

      for (const trainId in timetableByTrain) {
        timetableByTrain[trainId].sort((a: any, b: any) => {
          const arrA = timeToSeconds(a.ARRIVAL_TIME!);
          const arrB = timeToSeconds(b.ARRIVAL_TIME!);
          return arrA - arrB;
        });
      }

      // --- Calculate Train Positions and States ---
      const newTrainStates: TrainState[] = [];
      let inactiveTrainIndex = 0;
      const processedTrainIds = new Set<number>(); // Keep track of processed trains

      for (const trainIdStr in timetableByTrain) {
        const trainId = parseInt(trainIdStr, 10);
        processedTrainIds.add(trainId);
        const trainSchedule = timetableByTrain[trainId];

        if (trainSchedule.length === 0) continue; // Should not happen after filtering

        const firstEvent = trainSchedule[0];
        const lastEvent = trainSchedule[trainSchedule.length - 1];

        let trainState: TrainState | null = null;
        let isExplicitlyInactive = false;
        let inactiveTriggerEvent: any = null; // Store the event that triggers inactivity

        // 1. Preliminary check: Has the train passed an "inactive" status event?
        for (const event of trainSchedule) {
          if (event.TRAIN_STATUS === "inactive") {
            const departureSec = event.DEPARTURE_TIME
              ? timeToSeconds(event.DEPARTURE_TIME)
              : event.ARRIVAL_TIME
              ? timeToSeconds(event.ARRIVAL_TIME)
              : Infinity; // Use arrival if no departure, else Infinity

            if (
              currentSimSeconds >= departureSec &&
              departureSec !== Infinity
            ) {
              console.log(
                `Train ${trainId}: Found INACTIVE event trigger at time ${
                  event.DEPARTURE_TIME || event.ARRIVAL_TIME
                }. ` +
                  `Condition met (currentSimSeconds=${currentSimSeconds} >= ${departureSec}).`
              );
              isExplicitlyInactive = true;
              inactiveTriggerEvent = event; // Store the specific event
              break; // Found the trigger, no need to check further events for this train
            }
          }

          // NEW: Check for insertion status - trains being initially deployed
          if (
            event.TRAIN_STATUS === "insertion" &&
            event.DIRECTION === "northbound" &&
            event.STATION_ID === 1
          ) {
            // This is a train being inserted at track segment 2,1
            const arrivalAtStation1 = timeToSeconds(event.ARRIVAL_TIME!);
            const insertionTime =
              arrivalAtStation1 - (event.TRAVEL_TIME_SECONDS || 60); // Default to 60 if missing

            // Check if the current simulation time is during the insertion period
            if (
              currentSimSeconds >= insertionTime &&
              currentSimSeconds < arrivalAtStation1
            ) {
              console.log(
                `Train ${trainId}: INSERTION state detected. Insertion time: ${formatTime(
                  insertionTime
                )}, ` + `Arrival at Station 1: ${event.ARRIVAL_TIME}`
              );

              // Calculate position at the center of track segment 2,1
              const station1X = getStationXById(1);
              const station2X = getStationXById(2);
              const centerX = (station1X + station2X) / 2;

              // Calculate progress and position along the insertion segment
              const insertionDuration = event.TRAVEL_TIME_SECONDS || 60;
              const timeInInsertion = currentSimSeconds - insertionTime;
              const progress = Math.min(1, timeInInsertion / insertionDuration);

              // Start at center point, move toward station 1
              const currentX = centerX + (station1X - centerX) * progress;

              trainState = {
                id: trainId,
                x: currentX,
                y: getTrainYPosition("northbound"), // Always northbound for insertion
                direction: "northbound",
                isStopped: false,
                isActive: true,
                isTurningAround: false,
                isInDepot: false,
                isNewlyInserted: true,
                serviceType: getEffectiveTrainServiceType(trainId), // Add service type
                rotation: 180, // Northbound rotation
                currentStationIndex: -1,
                turnaroundProgress: null,
              };

              newTrainStates.push(trainState);
              continue; // Skip to next train
            }
          }
        }

        // 2. If explicitly inactive, set state for depot
        if (isExplicitlyInactive && inactiveTriggerEvent) {
          // Enhance the log to clearly indicate the transition
          console.log(
            `Train ${trainId}: TRANSITIONING to INACTIVE state. Triggered by event at ` +
              `${
                inactiveTriggerEvent.DEPARTURE_TIME ||
                inactiveTriggerEvent.ARRIVAL_TIME
              } ` +
              `(SimTime: ${simulationTime}, ${currentSimSeconds}s)`
          );
          // We calculate the final X position *after* the main loop
          trainState = {
            id: trainId,
            x: 0, // Placeholder X, will be recalculated later
            y: DEPOT_CENTER_Y,
            direction: inactiveTriggerEvent.DIRECTION, // Use direction from the triggering event
            isStopped: true,
            isActive: true, // Visually active in depot
            isTurningAround: false,
            isInDepot: true,
            isNewlyInserted: false,
            serviceType: getEffectiveTrainServiceType(trainId), // Add service type
            rotation: 0, // Depot trains are horizontal
            currentStationIndex: -1,
            turnaroundProgress: null,
          };
          newTrainStates.push(trainState); // Add to list
          continue; // Go to the next trainId
        }

        // 3. If NOT explicitly inactive, determine active state (existing logic)
        //    (We removed the old check that only looked at the *last* event's status)
        const firstArrivalSec = timeToSeconds(firstEvent.ARRIVAL_TIME!);
        if (currentSimSeconds < firstArrivalSec) {
          // Train hasn't started yet, effectively invisible
          // console.log(`Train ${trainId}: Not active yet.`);
          continue; // Skip to next train
        }

        // Find relevant events for active trains
        let eventA = null; // The event defining the start of the current segment
        let eventB = null; // The event defining the end of the current segment

        // (Loop to find eventA and eventB - same as before)
        for (let i = 0; i < trainSchedule.length; i++) {
          const currentEvent = trainSchedule[i];

          // --- Add Detailed Logging inside the loop for Train 5 ---
          if (trainId === 5) {
            console.log(
              `Train 5 Loop (i=${i}): Checking currentEvent:`,
              JSON.stringify(currentEvent)
            );
          }
          // --- End Logging ---

          const arrivalSec = timeToSeconds(currentEvent.ARRIVAL_TIME!);
          const departureSec = currentEvent.DEPARTURE_TIME
            ? timeToSeconds(currentEvent.DEPARTURE_TIME)
            : arrivalSec; // If no departure, assume instant

          // --- Add Logging for time comparison ---
          if (trainId === 5) {
            console.log(
              `Train 5 Loop (i=${i}): SimSec=${currentSimSeconds}, ArrSec=${arrivalSec}, DepSec=${departureSec}`
            );
          }
          // --- End Logging ---

          if (
            arrivalSec <= currentSimSeconds &&
            currentSimSeconds < departureSec
          ) {
            // --- Add Logging for Dwelling Match ---
            if (trainId === 5) {
              console.log(`Train 5 Loop (i=${i}): Matched DWELLING state.`);
            }
            // --- End Logging ---
            eventA = currentEvent;
            eventB = null;
            break;
          } else if (departureSec <= currentSimSeconds) {
            // --- Add Logging for Transit Check ---
            if (trainId === 5) {
              console.log(
                `Train 5 Loop (i=${i}): Checking TRANSIT condition (departureSec <= currentSimSeconds is true).`
              );
            }
            // --- End Logging ---
            const nextEvent = trainSchedule[i + 1];
            // --- Add Logging for nextEvent ---
            if (trainId === 5) {
              console.log(
                `Train 5 Loop (i=${i}): nextEvent:`,
                JSON.stringify(nextEvent)
              );
            }
            // --- End Logging ---

            // Ensure nextEvent exists and is also active
            if (nextEvent) {
              const nextArrivalSec = timeToSeconds(nextEvent.ARRIVAL_TIME!);
              // --- Add Logging for Transit Inner Check ---
              if (trainId === 5) {
                console.log(
                  `Train 5 Loop (i=${i}): nextEvent is valid. nextArrivalSec=${nextArrivalSec}. Checking if currentSimSeconds < nextArrivalSec.`
                );
              }
              // --- End Logging ---
              if (currentSimSeconds < nextArrivalSec) {
                // --- Add Logging for Transit Match ---
                if (trainId === 5) {
                  console.log(
                    `Train 5 Loop (i=${i}): Matched IN TRANSIT state.`
                  );
                }
                // --- End Logging ---
                eventA = currentEvent;
                eventB = nextEvent;
                break;
              }
              // If currentSimSeconds >= nextArrivalSec, we let the loop continue
            } else {
              // --- Add Logging for Last Active/Stuck Match ---
              if (trainId === 5) {
                console.log(
                  `Train 5 Loop (i=${i}): No valid nextEvent. Setting as last active/stuck state.`
                );
              }
              // --- End Logging ---
              // No valid next event (either end of schedule or next is inactive)
              // Treat as stuck at the current station (currentEvent)
              eventA = currentEvent;
              eventB = null;
              break; // Exit loop, state will be "At Station"
            }
          }
        }

        // Calculate State based on identified active events (A and B)
        // (Logic for AT STATION, IN TRANSIT, TURNING AROUND - same as before)
        if (eventA && !eventB) {
          // --- AT STATION (DWELLING or last known active position) ---
          console.log(`Train ${trainId}: At station ${eventA.STATION_ID}.`);
          trainState = {
            id: trainId,
            x: getStationXById(eventA.STATION_ID),
            y: getTrainYPosition(eventA.DIRECTION),
            direction: eventA.DIRECTION,
            isStopped: true,
            isActive: true,
            isTurningAround: false,
            isInDepot: false,
            isNewlyInserted: false,
            serviceType: getEffectiveTrainServiceType(trainId), // Add service type
            rotation: eventA.DIRECTION === "northbound" ? 180 : 0,
            currentStationIndex: stations.findIndex(
              (s) => s.id === eventA.STATION_ID
            ),
            turnaroundProgress: null,
          };
        } else if (eventA && eventB) {
          // --- IN TRANSIT or TURNING AROUND ---
          const departureSec = timeToSeconds(eventA.DEPARTURE_TIME!);
          const arrivalSec = timeToSeconds(eventB.ARRIVAL_TIME!);
          const segmentDuration = arrivalSec - departureSec;
          const timeInSegment = currentSimSeconds - departureSec;

          const isTurnaround =
            eventA.STATION_ID === eventB.STATION_ID &&
            eventA.DIRECTION !== eventB.DIRECTION &&
            (eventA.STATION_ID === NORTH_TERMINUS_ID ||
              eventA.STATION_ID === SOUTH_TERMINUS_ID);

          if (isTurnaround) {
            // --- TURNING AROUND ---
            console.log(
              `Train ${trainId}: Turning around at station ${eventA.STATION_ID}. Turnaround time: ${turnaroundTime}s`
            );
            // Calculate progress using the turnaroundTime prop instead of segmentDuration
            const progress =
              turnaroundTime > 0
                ? Math.min(1, timeInSegment / turnaroundTime)
                : 0;
            const isNorthTurnaround = eventA.STATION_ID === NORTH_TERMINUS_ID;
            const uturnCenterX = isNorthTurnaround
              ? STATIONS_BY_ID[NORTH_TERMINUS_ID].x - TRACK_Y_OFFSET
              : STATIONS_BY_ID[SOUTH_TERMINUS_ID].x + TRACK_Y_OFFSET;
            const uturnCenterY = MAP_MID_Y;

            trainState = {
              id: trainId,
              x: uturnCenterX,
              y: uturnCenterY,
              direction: eventB.DIRECTION,
              isStopped: true,
              isActive: true,
              isTurningAround: true,
              isInDepot: false,
              isNewlyInserted: false,
              serviceType: getEffectiveTrainServiceType(trainId), // Add service type
              rotation: eventB.DIRECTION === "northbound" ? 180 : 0,
              currentStationIndex: -1,
              turnaroundProgress: progress,
            };
          } else {
            // --- IN TRANSIT ---
            console.log(
              `Train ${trainId}: In transit from ${eventA.STATION_ID} to ${eventB.STATION_ID}.`
            );
            const progress =
              segmentDuration > 0
                ? Math.min(1, timeInSegment / segmentDuration)
                : 0;
            const startX = getStationXById(eventA.STATION_ID);
            const endX = getStationXById(eventB.STATION_ID);
            const currentX = startX + (endX - startX) * progress;

            trainState = {
              id: trainId,
              x: currentX,
              y: getTrainYPosition(eventA.DIRECTION),
              direction: eventA.DIRECTION,
              isStopped: false,
              isActive: true,
              isTurningAround: false,
              isInDepot: false,
              isNewlyInserted: false,
              serviceType: getEffectiveTrainServiceType(trainId), // Add service type
              rotation: eventA.DIRECTION === "northbound" ? 180 : 0,
              currentStationIndex: -1,
              turnaroundProgress: null,
            };
          }
        } else {
          // Fallback if no active state found (should be rare now)
          console.warn(
            `Train ${trainId}: Could not determine ACTIVE state at time ${simulationTime}. Hiding train.`
          );
          // Don't add to newTrainStates if state is unknown
          trainState = null;
        }

        // Add the calculated state if valid
        if (trainState) {
          newTrainStates.push(trainState);
        }
      } // End of processing each train

      // --- Recalculate Depot Positions AFTER processing all trains ---
      const finalInactiveCount = newTrainStates.filter(
        (ts) => ts.isInDepot
      ).length;
      let currentInactiveIndex = 0;

      // Identify turning around trains by location (north/south terminus)
      const northTurningTrains = newTrainStates.filter(
        (ts) =>
          ts.isTurningAround &&
          ts.x === STATIONS_BY_ID[NORTH_TERMINUS_ID].x - TRACK_Y_OFFSET
      );
      const southTurningTrains = newTrainStates.filter(
        (ts) =>
          ts.isTurningAround &&
          ts.x === STATIONS_BY_ID[SOUTH_TERMINUS_ID].x + TRACK_Y_OFFSET
      );

      // Apply offset to trains turning around at north terminus
      if (northTurningTrains.length > 1) {
        const Y_OFFSET = 20; // Offset distance for staggered display

        // Sort by arrival time so first train to arrive is first in array
        const sortedTrains = [...northTurningTrains].sort((a, b) => {
          const eventsA = trainEventPairs[a.id]?.eventA;
          const eventsB = trainEventPairs[b.id]?.eventA;

          if (!eventsA || !eventsB) return 0;

          const timeA = eventsA.ARRIVAL_TIME
            ? timeToSeconds(eventsA.ARRIVAL_TIME)
            : 0;
          const timeB = eventsB.ARRIVAL_TIME
            ? timeToSeconds(eventsB.ARRIVAL_TIME)
            : 0;

          return timeA - timeB; // Earlier time first
        });

        // Position trains based on arrival order
        // At north terminus, first train (earlier arrival) is positioned lower (closer to northbound track)
        // because trains exit toward the south side (northbound direction)
        sortedTrains.forEach((train, index) => {
          train.y = MAP_MID_Y + (index === 0 ? Y_OFFSET : -Y_OFFSET);
        });
      }

      // Apply offset to trains turning around at south terminus
      if (southTurningTrains.length > 1) {
        const Y_OFFSET = 20; // Offset distance for staggered display

        // Sort by arrival time so first train to arrive is first in array
        const sortedTrains = [...southTurningTrains].sort((a, b) => {
          const eventsA = trainEventPairs[a.id]?.eventA;
          const eventsB = trainEventPairs[b.id]?.eventA;

          if (!eventsA || !eventsB) return 0;

          const timeA = eventsA.ARRIVAL_TIME
            ? timeToSeconds(eventsA.ARRIVAL_TIME)
            : 0;
          const timeB = eventsB.ARRIVAL_TIME
            ? timeToSeconds(eventsB.ARRIVAL_TIME)
            : 0;

          return timeA - timeB; // Earlier time first
        });

        // Position trains based on arrival order
        // At south terminus, first train (earlier arrival) is positioned higher (closer to southbound track)
        // because trains exit toward the north side (southbound direction)
        sortedTrains.forEach((train, index) => {
          train.y = MAP_MID_Y + (index === 0 ? -Y_OFFSET : Y_OFFSET);
        });
      }

      newTrainStates.forEach((ts) => {
        if (ts.isInDepot) {
          // Calculate centered starting X based on the final total count
          const depotStartX =
            CENTER_STATION_X -
            (finalInactiveCount * INACTIVE_TRAIN_SPACING) / 2;
          // Assign the final X position based on the index
          ts.x = depotStartX + currentInactiveIndex * INACTIVE_TRAIN_SPACING;
          currentInactiveIndex++;
        }
      });
      setInactiveTrainCount(finalInactiveCount); // Update state for depot box size
      // --- End Recalculation ---

      // Collect debug info (simplified)
      const activeTrainCount = newTrainStates.filter(
        (ts) => ts.isActive && !ts.isInDepot
      ).length;
      const inactiveTrainsInDepot = newTrainStates
        .filter((ts) => ts.isInDepot)
        .map((t) => t.id);
      const turningAroundTrains = newTrainStates
        .filter((t) => t.isTurningAround)
        .map((t) => t.id);

      const currentDebugInfo = {
        Time: simulationTime,
        SimSeconds: currentSimSeconds,
        "Visible Trains": newTrainStates.length,
        "Active (Moving/Stopped)": activeTrainCount,
        "Inactive (Depot)":
          inactiveTrainsInDepot.length > 0
            ? inactiveTrainsInDepot.join(", ")
            : "None",
        "Turning Around":
          turningAroundTrains.length > 0
            ? turningAroundTrains.join(", ")
            : "None",
        "Turnaround Time": turnaroundTime,
      };

      // Update state only if necessary
      if (JSON.stringify(newTrainStates) !== JSON.stringify(trainStates)) {
        console.log(
          `Updating train states: ${newTrainStates.length} trains rendered.`
        );
        setTrainStates(newTrainStates);
      }
      setDebugInfo(currentDebugInfo);

      console.log(`[MapEffect] Update End - SimTime: ${simulationTime}`);
    }, [
      simulationTimetable,
      simulationTime,
      stations,
      trainEventPairs,
      turnaroundTime,
    ]);

    // Memoize station elements to prevent unnecessary re-renders
    const stationElements = useMemo(() => {
      return stations.map((station) => {
        const isSelected = station.id === selectedStation;
        const radius = isSelected ? SELECTED_STATION_RADIUS : STATION_RADIUS;
        const strokeWidth = isSelected
          ? SELECTED_STATION_STROKE_WIDTH
          : STATION_STROKE_WIDTH;

        // Get station scheme (default to "AB" if not specified)
        const stationScheme = station.scheme || "AB";

        // Determine station skipping highlights for the selected train
        let stationSkipHighlight = null;
        if (selectedTrainId && selectedScheme === "SKIP-STOP") {
          const willTrainStop = trainStopsAtStation(
            selectedTrainId,
            station.id
          );

          if (!willTrainStop) {
            // Add a visual indicator that this station will be skipped by the selected train
            stationSkipHighlight = (
              <circle
                cx={0}
                cy={0}
                r={radius + 8}
                className="fill-none stroke-red-500/50 dark:stroke-red-400/50"
                strokeWidth={1.5}
                strokeDasharray="4,4"
              />
            );
          }
        }

        // Create station type indicator for skip-stop scheme
        const stationTypeIndicator = selectedScheme === "SKIP-STOP" && (
          <g className="station-type-indicator">
            {stationScheme === "A" && (
              <rect
                x={-radius - 6}
                y={-radius - 14}
                width={radius * 2 + 12}
                height={8}
                rx={2}
                className="fill-purple-600 dark:fill-purple-500"
              />
            )}
            {stationScheme === "B" && (
              <rect
                x={-radius - 6}
                y={-radius - 14}
                width={radius * 2 + 12}
                height={8}
                rx={2}
                className="fill-orange-500 dark:fill-orange-400"
              />
            )}
            {stationScheme === "AB" && (
              <rect
                x={-radius - 6}
                y={-radius - 14}
                width={radius * 2 + 12}
                height={8}
                rx={2}
                className="fill-gray-700 dark:fill-gray-200"
              />
            )}
            <text
              x={0}
              y={-radius - 9}
              textAnchor="middle"
              dy=".3em"
              className="text-[8px] font-semibold fill-white dark:fill-gray-900"
            >
              {stationScheme}
            </text>
          </g>
        );

        return (
          <g
            key={`station-group-${station.id}`}
            className="cursor-pointer group transition-transform duration-200 ease-in-out"
            onClick={() => onStationClick && onStationClick(station.id)}
            transform={`translate(${station.x + STATION_VISUAL_X_OFFSET}, ${
              TRACK.stationCenterY
            })`}
          >
            {stationSkipHighlight}
            {stationTypeIndicator}
            <circle
              cx={0}
              cy={0}
              r={radius + 5}
              className={`fill-transparent transition-all duration-200 ease-in-out ${
                isSelected
                  ? THEME.station.selectedRing
                  : `opacity-0 group-hover:opacity-100 ${THEME.station.hoverRing}`
              }`}
              strokeWidth={2.5}
            />
            <circle
              cx={0}
              cy={0}
              r={radius}
              className={`transition-all duration-200 ease-in-out group-hover:scale-110 ${
                isSelected ? THEME.station.selected : THEME.station.default
              }`}
              strokeWidth={strokeWidth}
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dy=".3em"
              className={`text-[${
                radius * 0.7
              }px] font-medium select-none transition-all duration-200 ease-in-out ${
                isSelected ? THEME.textSelected : THEME.textPrimary
              }`}
            >
              {station.id}
            </text>
          </g>
        );
      });
    }, [
      stations,
      selectedStation,
      onStationClick,
      selectedTrainId,
      selectedScheme,
      trainStopsAtStation,
    ]);

    // Memoize train elements with new design
    const trainElements = useMemo(() => {
      const trainSize = 18; // Size of the square
      const halfTrainSize = trainSize / 2;
      const arrowWidth = 6;
      const arrowHeight = trainSize; // Arrow height matches square

      // Loading circle properties
      const loadingRadius = 12;
      const loadingCircumference = 2 * Math.PI * loadingRadius;
      const loadingStrokeWidth = 2.5;

      return trainStates
        .filter((train) => train.isActive)
        .map((train) => {
          const trainSize = train.isInDepot ? INACTIVE_TRAIN_SIZE : 18; // Use smaller size for depot
          const halfTrainSize = trainSize / 2;
          const arrowWidth = 6;
          const arrowHeight = trainSize;

          // Determine fill color - Use gray if in depot
          const fillColorClass = train.isInDepot
            ? "fill-gray-400 dark:fill-gray-600" // Gray color for inactive
            : train.direction === "southbound"
            ? THEME.train.southbound
            : THEME.train.northbound;

          // Get train service type for visual indicator
          const trainServiceType = getEffectiveTrainServiceType(train.id);
          const isSkipStopTrain =
            selectedScheme === "SKIP-STOP" &&
            trainServiceType &&
            trainServiceType !== "AB";

          // Arrow points definition (base orientation, points right = 0 degrees)
          let arrowPoints = `0,0 ${arrowWidth},${
            arrowHeight / 2
          } 0,${arrowHeight}`;
          // Position arrow relative to center square, pointing right initially
          let arrowTransform = `translate(${halfTrainSize}, ${-halfTrainSize})`;

          // Base transform: Translate to train's x,y and apply fixed rotation based on direction
          // NO transitions here for instant teleportation
          const groupTransform = `translate(${train.x}, ${train.y}) rotate(${train.rotation})`;

          // Get current station if train is stopped
          let currentStationId = null;
          if (train.isStopped && !train.isTurningAround && !train.isInDepot) {
            // Get the eventA (current station) from the train event pairs
            const events = trainEventPairs[train.id];
            if (events && events.eventA) {
              currentStationId = events.eventA.STATION_ID;
            }
          }

          // Get information about next station for in-transit trains
          let nextStationId = null;
          if (!train.isStopped && !train.isTurningAround && !train.isInDepot) {
            // Get the eventB (next station) from the train event pairs
            const events = trainEventPairs[train.id];
            if (events && events.eventB) {
              nextStationId = events.eventB.STATION_ID;
            }
          }

          // Check if the train is approaching a station it will skip
          const willSkipNextStation =
            nextStationId !== null &&
            selectedScheme === "SKIP-STOP" &&
            !trainStopsAtStation(train.id, nextStationId);

          // Debug logging for skip-stop trains
          if (
            (selectedScheme === "SKIP-STOP" && train.id === 1) ||
            train.id === 2
          ) {
            console.log(
              `Train ${train.id} display: ServiceType=${trainServiceType}, isSkipStopTrain=${isSkipStopTrain}`
            );
          }

          return (
            <g
              key={`train-${train.id}`}
              transform={groupTransform}
              onClick={() => handleMapTrainClick(train.id)}
              className={`train-element group cursor-pointer transition-transform duration-200 ease-in-out ${
                train.isInDepot ? "opacity-80" : ""
              } ${
                selectedTrainId === train.id ? "train-selected-highlight" : ""
              } ${
                train.isNewlyInserted
                  ? "train-insertion"
                  : !train.isInDepot && !train.isTurningAround
                  ? train.isStopped
                    ? "train-at-station"
                    : "train-in-transit"
                  : ""
              } ${willSkipNextStation ? "skipping-station" : ""}`}
            >
              {/* Standard Train Visual (Square + Arrow + Text) */}
              {/* Apply slight opacity reduction if turning around, but not full hiding */}
              <g className={train.isTurningAround ? "opacity-75" : ""}>
                <rect
                  x={-halfTrainSize}
                  y={-halfTrainSize}
                  width={trainSize}
                  height={trainSize}
                  className={fillColorClass} // Use the derived fill class
                  rx={2} // Slightly rounded corners
                  strokeWidth={isSkipStopTrain ? 1.5 : 0} // Add stroke for skip-stop trains
                  stroke={isSkipStopTrain ? "white" : "none"}
                  strokeDasharray={trainServiceType === "A" ? "3,1.5" : "none"} // Dashed border for A-trains
                />
                {/* Hide arrow if in depot */}
                {!train.isInDepot && (
                  <polygon
                    points={arrowPoints}
                    className={fillColorClass} // Use the derived fill class
                    transform={arrowTransform}
                  />
                )}
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dy="0.35em"
                  // Counter-rotate text so it's always upright relative to the map
                  transform={`rotate(${-train.rotation})`}
                  className={`text-[10px] select-none pointer-events-none ${
                    train.direction === "southbound"
                      ? "fill-black font-semibold"
                      : THEME.train.text
                  }`}
                >
                  {train.id}
                </text>
              </g>

              {/* Loading Circle (Rendered only during turnaround visual phase) */}
              {train.isTurningAround && train.turnaroundProgress !== null && (
                <g className="loading-circle">
                  {/* Background Circle */}
                  <circle
                    cx="0"
                    cy="0"
                    r={loadingRadius}
                    fill="none"
                    stroke="currentColor"
                    opacity={selectedTrainId === train.id ? 0.3 : 0.2}
                    strokeWidth={loadingStrokeWidth}
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="0"
                    cy="0"
                    r={loadingRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={loadingStrokeWidth}
                    strokeDasharray={loadingCircumference}
                    strokeDashoffset={
                      loadingCircumference * (1 - train.turnaroundProgress)
                    }
                    transform="rotate(-90)"
                    className="transition-[stroke-dashoffset] duration-150 ease-linear"
                  />
                </g>
              )}
            </g>
          );
        });
    }, [
      trainStates,
      selectedTrainId,
      handleMapTrainClick,
      trainEventPairs,
      selectedScheme,
    ]);

    const stationLabelElements = useMemo(() => {
      return stations.map((station) => {
        const isSelected = selectedStation === station.id;
        const labelX = station.x + STATION_VISUAL_X_OFFSET;
        const labelY = TRACK.stationCenterY + LABEL_Y_OFFSET;

        return (
          <text
            key={`label-${station.id}`}
            x={labelX}
            y={labelY}
            transform={`rotate(-45 ${labelX} ${labelY})`}
            textAnchor="middle"
            dy="0.35em"
            className={`text-[11px] select-none transition-all duration-200 ease-in-out ${
              isSelected ? `${THEME.textSelected} font-bold` : THEME.textPrimary
            }`}
          >
            {station.name}
          </text>
        );
      });
    }, [stations, selectedStation]);

    // Expose the train states, events, and stations to parent component
    useImperativeHandle(ref, () => ({
      getTrainEventPairs: () => trainEventPairs,
      getTrainStates: () => trainStates,
      getStationsById: () => STATIONS_BY_ID,
    }));

    return (
      <>
        {/* Add some simple CSS for the highlight */}
        <style>
          {`
          .train-selected-highlight {
            filter: url(#train-highlight);
            opacity: 1 !important; /* Ensure selected is fully opaque */
          }
          
          @keyframes pulse-outline {
            0% { filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.5)); }
            50% { filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.9)); }
            100% { filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.5)); }
          }
          
          @keyframes pulse-transit {
            0% { filter: drop-shadow(0 0 3px rgba(50, 74, 157, 0.6)); }
            50% { filter: drop-shadow(0 0 10px rgba(50, 74, 157, 0.9)); }
            100% { filter: drop-shadow(0 0 3px rgba(50, 74, 157, 0.6)); }
          }
          
          .train-insertion {
            animation: pulse-outline 1.2s infinite;
          }
          
          .train-in-transit {
            animation: pulse-transit 1.5s infinite;
          }
          
          .train-at-station {
            filter: drop-shadow(0 0 8px rgba(197, 33, 39, 0.8));
          }

          .skipping-station {
            animation: pulse-skipping 1.5s infinite alternate;
          }
          
          @keyframes pulse-skipping {
            0% {
              filter: none;
            }
            100% {
              filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.7));
            }
          }
          
          /* Station type indicator animations */
          .station-type-indicator {
            transition: transform 0.2s ease-in-out;
          }
          
          g:hover .station-type-indicator {
            transform: translateY(-3px);
          }
        `}
        </style>
        <div
          className={`relative w-full h-full overflow-hidden ${THEME.background}`}
        >
          {/* Clock Icon for Current Time */}
          <div
            className={`absolute top-2 right-2 bg-card/90 dark:bg-card/90 p-1.5 rounded-full shadow-md text-card-foreground z-20 flex items-center gap-1.5`}
          >
            <IconClock className="w-4 h-4" />
            <span className="font-mono">{simulationTime}</span>
          </div>

          {/* Visualization Control Buttons */}
          {visualizationControls}

          {/* Debug Info Overlay */}
          <div
            className={`absolute top-2 left-2 bg-card/80 dark:bg-card/80 p-2 rounded shadow text-xs font-mono z-20 max-w-xs text-card-foreground`}
          >
            <h4 className="font-bold mb-1">Debug Info</h4>
            <ul>
              {Object.entries(debugInfo).map(([key, value]) => (
                <li
                  key={key}
                  className="whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  <span className="font-semibold">{key}:</span>{" "}
                  {JSON.stringify(value)}
                </li>
              ))}
            </ul>
          </div>

          {/* Legend - conditionally show sections based on visibility */}
          <div
            className={`absolute bottom-2 right-2 p-2 rounded shadow text-xs z-10 flex flex-col space-y-2 ${THEME.legend}`}
          >
            <div className="flex space-x-4">
              <div className="flex items-center">
                {/* Use dedicated legend indicator theme color and increase height */}
                <div
                  className={`w-4 h-2 mr-2 rounded-sm ${THEME.legendIndicator.southbound}`}
                ></div>
                {/* Use HTML text theme color */}
                <span className={THEME.textHtmlPrimary}>Southbound</span>
              </div>
              <div className="flex items-center">
                {/* Use dedicated legend indicator theme color and increase height */}
                <div
                  className={`w-4 h-2 mr-2 rounded-sm ${THEME.legendIndicator.northbound}`}
                ></div>
                {/* Use HTML text theme color */}
                <span className={THEME.textHtmlPrimary}>Northbound</span>
              </div>
            </div>

            {/* Skip-stop legend - only show when SKIP-STOP scheme is selected */}
            {selectedScheme === "SKIP-STOP" && (
              <div className="flex flex-col space-y-2 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium mb-1">
                  Skip-Stop Trains:
                </div>
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <div className="w-5 h-5 mr-2 border border-white border-dashed rounded-sm bg-black"></div>
                    <span className={THEME.textHtmlPrimary}>A-Train</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-5 h-5 mr-2 border border-white rounded-sm bg-black"></div>
                    <span className={THEME.textHtmlPrimary}>B-Train</span>
                  </div>
                </div>

                {/* Add explanation for skipped stations with dashed circles */}
                <div className="flex items-center mt-1">
                  <div className="w-5 h-5 mr-2 rounded-full border-dashed border-2 border-red-500/70 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  </div>
                  <span className={THEME.textHtmlPrimary}>
                    Stations that will be skipped
                  </span>
                </div>

                {/* Station type legend */}
                <div className="text-xs font-medium mt-1 mb-1">
                  Station Types:
                </div>
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <div className="w-6 h-3 mr-2 rounded-sm bg-purple-600 dark:bg-purple-500"></div>
                    <span className={THEME.textHtmlPrimary}>A Stations</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-3 mr-2 rounded-sm bg-orange-500 dark:bg-orange-400"></div>
                    <span className={THEME.textHtmlPrimary}>B Stations</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-3 mr-2 rounded-sm bg-gray-700 dark:bg-gray-200"></div>
                    <span className={THEME.textHtmlPrimary}>AB Stations</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${MAP_WIDTH} 300`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Define marker for arrowheads */}
            <defs>
              {/* ... marker definitions ... */}
              <marker
                id="arrowhead-blue"
                markerWidth="10"
                markerHeight="7"
                refX="0"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#0066CC" />
              </marker>
              <marker
                id="arrowhead-red"
                markerWidth="10"
                markerHeight="7"
                refX="0"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#CC0000" />
              </marker>

              {/* NEW: Filter for highlighting selected train */}
              <filter
                id="train-highlight"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="3"
                  floodColor="#FBBF24"
                  floodOpacity="0.8"
                />
              </filter>
            </defs>

            {/* --- Track Lines (Direct SVG Stroke) --- */}
            {/* Northbound Track (Blue) */}
            <line
              x1={TRACK.start.x}
              y1={TRACK.northboundY}
              x2={TRACK.end.x}
              y2={TRACK.northboundY}
              className={`${THEME.track.northbound}`}
              strokeWidth={4.5}
            />
            {/* Southbound Track (Red) */}
            <line
              x1={TRACK.start.x}
              y1={TRACK.southboundY}
              x2={TRACK.end.x}
              y2={TRACK.southboundY}
              className={`${THEME.track.southbound}`}
              strokeWidth={4.5}
            />

            {/* --- U-Turn Tracks (Dashed) --- */}
            <path
              d={northTurnaroundPathD}
              fill="none"
              className={`${THEME.track.northbound} opacity-70`} // Use track color or a neutral one
              strokeWidth={3}
              strokeDasharray="4, 4" // Dashed line style
            />
            <path
              d={southTurnaroundPathD}
              fill="none"
              className={`${THEME.track.southbound} opacity-70`} // Use track color or a neutral one
              strokeWidth={3}
              strokeDasharray="4, 4" // Dashed line style
            />

            {/* Render station labels first (behind stations/trains) */}
            <g className="station-labels">{stationLabelElements}</g>

            {/* Station Elements */}
            <g className="stations">{stationElements}</g>

            {/* Train Elements */}
            <g className="trains">{trainElements}</g>

            {/* --- Inactive Train Depot Area --- */}
            <g className="inactive-depot">
              <rect
                // Calculate centered X based on dynamic width and center station
                x={
                  CENTER_STATION_X -
                  (inactiveTrainCount > 0
                    ? INACTIVE_TRAIN_SPACING * inactiveTrainCount + 30 // Increased padding
                    : 80) / // Adjusted min width slightly
                    2
                }
                y={DEPOT_CENTER_Y - (INACTIVE_TRAIN_SIZE + 30) / 2} // Increased padding, adjusted y
                // Calculate width: padding + (space for each train) + padding
                width={
                  inactiveTrainCount > 0
                    ? INACTIVE_TRAIN_SPACING * inactiveTrainCount + 30 // Increased padding (15+15)
                    : 80 // Adjusted min width slightly
                }
                height={INACTIVE_TRAIN_SIZE + 30} // INCREASED Height padding (15+15)
                fill="rgba(150, 150, 150, 0.1)" // Semi-transparent grey
                stroke="rgba(100, 100, 100, 0.3)" // Dim border
                strokeWidth={1}
                rx={5} // Rounded corners
              />
              <text
                // Center the text horizontally above the box relative to Station 7
                x={CENTER_STATION_X}
                y={DEPOT_CENTER_Y - (INACTIVE_TRAIN_SIZE + 30) / 2 - 6} // Position text above the larger box
                textAnchor="middle"
                className="text-[10px] fill-gray-500 dark:fill-gray-400 font-medium"
              >
                Inactive Trains
              </text>
            </g>
          </svg>
        </div>
      </>
    );
  }
);

export default MrtMap;
