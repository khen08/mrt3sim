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
import {
  HORIZONTAL_STATION_SPACING,
  MAP_START_X,
  MAP_WIDTH,
  MAP_MID_Y,
  TRACK_Y_OFFSET,
  STATION_RADIUS,
  SELECTED_STATION_RADIUS,
  STATION_STROKE_WIDTH,
  SELECTED_STATION_STROKE_WIDTH,
  LABEL_Y_OFFSET,
  STATION_VISUAL_X_OFFSET,
  NORTH_TERMINUS_ID,
  SOUTH_TERMINUS_ID,
  DEPOT_CENTER_Y,
  INACTIVE_TRAIN_SIZE,
  INACTIVE_TRAIN_SPACING,
} from "@/lib/constants"; // Import layout constants

// Type for the raw station config data passed as a prop
interface StationConfigData {
  name: string;
  distance: number; // Assuming distance is still relevant if passed
  scheme?: "A" | "B" | "AB";
}

// Internal Station type including calculated coordinates
interface Station {
  id: number;
  name: string;
  x: number;
  y: number;
  passengers?: number;
  scheme?: "A" | "B" | "AB";
}

interface TrainScheduleEntry {
  stationId: number;
  stationName: string;
  direction: "NORTHBOUND" | "SOUTHBOUND";
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
  direction: "NORTHBOUND" | "SOUTHBOUND";
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
  TRAIN_STATUS: "ACTIVE" | "INACTIVE"; // Updated field
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
  direction: "NORTHBOUND" | "SOUTHBOUND";
  status: string; // e.g., "At Station", "In Transit", "Turning Around", "Inactive"
  load: number; // Hardcoded 0 for now
  capacity: number;
  relevantStationName: string | null; // Current or next station
  scheduledTime: string | null; // Arrival or Departure time
}

interface MrtMapProps {
  // Rename 'stations' prop to 'stationConfigData' and use the new type
  stationConfigData?: StationConfigData[];
  // trains?: Train[]; // This might become obsolete
  selectedStation?: number | null;
  onStationClick?: (stationId: number) => void;
  selectedTrainId?: number | null;
  onTrainClick?: (trainId: number, details: TrainInfoData) => void;
  simulationTime?: string;
  isRunning?: boolean;
  simulationTimetable?: SimulationTimetableEntry[] | null;
  turnaroundTime?: number;
  maxCapacity?: number;
  selectedScheme?: "REGULAR" | "SKIP-STOP";
}

// --- Theme Colors (Reinstating) ---
const THEME = {
  background: "bg-background dark:bg-background",
  textPrimary: "fill-foreground dark:fill-foreground",
  textSecondary: "fill-muted-foreground dark:fill-muted-foreground",
  textSelected: "fill-foreground dark:fill-foreground",
  station: {
    default:
      "fill-white dark:fill-gray-700 stroke-gray-400 dark:stroke-gray-500",
    selected:
      "fill-yellow-400 dark:fill-yellow-500 stroke-gray-700 dark:stroke-gray-300",
    hoverRing: "stroke-blue-500/50 dark:stroke-blue-400/50",
    selectedRing: "stroke-yellow-500/60 dark:stroke-yellow-400/60",
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
  textHtmlPrimary: "text-foreground dark:text-foreground",
  legendIndicator: {
    northbound: "bg-[#00844e] dark:bg-[#00844e]",
    southbound: "bg-[#ffcf26] dark:bg-[#ffcf26]",
  },
};
// --- End Theme Colors ---

// --- Generate internal STATIONS based on props or defaults ---
// Function to generate stations
const generateStations = (configData?: StationConfigData[]): Station[] => {
  // Use provided names or fall back to defaults
  const stationNames = configData
    ? configData.map((s) => s.name)
    : [
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
      ];

  return stationNames.map((name, i) => ({
    id: i + 1,
    name: name,
    x: MAP_START_X + i * HORIZONTAL_STATION_SPACING, // Use constants
    y: MAP_MID_Y, // Use constants
    scheme: configData ? configData[i]?.scheme : undefined, // Get scheme from config if available
  }));
};

// Train directions
type Direction = "NORTHBOUND" | "SOUTHBOUND";

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
      stationConfigData, // Use new prop name
      // trains prop might be removed later
      // trains: initialTrains = [],
      selectedStation = null,
      onStationClick = () => {},
      selectedTrainId,
      onTrainClick,
      simulationTime = "07:00:00",
      isRunning = false,
      simulationTimetable = null,
      turnaroundTime = 60,
      maxCapacity = 0,
      selectedScheme,
    },
    ref
  ) => {
    // --- Generate stations and related helpers inside the component ---
    const stations = useMemo(
      () => generateStations(stationConfigData),
      [stationConfigData]
    );

    const stationsById = useMemo(() => {
      return stations.reduce((acc, station) => {
        acc[station.id] = station;
        return acc;
      }, {} as { [key: number]: Station });
    }, [stations]);

    const centerStationX = useMemo(() => {
      return stationsById[7]?.x ?? MAP_WIDTH / 2; // Calculate center X
    }, [stationsById]);

    // --- Define TRACK constant inside the component scope ---
    const TRACK = useMemo(
      () => ({
        start: { x: stations[0]?.x ?? MAP_START_X, y: MAP_MID_Y },
        end: {
          x:
            stations[stations.length - 1]?.x ??
            MAP_START_X + (stations.length - 1) * HORIZONTAL_STATION_SPACING,
          y: MAP_MID_Y,
        },
        northboundY: MAP_MID_Y - TRACK_Y_OFFSET,
        southboundY: MAP_MID_Y + TRACK_Y_OFFSET,
        stationCenterY: MAP_MID_Y,
      }),
      [stations]
    ); // Depends on generated stations

    // --- Define U-Turn Paths inside component scope (or derive from TRACK) ---
    const northTurnaroundPathD = useMemo(
      () =>
        `M ${TRACK.start.x} ${TRACK.northboundY} A ${TRACK_Y_OFFSET} ${TRACK_Y_OFFSET} 0 0 0 ${TRACK.start.x} ${TRACK.southboundY}`,
      [TRACK]
    );
    const southTurnaroundPathD = useMemo(
      () =>
        `M ${TRACK.end.x} ${TRACK.southboundY} A ${TRACK_Y_OFFSET} ${TRACK_Y_OFFSET} 0 0 0 ${TRACK.end.x} ${TRACK.northboundY}`,
      [TRACK]
    );
    // --- End generated constants ---

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

    // Store event pairs for click handling - Memoize for performance
    const trainEventPairs = useMemo(() => {
      const pairs: Record<number, { eventA: any | null; eventB: any | null }> =
        {};
      if (!simulationTimetable || simulationTimetable.length === 0) {
        return pairs;
      }
      const currentSimSeconds = timeToSeconds(simulationTime);

      const normalizedTimetable = simulationTimetable.map((entry) => {
        const anyEntry = entry as any;
        const isNewFormat = "TRAIN_ID" in anyEntry || "MOVEMENT_ID" in anyEntry;

        // Create the normalized entry - preserve ALL fields from original
        const normalizedEntry = {
          TRAIN_ID: isNewFormat ? anyEntry.TRAIN_ID : anyEntry["Train ID"],
          STATION_ID: isNewFormat ? anyEntry.STATION_ID : anyEntry.NStation,
          DIRECTION: (isNewFormat
            ? anyEntry.DIRECTION || "SOUTHBOUND"
            : anyEntry.Direction || "SOUTHBOUND") as Direction,
          TRAIN_STATUS: (isNewFormat
            ? anyEntry.TRAIN_STATUS || "ACTIVE"
            : anyEntry["Train Status"] || "ACTIVE") as "ACTIVE" | "INACTIVE",
          ARRIVAL_TIME: isNewFormat
            ? anyEntry.ARRIVAL_TIME
            : anyEntry["Arrival Time"],
          DEPARTURE_TIME: isNewFormat
            ? anyEntry.DEPARTURE_TIME
            : anyEntry["Departure Time"],
          SCHEME_TYPE: anyEntry.SCHEME_TYPE,
          TRAIN_SERVICE_TYPE: anyEntry.TRAIN_SERVICE_TYPE,
          SERVICE_TYPE: anyEntry.SERVICE_TYPE,
          TRAVEL_TIME_SECONDS: anyEntry.TRAVEL_TIME_SECONDS, // Needed for later calcs
          // Add any other fields that might be needed
          ...anyEntry, // Include all original properties
        };

        return normalizedEntry;
      });

      // Debug the normalized data after processing
      if (selectedScheme === "SKIP-STOP" && !hasLoggedNormalizedData) {
        // console.log(
        //   "Normalized timetable entries for train 1:",
        //   normalizedTimetable
        //     .filter((entry) => entry.TRAIN_ID === 1)
        //     .slice(0, 3)
        // );
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
      return direction === "SOUTHBOUND" ? TRACK.southboundY : TRACK.northboundY;
    };

    // Function to get train service type
    const getTrainServiceType = useCallback(
      (trainId: number) => {
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
              // console.log(
              //   `Found TRAIN_SERVICE_TYPE for train ${trainId} in timetable:`,
              //   anyEntry.TRAIN_SERVICE_TYPE
              // );
              return anyEntry.TRAIN_SERVICE_TYPE;
            }
          }
        }

        // console.log(`No TRAIN_SERVICE_TYPE found for train ${trainId}`);
        return null;
      },
      [simulationTimetable, trainEventPairs]
    );

    // When all else fails, assign service types by train ID as fallback
    // This is used only if we can't get the data from backend
    const getFallbackTrainServiceType = useCallback(
      (trainId: number): string => {
        if (selectedScheme !== "SKIP-STOP") return "AB";

        // For demo purposes, Train 1, 3, 5, etc. are A trains
        // Train 2, 4, 6, etc. are B trains
        if (trainId % 2 === 1) return "A";
        return "B";
      },
      [selectedScheme]
    );

    // Get train service type with fallback
    const getEffectiveTrainServiceType = useCallback(
      (trainId: number): string => {
        const serviceType = getTrainServiceType(trainId);
        if (serviceType) {
          return serviceType;
        }
        // Use fallback if no data from backend
        return getFallbackTrainServiceType(trainId);
      },
      [getTrainServiceType, getFallbackTrainServiceType]
    );

    // Function to determine if a train stops at a specific station in skip-stop mode
    const trainStopsAtStation = useCallback(
      (trainId: number, stationId: number): boolean => {
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
      },
      [stations, selectedScheme, getEffectiveTrainServiceType]
    );

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
          statusString = "INACTIVE";
        } else if (state.isTurningAround) {
          statusString = `Turning Around`;
          if (eventA) {
            relevantStationName =
              stationsById[eventA.STATION_ID]?.name ?? // Use stationsById
              `Station ${eventA.STATION_ID}`;
            scheduledTime = eventB?.ARRIVAL_TIME ?? null;
          }
        } else if (state.isStopped) {
          statusString = `At Station`;
          if (eventA) {
            relevantStationName =
              stationsById[eventA.STATION_ID]?.name ?? // Use stationsById
              `Station ${eventA.STATION_ID}`;
            scheduledTime = eventA.DEPARTURE_TIME ?? null;
          }
        } else if (!state.isStopped && eventA && eventB) {
          statusString = `In Transit`;
          relevantStationName =
            stationsById[eventB.STATION_ID]?.name ?? // Use stationsById
            `Station ${eventB.STATION_ID}`;
          scheduledTime = eventB.ARRIVAL_TIME ?? null;
        }

        const details: TrainInfoData = {
          id: trainId,
          direction: state.direction,
          status: statusString,
          load: 0,
          capacity: maxCapacity,
          relevantStationName,
          scheduledTime,
        };

        onTrainClick(trainId, details);
      },
      [trainStates, trainEventPairs, onTrainClick, maxCapacity, stationsById]
    );

    // --- NEW: Pre-calculate Train Operational Windows ---
    const trainOperationalWindows = useMemo(() => {
      const windows: Record<
        number,
        { firstEventTime: number; lastEventTime: number }
      > = {};
      if (!simulationTimetable || simulationTimetable.length === 0) {
        return windows;
      }

      // Use the same normalization and grouping logic
      const normalizedTimetable = simulationTimetable.map((entry) => {
        const anyEntry = entry as any;
        const isNewFormat = "TRAIN_ID" in anyEntry || "MOVEMENT_ID" in anyEntry;
        return {
          TRAIN_ID: isNewFormat ? anyEntry.TRAIN_ID : anyEntry["Train ID"],
          STATION_ID: isNewFormat ? anyEntry.STATION_ID : anyEntry.NStation,
          DIRECTION: (isNewFormat
            ? anyEntry.DIRECTION || "SOUTHBOUND"
            : anyEntry.Direction || "SOUTHBOUND") as Direction,
          TRAIN_STATUS: (isNewFormat
            ? anyEntry.TRAIN_STATUS || "ACTIVE"
            : anyEntry["Train Status"] || "ACTIVE") as
            | "ACTIVE"
            | "INACTIVE"
            | "INSERTION", // Add INSERTION
          ARRIVAL_TIME: isNewFormat
            ? anyEntry.ARRIVAL_TIME
            : anyEntry["Arrival Time"],
          DEPARTURE_TIME: isNewFormat
            ? anyEntry.DEPARTURE_TIME
            : anyEntry["Departure Time"],
          TRAVEL_TIME_SECONDS: anyEntry.TRAVEL_TIME_SECONDS, // Needed for insertion calc later
        };
      });

      const timetableByTrain = normalizedTimetable.reduce((acc, entry) => {
        if (
          !entry ||
          typeof entry.TRAIN_ID === "undefined" ||
          !entry.ARRIVAL_TIME
        ) {
          return acc;
        }
        const trainId = entry.TRAIN_ID;
        if (!acc[trainId]) acc[trainId] = [];
        acc[trainId].push(entry);
        return acc;
      }, {} as { [key: number]: any[] });

      // Sort and find first/last times for each train
      for (const trainIdStr in timetableByTrain) {
        const trainId = parseInt(trainIdStr, 10);
        const trainSchedule = timetableByTrain[trainId];

        // Sort by arrival time first
        trainSchedule.sort((a: any, b: any) => {
          const arrA = timeToSeconds(a.ARRIVAL_TIME!);
          const arrB = timeToSeconds(b.ARRIVAL_TIME!);
          return arrA - arrB;
        });

        if (trainSchedule.length > 0) {
          const firstEvent = trainSchedule[0];
          const lastEvent = trainSchedule[trainSchedule.length - 1];

          // Calculate first event time (handle potential insertion)
          let firstTime = timeToSeconds(firstEvent.ARRIVAL_TIME!);
          if (
            firstEvent.TRAIN_STATUS === "INSERTION" &&
            firstEvent.STATION_ID === 1 &&
            firstEvent.DIRECTION === "NORTHBOUND"
          ) {
            firstTime = firstTime - (firstEvent.TRAVEL_TIME_SECONDS || 60);
          }

          // Calculate last event time (use departure if available, else arrival)
          const lastDepartureTime = lastEvent.DEPARTURE_TIME
            ? timeToSeconds(lastEvent.DEPARTURE_TIME)
            : 0;
          const lastArrivalTime = timeToSeconds(lastEvent.ARRIVAL_TIME!);
          const lastTime = Math.max(lastDepartureTime, lastArrivalTime); // Use the later of the two

          windows[trainId] = {
            firstEventTime: firstTime,
            lastEventTime: lastTime,
          };
        }
      }
      // console.log("Calculated Train Operational Windows:", windows); // Log calculated windows
      return windows;
    }, [simulationTimetable]); // Dependency: recalculate when timetable changes

    // --- Timetable Processing useEffect (Now primarily sets trainStates) ---
    useEffect(() => {
      if (!simulationTimetable || simulationTimetable.length === 0) {
        setTrainStates([]);
        setDebugInfo({});
        setInactiveTrainCount(0);
        return;
      }
      const currentSimSeconds = timeToSeconds(simulationTime);

      // Re-group timetable by train (needed for eventA/eventB logic)
      const normalizedTimetable = simulationTimetable.map((entry) => {
        const anyEntry = entry as any;
        const isNewFormat = "TRAIN_ID" in anyEntry || "MOVEMENT_ID" in anyEntry;
        return {
          TRAIN_ID: isNewFormat ? anyEntry.TRAIN_ID : anyEntry["Train ID"],
          STATION_ID: isNewFormat ? anyEntry.STATION_ID : anyEntry.NStation,
          DIRECTION: (isNewFormat
            ? anyEntry.DIRECTION || "SOUTHBOUND"
            : anyEntry.Direction || "SOUTHBOUND") as Direction,
          TRAIN_STATUS: (isNewFormat
            ? anyEntry.TRAIN_STATUS || "ACTIVE"
            : anyEntry["Train Status"] || "ACTIVE") as
            | "ACTIVE"
            | "INACTIVE"
            | "INSERTION", // Added INSERTION
          ARRIVAL_TIME: isNewFormat
            ? anyEntry.ARRIVAL_TIME
            : anyEntry["Arrival Time"],
          DEPARTURE_TIME: isNewFormat
            ? anyEntry.DEPARTURE_TIME
            : anyEntry["Departure Time"],
          TRAVEL_TIME_SECONDS: anyEntry.TRAVEL_TIME_SECONDS, // Keep for insertion
          SCHEME_TYPE: anyEntry.SCHEME_TYPE,
          TRAIN_SERVICE_TYPE: anyEntry.TRAIN_SERVICE_TYPE,
          SERVICE_TYPE: anyEntry.SERVICE_TYPE,
        };
      });
      const timetableByTrain = normalizedTimetable.reduce((acc, entry) => {
        if (
          !entry ||
          typeof entry.TRAIN_ID === "undefined" ||
          !entry.ARRIVAL_TIME
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
      const allTrainIds = Object.keys(trainOperationalWindows).map(Number);

      for (const trainId of allTrainIds) {
        const trainSchedule = timetableByTrain[trainId] || [];

        let trainState: TrainState | null = null;
        let isExplicitlyInactive = false;
        let inactiveTriggerEvent: any = null;

        // --- NEW: Check Operational Window First ---
        const operationalWindow = trainOperationalWindows[trainId];
        let isOutsideWindow = false;
        if (operationalWindow) {
          if (
            currentSimSeconds < operationalWindow.firstEventTime ||
            currentSimSeconds > operationalWindow.lastEventTime
          ) {
            isOutsideWindow = true;
          }
        } else {
          isOutsideWindow = true; // No window = inactive
        }

        // --- Check for Explicit INACTIVE status ---
        if (trainSchedule) {
          for (const event of trainSchedule) {
            if (event.TRAIN_STATUS === "INACTIVE") {
              const departureSec = event.DEPARTURE_TIME
                ? timeToSeconds(event.DEPARTURE_TIME)
                : event.ARRIVAL_TIME
                ? timeToSeconds(event.ARRIVAL_TIME)
                : Infinity;
              if (
                currentSimSeconds >= departureSec &&
                departureSec !== Infinity
              ) {
                isExplicitlyInactive = true;
                inactiveTriggerEvent = event;
                break;
              }
            }
          }
        }

        // --- Determine Final Inactive State ---
        if (isOutsideWindow || isExplicitlyInactive) {
          let inactiveDirection: Direction = "SOUTHBOUND"; // Default
          if (inactiveTriggerEvent) {
            inactiveDirection = inactiveTriggerEvent.DIRECTION;
          } else if (operationalWindow && trainSchedule.length > 0) {
            inactiveDirection =
              trainSchedule[trainSchedule.length - 1].DIRECTION;
          }

          trainState = {
            id: trainId,
            x: 0,
            y: DEPOT_CENTER_Y,
            direction: inactiveDirection,
            isStopped: true,
            isActive: true,
            isTurningAround: false,
            isInDepot: true,
            isNewlyInserted: false,
            serviceType: getEffectiveTrainServiceType(trainId),
            rotation: 0,
            currentStationIndex: -1,
            turnaroundProgress: null,
          };
          newTrainStates.push(trainState);
          continue; // Next trainId
        }

        // --- Check for Insertion State ---
        let isInInsertionState = false;
        if (trainSchedule) {
          for (const event of trainSchedule) {
            if (
              event.TRAIN_STATUS === "INSERTION" &&
              event.DIRECTION === "NORTHBOUND" &&
              event.STATION_ID === 1
            ) {
              const arrivalAtStation1 = timeToSeconds(event.ARRIVAL_TIME!);
              const insertionTime =
                arrivalAtStation1 - (event.TRAVEL_TIME_SECONDS || 60);
              if (
                currentSimSeconds >= insertionTime &&
                currentSimSeconds < arrivalAtStation1
              ) {
                const station1X = stationsById[1]?.x ?? 0;
                const station2X = stationsById[2]?.x ?? 0;
                const centerX = (station1X + station2X) / 2;
                const insertionDuration = event.TRAVEL_TIME_SECONDS || 60;
                const timeInInsertion = currentSimSeconds - insertionTime;
                const progress = Math.min(
                  1,
                  timeInInsertion / insertionDuration
                );
                const currentX = centerX + (station1X - centerX) * progress;
                trainState = {
                  id: trainId,
                  x: currentX,
                  y: getTrainYPosition("NORTHBOUND"),
                  direction: "NORTHBOUND",
                  isStopped: false,
                  isActive: true,
                  isTurningAround: false,
                  isInDepot: false,
                  isNewlyInserted: true,
                  serviceType: getEffectiveTrainServiceType(trainId),
                  rotation: 180,
                  currentStationIndex: -1,
                  turnaroundProgress: null,
                };
                isInInsertionState = true;
                break;
              }
            }
          }
        }
        if (isInInsertionState && trainState) {
          newTrainStates.push(trainState);
          continue; // Next trainId
        }

        // --- Determine Active State (At Station, In Transit, Turning Around) ---
        if (trainSchedule && trainSchedule.length > 0) {
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

          // --- Calculate State based on eventA, eventB ---
          if (eventA && !eventB) {
            // AT STATION
            trainState = {
              id: trainId,
              x: stationsById[eventA.STATION_ID]?.x ?? 0,
              y: getTrainYPosition(eventA.DIRECTION),
              direction: eventA.DIRECTION,
              isStopped: true,
              isActive: true,
              isTurningAround: false,
              isInDepot: false,
              isNewlyInserted: false,
              serviceType: getEffectiveTrainServiceType(trainId),
              rotation: eventA.DIRECTION === "NORTHBOUND" ? 180 : 0,
              currentStationIndex: stations.findIndex(
                (s) => s.id === eventA.STATION_ID
              ),
              turnaroundProgress: null,
            };
          } else if (eventA && eventB) {
            // IN TRANSIT or TURNING AROUND
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
              // TURNING AROUND
              const progress =
                turnaroundTime > 0
                  ? Math.min(1, timeInSegment / turnaroundTime)
                  : 0;
              const isNorthTurnaround = eventA.STATION_ID === NORTH_TERMINUS_ID;
              const uturnCenterX = isNorthTurnaround
                ? stationsById[NORTH_TERMINUS_ID]?.x - TRACK_Y_OFFSET
                : stationsById[SOUTH_TERMINUS_ID]?.x + TRACK_Y_OFFSET;
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
                serviceType: getEffectiveTrainServiceType(trainId),
                rotation: eventB.DIRECTION === "NORTHBOUND" ? 180 : 0,
                currentStationIndex: -1,
                turnaroundProgress: progress,
              };
            } else {
              // IN TRANSIT
              const progress =
                segmentDuration > 0
                  ? Math.min(1, timeInSegment / segmentDuration)
                  : 0;
              const startX = stationsById[eventA.STATION_ID]?.x ?? 0;
              const endX = stationsById[eventB.STATION_ID]?.x ?? 0;
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
                serviceType: getEffectiveTrainServiceType(trainId),
                rotation: eventA.DIRECTION === "NORTHBOUND" ? 180 : 0,
                currentStationIndex: -1,
                turnaroundProgress: null,
              };
            }
          } else {
            // Fallback
            console.warn(
              `Train ${trainId}: Could not determine ACTIVE state at time ${simulationTime}. Hiding train.`
            );
            trainState = null;
          }
        } else {
          // No schedule found
          console.warn(
            `Train ${trainId}: Has operational window but no schedule found. Hiding train.`
          );
          trainState = null;
        }

        // Add the calculated state if valid
        if (trainState) {
          newTrainStates.push(trainState);
        }
      } // End of for loop

      // --- Recalculate Depot Positions & Stagger Turning Trains ---
      const finalInactiveCount = newTrainStates.filter(
        (ts) => ts.isInDepot
      ).length;
      let currentInactiveIndex = 0;

      // Calculate depot box properties for centering
      const depotBoxPadding = 15; // Horizontal padding inside the box
      const depotBoxWidth =
        finalInactiveCount > 0
          ? INACTIVE_TRAIN_SPACING * finalInactiveCount + depotBoxPadding * 2
          : 80;
      const depotBoxX = centerStationX - depotBoxWidth / 2;

      // Calculate the total width occupied by the trains themselves
      const trainsWidth = finalInactiveCount * INACTIVE_TRAIN_SPACING;
      // Calculate the starting X for the first train, centered within the box
      // (Box Start X + Half Box Width - Half Trains Width)
      // Simplified: Box Start X + (Box Width - Trains Width) / 2
      // Or more accurately considering spacing: depotBoxX + depotBoxPadding
      const firstTrainX =
        depotBoxX +
        depotBoxPadding +
        INACTIVE_TRAIN_SPACING / 1.2 -
        INACTIVE_TRAIN_SIZE / 2;

      // --- START: Re-insert Staggering Logic ---
      // Identify turning around trains by location (north/south terminus)
      const northTurningTrains = newTrainStates.filter(
        (ts) =>
          ts.isTurningAround &&
          ts.x === stationsById[NORTH_TERMINUS_ID]?.x - TRACK_Y_OFFSET
      );
      const southTurningTrains = newTrainStates.filter(
        (ts) =>
          ts.isTurningAround &&
          ts.x === stationsById[SOUTH_TERMINUS_ID]?.x + TRACK_Y_OFFSET
      );

      // Apply offset to trains turning around at north terminus
      if (northTurningTrains.length > 1) {
        const Y_OFFSET = 15; // Offset distance for staggered display
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
        sortedTrains.forEach((train, index) => {
          train.y = MAP_MID_Y + (index === 0 ? Y_OFFSET : -Y_OFFSET); // First lower, second higher
        });
      }

      // Apply offset to trains turning around at south terminus
      if (southTurningTrains.length > 1) {
        const Y_OFFSET = 15; // Offset distance for staggered display
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
        sortedTrains.forEach((train, index) => {
          train.y = MAP_MID_Y + (index === 0 ? -Y_OFFSET : Y_OFFSET); // First higher, second lower
        });
      }
      // --- END: Re-insert Staggering Logic ---

      newTrainStates.forEach((ts) => {
        if (ts.isInDepot) {
          // const depotStartX =
          //   centerStationX - (finalInactiveCount * INACTIVE_TRAIN_SPACING) / 2;
          // ts.x = depotStartX + currentInactiveIndex * INACTIVE_TRAIN_SPACING;

          // Use the new centered position logic
          ts.x = firstTrainX + currentInactiveIndex * INACTIVE_TRAIN_SPACING;

          currentInactiveIndex++;
        }
      });
      setInactiveTrainCount(finalInactiveCount);

      // --- Update State & Debug Info ---
      if (JSON.stringify(newTrainStates) !== JSON.stringify(trainStates)) {
        setTrainStates(newTrainStates);
      }
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
      setDebugInfo(currentDebugInfo);
    }, [
      simulationTimetable,
      simulationTime,
      stationsById, // Added
      stations, // Added
      // trainEventPairs, // Potentially remove if not needed elsewhere
      turnaroundTime,
      centerStationX,
      trainOperationalWindows, // Added
      getEffectiveTrainServiceType, // Added
    ]); // End useEffect

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
            : train.direction === "SOUTHBOUND"
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
            // console.log(
            //   `Train ${train.id} display: ServiceType=${trainServiceType}, isSkipStopTrain=${isSkipStopTrain}`
            // );
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
                    train.isInDepot
                      ? "fill-black font-semibold" // Black text for depot trains
                      : train.direction === "SOUTHBOUND"
                      ? "fill-black font-semibold" // Existing black for southbound
                      : THEME.train.text // White for northbound active trains
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
      getStationsById: () => stationsById,
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
                    <div className="w-5 h-5 mr-2 border border-black dark:border-white rounded-sm bg-yellow-500/70"></div>
                    <span className={THEME.textHtmlPrimary}>A-Train</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-5 h-5 mr-2 border border-black dark:border-white rounded-sm bg-green-500/70"></div>
                    <span className={THEME.textHtmlPrimary}>B-Train</span>
                  </div>
                </div>

                {/* Add explanation for skipped stations with dashed circles */}
                <div className="flex items-center mt-1">
                  <div className="w-5 h-5 mr-2 border border-black dark:border-white border-dashed rounded-full bg-transparent"></div>
                  <span className={THEME.textHtmlPrimary}>
                    Skipped Stations
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
                  centerStationX -
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
                fill="rgba(150, 150, 150, 0.08)" // Semi-transparent grey - Reduced opacity
                stroke="rgba(100, 100, 100, 0.25)" // Dim border
                strokeWidth={1}
                rx={5} // Rounded corners
              />
              <text
                // Center the text horizontally above the box relative to Station 7
                x={centerStationX}
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
