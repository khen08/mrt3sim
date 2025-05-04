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
import {
  IconClock,
  IconEye,
  IconEyeOff,
  IconRoute,
  IconCalendarEvent,
  IconRepeat,
  IconClockHour4,
} from "@tabler/icons-react"; // Add new icons
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
  STATION_TYPE_INDICATOR_Y_OFFSET,
  STATION_TYPE_INDICATOR_HEIGHT,
  STATION_TYPE_INDICATOR_PADDING_X,
  STATION_TYPE_INDICATOR_X_OFFSET,
  STATION_TYPE_INDICATOR_PADDING_Y,
  STATION_TYPE_INDICATOR_COLOR_A,
  STATION_TYPE_INDICATOR_COLOR_B,
  STATION_TYPE_INDICATOR_COLOR_AB,
  STATION_TYPE_INDICATOR_TEXT_COLOR_AB,
  STATION_TYPE_INDICATOR_TEXT_COLOR_DEFAULT,
  STATION_TYPE_INDICATOR_BORDER_COLOR_AB,
  STATION_SKIP_HIGHLIGHT_OFFSET,
  STATION_SKIP_HIGHLIGHT_STROKE_WIDTH,
  STATION_SKIP_HIGHLIGHT_DASHARRAY,
  ACTIVE_TRAIN_SIZE,
  TRAIN_ARROW_WIDTH,
  TRAIN_LOADING_CIRCLE_RADIUS,
  TRAIN_LOADING_CIRCLE_STROKE_WIDTH,
  TRAIN_STAGGER_Y_OFFSET,
  TRAIN_HIGHLIGHT_FILTER_STD_DEVIATION,
  TRAIN_HIGHLIGHT_FILTER_COLOR,
  TRAIN_HIGHLIGHT_FILTER_OPACITY,
  // Import new train colors
  TRAIN_COLOR_A,
  TRAIN_COLOR_B,
  TRAIN_COLOR_A_STOPPED,
  TRAIN_COLOR_B_STOPPED,
  // Import new regular stopped colors
  TRAIN_COLOR_NB_STOPPED_REGULAR,
  TRAIN_COLOR_SB_STOPPED_REGULAR,
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
  selectedScheme?: "REGULAR" | "SKIP-STOP"; // Scheme used for data/map logic
  uiSelectedScheme?: "REGULAR" | "SKIP-STOP"; // Scheme selected in UI (for legend)
  showDebugInfo?: boolean; // <-- Add new prop
  // Add new sim info props
  servicePeriod?: string | null;
  headway?: number | null;
  loopTime?: number | null;
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
      selectedScheme, // This is from activeSimulationSettings now (for logic)
      uiSelectedScheme, // <<< DESTRUCTURE NEW PROP (from page state for UI)
      showDebugInfo = false, // <-- Add new prop
      // Destructure new props with defaults
      servicePeriod = null,
      headway = null,
      loopTime = null,
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
      selectedScheme, // Needs active scheme for logging condition
      hasLoggedRawData,
      hasLoggedNormalizedData,
    ]);

    // Function to get train y position
    const getTrainYPosition = (direction: Direction) => {
      return direction === "SOUTHBOUND" ? TRACK.southboundY : TRACK.northboundY;
    };

    // Fallback service type generator needs the ACTIVE scheme
    const getFallbackTrainServiceType = useCallback(
      (trainId: number): string => {
        if (selectedScheme !== "SKIP-STOP") return "AB"; // Check ACTIVE scheme
        if (trainId % 2 === 1) return "A";
        return "B";
      },
      [selectedScheme] // Depends on ACTIVE scheme
    );

    // Function to get train service type (needs simulationTimetable, trainEventPairs)
    const getTrainServiceType = useCallback(
      (trainId: number) => {
        const trainEvents = trainEventPairs?.[trainId];
        if (trainEvents && (trainEvents.eventA || trainEvents.eventB)) {
          const event = trainEvents.eventA || trainEvents.eventB;
          if (event?.TRAIN_SERVICE_TYPE) return event.TRAIN_SERVICE_TYPE;
        }
        if (simulationTimetable) {
          for (const entry of simulationTimetable) {
            const anyEntry = entry as any;
            if (
              (anyEntry.TRAIN_ID === trainId ||
                anyEntry["Train ID"] === trainId) &&
              anyEntry.TRAIN_SERVICE_TYPE
            ) {
              return anyEntry.TRAIN_SERVICE_TYPE;
            }
          }
        }
        return null;
      },
      [simulationTimetable, trainEventPairs]
    );

    // Ensure getEffectiveTrainServiceType is correctly defined and memoized if necessary
    // It relies on selectedScheme (active scheme) for its fallback logic.
    const getEffectiveTrainServiceType = useCallback(
      (trainId: number): string => {
        const serviceType = getTrainServiceType(trainId);
        if (serviceType) {
          return serviceType;
        }
        return getFallbackTrainServiceType(trainId);
      },
      [getTrainServiceType, getFallbackTrainServiceType] // Removed selectedScheme dependency here, it's implicit via fallback
    );

    // --- NEW: trainStopsAtStation needs the ACTIVE scheme ---
    // This function determines if a train *actually* stops based on simulation data.
    // It should continue using `selectedScheme` (from active settings).
    const trainStopsAtStation = useCallback(
      (trainId: number, stationId: number): boolean => {
        console.log(
          `trainStopsAtStation - Train: ${trainId}, Station: ${stationId}, Active Scheme: ${selectedScheme}`
        );
        const trainServiceType = getEffectiveTrainServiceType(trainId);
        console.log(`  Train Service Type: ${trainServiceType}`);
        const station = stations.find((s) => s.id === stationId);
        const stationScheme = station?.scheme || "AB";
        console.log(`  Station Scheme: ${stationScheme}`);

        // If it's not skip-stop (based on ACTIVE scheme) or service type isn't A or B, train stops at all stations
        if (
          selectedScheme !== "SKIP-STOP" ||
          !trainServiceType ||
          trainServiceType === "AB"
        )
          return true; // <<< CHECK selectedScheme (active)

        // Determine if the train stops based on actual schemes:
        if (trainServiceType === "A") {
          return stationScheme === "A" || stationScheme === "AB";
        } else if (trainServiceType === "B") {
          return stationScheme === "B" || stationScheme === "AB";
        }

        return true; // Default behavior
      },
      [stations, selectedScheme, getEffectiveTrainServiceType] // <<< DEPENDS ON selectedScheme (active)
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
        // REMOVE isExplicitlyInactive and related variables
        // let isExplicitlyInactive = false;
        // let inactiveTriggerEvent: any = null;

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

        // --- Determine Final Inactive State (ONLY based on window now) ---
        // if (isOutsideWindow || isExplicitlyInactive) {
        if (isOutsideWindow) {
          let inactiveDirection: Direction = "SOUTHBOUND"; // Default
          // Use last known direction if available from schedule
          // if (inactiveTriggerEvent) { // Cannot use this anymore
          //   inactiveDirection = inactiveTriggerEvent.DIRECTION;
          // } else if (operationalWindow && trainSchedule.length > 0) {
          if (operationalWindow && trainSchedule.length > 0) {
            inactiveDirection =
              trainSchedule[trainSchedule.length - 1].DIRECTION;
          }

          trainState = {
            id: trainId,
            x: 0, // Position will be updated later
            y: DEPOT_CENTER_Y,
            direction: inactiveDirection,
            isStopped: true,
            isActive: true, // Still considered 'active' simulation-wise, just visually in depot
            isTurningAround: false,
            isInDepot: true, // Mark as in depot
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
                  serviceType: getEffectiveTrainServiceType(trainId), // Uses active scheme
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

            // *** START FIX: Check if this 'AT STATION' event is actually the end of the line ***
            const isLastEventInSchedule =
              trainSchedule.indexOf(eventA) === trainSchedule.length - 1;
            if (isLastEventInSchedule) {
              // If it's the last event and there's no next event (eventB is null),
              // the train should be considered inactive after its potential departure time.
              const departureSec = eventA.DEPARTURE_TIME
                ? timeToSeconds(eventA.DEPARTURE_TIME)
                : timeToSeconds(eventA.ARRIVAL_TIME!);
              if (currentSimSeconds >= departureSec) {
                console.warn(
                  `Train ${trainId}: At station for last event (${eventA.STATION_ID}) past departure/arrival time ${simulationTime}. Setting to INACTIVE (depot).`
                );
                trainState = {
                  id: trainId,
                  x: 0, // Position will be updated later
                  y: DEPOT_CENTER_Y,
                  direction: eventA.DIRECTION,
                  isStopped: true,
                  isActive: true, // Visually inactive
                  isTurningAround: false,
                  isInDepot: true, // Mark as in depot
                  isNewlyInserted: false,
                  serviceType: getEffectiveTrainServiceType(trainId),
                  rotation: 0,
                  currentStationIndex: -1,
                  turnaroundProgress: null,
                };
              } else {
                // Still dwelling at the last station before inactivity
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
                  serviceType: getEffectiveTrainServiceType(trainId), // Uses active scheme
                  rotation: eventA.DIRECTION === "NORTHBOUND" ? 180 : 0,
                  currentStationIndex: stations.findIndex(
                    (s) => s.id === eventA.STATION_ID
                  ),
                  turnaroundProgress: null,
                };
              }
            } else {
              // Regular 'AT STATION' logic
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
                serviceType: getEffectiveTrainServiceType(trainId), // Uses active scheme
                rotation: eventA.DIRECTION === "NORTHBOUND" ? 180 : 0,
                currentStationIndex: stations.findIndex(
                  (s) => s.id === eventA.STATION_ID
                ),
                turnaroundProgress: null,
              };
            }
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
                serviceType: getEffectiveTrainServiceType(trainId), // Uses active scheme
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
                serviceType: getEffectiveTrainServiceType(trainId), // Uses active scheme
                rotation: eventA.DIRECTION === "NORTHBOUND" ? 180 : 0,
                currentStationIndex: -1,
                turnaroundProgress: null,
              };
            }
          } else {
            // Fallback - If inside operational window but no event pair found,
            // it means the train is inactive during this specific time (e.g., midday)
            // This case should ideally be covered by the isOutsideWindow check or the explicit last event check above.
            // If reached, it might indicate an unexpected gap in the schedule data.
            console.warn(
              `Train ${trainId}: Unexpected state within operational window at ${simulationTime}. No current/next event pair (A/B). Setting to INACTIVE (depot). Event A: ${eventA}, Event B: ${eventB}`
            );
            // Determine fallback inactive direction (use last known from schedule if possible)
            let inactiveDirection: Direction = "SOUTHBOUND"; // Default
            if (trainSchedule.length > 0) {
              inactiveDirection =
                trainSchedule[trainSchedule.length - 1].DIRECTION;
            }
            trainState = {
              id: trainId,
              x: 0, // Position will be updated later
              y: DEPOT_CENTER_Y,
              direction: inactiveDirection,
              isStopped: true,
              isActive: true, // Still considered 'active' simulation-wise, just visually in depot
              isTurningAround: false,
              isInDepot: true, // Mark as in depot
              isNewlyInserted: false,
              serviceType: getEffectiveTrainServiceType(trainId),
              rotation: 0,
              currentStationIndex: -1,
              turnaroundProgress: null,
            };
          }
        } else {
          // No schedule found for this train ID, even though it might have an operational window
          // (This case might indicate data issues)
          console.warn(
            `Train ${trainId}: Has operational window but no schedule entries found. Hiding train.`
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
        const Y_OFFSET = TRAIN_STAGGER_Y_OFFSET; // Use constant
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
        const Y_OFFSET = TRAIN_STAGGER_Y_OFFSET; // Use constant
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
      // Only update debug info if it's actually going to be shown
      // or if its content changes (though conditional rendering handles showing/hiding)
      if (JSON.stringify(currentDebugInfo) !== JSON.stringify(debugInfo)) {
        setDebugInfo(currentDebugInfo);
      }
    }, [
      simulationTimetable,
      simulationTime,
      stationsById,
      stations,
      turnaroundTime,
      centerStationX,
      trainOperationalWindows,
      getEffectiveTrainServiceType, // Depends on active scheme
    ]); // End useEffect

    // Memoize station elements
    const stationElements = useMemo(() => {
      return stations.map((station) => {
        const isSelected = station.id === selectedStation;
        const radius = isSelected ? SELECTED_STATION_RADIUS : STATION_RADIUS;
        const strokeWidth = isSelected
          ? SELECTED_STATION_STROKE_WIDTH
          : STATION_STROKE_WIDTH;
        const stationScheme = station.scheme || "AB";

        // --- Corrected Skip Highlight Logic ---
        let stationSkipHighlight = null;
        // Check if skip-stop view is active in the UI and a train is selected
        if (selectedTrainId && uiSelectedScheme === "SKIP-STOP") {
          const trainServiceType =
            getEffectiveTrainServiceType(selectedTrainId); // Get selected train's type (A/B/AB)

          let willTrainStopHypothetically = true; // Assume stops by default

          // Apply skip-stop rules directly based on train and station types
          if (trainServiceType === "A") {
            willTrainStopHypothetically =
              stationScheme === "A" || stationScheme === "AB";
          } else if (trainServiceType === "B") {
            willTrainStopHypothetically =
              stationScheme === "B" || stationScheme === "AB";
          }
          // If trainServiceType is 'AB' or null/undefined, willTrainStopHypothetically remains true

          // Render the highlight ONLY if the rules indicate a skip
          if (!willTrainStopHypothetically) {
            stationSkipHighlight = (
              <circle
                cx={0}
                cy={0}
                r={radius + STATION_SKIP_HIGHLIGHT_OFFSET} // Use constant
                className="fill-none stroke-red-500/50 dark:stroke-red-400/50"
                strokeWidth={STATION_SKIP_HIGHLIGHT_STROKE_WIDTH} // Use constant
                strokeDasharray={STATION_SKIP_HIGHLIGHT_DASHARRAY} // Use constant
              />
            );
          }
        }
        // --- End Corrected Skip Highlight Logic ---

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
      uiSelectedScheme, // Visual dependency for both indicator and highlight visibility
      getEffectiveTrainServiceType, // Needed to determine train type for highlight logic
    ]);

    // Memoize train elements with new design
    const trainElements = useMemo(() => {
      // Use ACTIVE_TRAIN_SIZE
      const halfTrainSize = ACTIVE_TRAIN_SIZE / 2;
      const arrowHeight = ACTIVE_TRAIN_SIZE;

      // Loading circle properties
      const loadingRadius = TRAIN_LOADING_CIRCLE_RADIUS; // Use constant
      const loadingCircumference = 2 * Math.PI * loadingRadius;
      const loadingStrokeWidth = TRAIN_LOADING_CIRCLE_STROKE_WIDTH; // Use constant

      return trainStates
        .filter((train) => train.isActive) // Keep filtering for active trains
        .map((train) => {
          // Re-declare variables inside the map scope
          const currentTrainSize = train.isInDepot
            ? INACTIVE_TRAIN_SIZE
            : ACTIVE_TRAIN_SIZE;
          const currentHalfTrainSize = currentTrainSize / 2;
          const currentArrowHeight = currentTrainSize; // Restore this definition

          // Get train service type (uses active scheme for fallback)
          const trainServiceType = getEffectiveTrainServiceType(train.id);

          // --- Restore Fill Color Logic --- //
          let fillColor: string | undefined;
          let fillColorClass: string = ""; // Restore initialization

          if (train.isInDepot) {
            fillColorClass = "fill-gray-400 dark:fill-gray-600";
          } else if (uiSelectedScheme === "SKIP-STOP") {
            // Skip-Stop Color Logic
            if (trainServiceType === "A") {
              fillColor = train.isStopped
                ? TRAIN_COLOR_A_STOPPED
                : TRAIN_COLOR_A;
            } else if (trainServiceType === "B") {
              fillColor = train.isStopped
                ? TRAIN_COLOR_B_STOPPED
                : TRAIN_COLOR_B;
            } else {
              fillColorClass =
                train.direction === "SOUTHBOUND"
                  ? THEME.train.southbound
                  : THEME.train.northbound;
            }
          } else {
            // Regular Scheme Color Logic
            if (train.isStopped) {
              if (train.direction === "NORTHBOUND") {
                fillColor = TRAIN_COLOR_NB_STOPPED_REGULAR;
              } else {
                fillColor = TRAIN_COLOR_SB_STOPPED_REGULAR;
              }
            } else {
              fillColorClass =
                train.direction === "SOUTHBOUND"
                  ? THEME.train.southbound
                  : THEME.train.northbound;
            }
          }
          // --- End Restore Fill Color Logic --- //

          // Arrow points definition (should be okay)
          let arrowPoints = `0,0 ${TRAIN_ARROW_WIDTH},${
            currentArrowHeight / 2 // Use restored variable
          } 0,${currentArrowHeight}`;
          let arrowTransform = `translate(${
            currentHalfTrainSize - TRAIN_ARROW_WIDTH / 7
          }, ${-currentHalfTrainSize})`;

          // Base transform (should be okay)
          const groupTransform = `translate(${train.x}, ${train.y}) rotate(${train.rotation})`;

          // Get current/next station IDs (should be okay)
          let currentStationId = null;
          // ... (rest of station ID logic) ...
          let nextStationId = null;
          // ... (rest of station ID logic) ...

          // Skip logic (should be okay)
          const willSkipNextStation =
            nextStationId !== null &&
            selectedScheme === "SKIP-STOP" &&
            !trainStopsAtStation(train.id, nextStationId);

          // --- Restore Text Color Logic --- //
          let textColorClass: string;
          if (train.isInDepot) {
            textColorClass = "fill-black font-semibold";
          } else if (
            uiSelectedScheme === "SKIP-STOP" &&
            (trainServiceType === "A" || trainServiceType === "B")
          ) {
            textColorClass = THEME.train.text;
          } else if (train.direction === "SOUTHBOUND") {
            textColorClass = "fill-black font-semibold";
          } else {
            textColorClass = THEME.train.text;
          }
          // --- End Restore Text Color Logic --- //

          // --- Restore JSX Return Structure --- //
          return (
            <g
              key={`train-${train.id}`}
              transform={groupTransform}
              onClick={() => handleMapTrainClick(train.id)}
              className={`train-element group cursor-pointer transition-opacity duration-200 ease-in-out ${
                train.isInDepot ? "opacity-80" : ""
              } ${
                selectedTrainId === train.id ? "train-selected-highlight" : ""
              } ${train.isNewlyInserted ? "train-insertion" : ""} ${
                selectedTrainId !== null && selectedTrainId !== train.id
                  ? "opacity-50"
                  : ""
              } ${willSkipNextStation ? "skipping-station" : ""}`}
            >
              <g
                className={train.isTurningAround ? "opacity-75" : ""}
                style={{
                  transform:
                    selectedTrainId === train.id ? "scale(1.2)" : "scale(1)",
                  transition: "transform 0.2s ease-in-out",
                }}
              >
                <rect
                  x={-currentHalfTrainSize}
                  y={-currentHalfTrainSize}
                  width={currentTrainSize}
                  height={currentTrainSize}
                  {...(fillColor // Use restored variable
                    ? { fill: fillColor }
                    : { className: fillColorClass })} // Use restored variable
                  rx={2}
                />
                {!train.isInDepot && (
                  <polygon
                    points={arrowPoints}
                    {...(fillColor // Use restored variable
                      ? { fill: fillColor }
                      : { className: fillColorClass })} // Use restored variable
                    transform={arrowTransform}
                  />
                )}
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dy="0.35em"
                  transform={`rotate(${-train.rotation})`}
                  className={`text-[10px] select-none pointer-events-none ${textColorClass}`}
                >
                  {train.id}
                </text>
              </g>

              {/* Loading Circle */}
              {train.isTurningAround && train.turnaroundProgress !== null && (
                <g className="loading-circle">
                  <circle
                    cx="0"
                    cy="0"
                    r={loadingRadius}
                    fill="none"
                    stroke="currentColor"
                    opacity={selectedTrainId === train.id ? 0.3 : 0.2}
                    strokeWidth={loadingStrokeWidth}
                  />
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
      // Restore dependencies
      trainStates,
      selectedTrainId,
      handleMapTrainClick,
      trainEventPairs,
      uiSelectedScheme,
      getEffectiveTrainServiceType,
      selectedScheme,
      trainStopsAtStation,
      THEME.train.southbound,
      THEME.train.northbound,
      THEME.train.text,
      STATION_TYPE_INDICATOR_COLOR_A,
      STATION_TYPE_INDICATOR_COLOR_B,
      STATION_TYPE_INDICATOR_COLOR_AB,
      STATION_TYPE_INDICATOR_TEXT_COLOR_AB,
      STATION_TYPE_INDICATOR_TEXT_COLOR_DEFAULT,
      STATION_TYPE_INDICATOR_BORDER_COLOR_AB,
      ACTIVE_TRAIN_SIZE,
      TRAIN_ARROW_WIDTH,
      TRAIN_LOADING_CIRCLE_RADIUS,
      TRAIN_LOADING_CIRCLE_STROKE_WIDTH,
      TRAIN_COLOR_A,
      TRAIN_COLOR_B,
      TRAIN_COLOR_A_STOPPED,
      TRAIN_COLOR_B_STOPPED,
      TRAIN_COLOR_NB_STOPPED_REGULAR,
      TRAIN_COLOR_SB_STOPPED_REGULAR,
    ]); // Add dependencies as needed

    // Memoize station labels
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

    // --- NEW: Memoize station type indicators (positioned below labels) ---
    const stationTypeIndicatorElements = useMemo(() => {
      if (uiSelectedScheme !== "SKIP-STOP") return null; // Only show for skip-stop UI

      return stations.map((station) => {
        const stationScheme = station.scheme || "AB";
        // Remove the line below to show AB indicators
        // if (stationScheme === "AB") return null;

        const labelX =
          station.x + STATION_VISUAL_X_OFFSET + STATION_TYPE_INDICATOR_X_OFFSET; // Apply X offset constant
        const labelY =
          TRACK.stationCenterY +
          LABEL_Y_OFFSET +
          STATION_TYPE_INDICATOR_Y_OFFSET; // Apply Y offset constant
        const indicatorColor =
          stationScheme === "A"
            ? STATION_TYPE_INDICATOR_COLOR_A // Use constant
            : stationScheme === "B"
            ? STATION_TYPE_INDICATOR_COLOR_B // Use constant
            : STATION_TYPE_INDICATOR_COLOR_AB; // Use constant

        // Determine text color based on background
        const textColor =
          stationScheme === "AB"
            ? STATION_TYPE_INDICATOR_TEXT_COLOR_AB // Use constant
            : // Use default for both A and B now as both backgrounds are dark enough for white text
              STATION_TYPE_INDICATOR_TEXT_COLOR_DEFAULT;

        // Calculate width based on text ("A", "B", or "AB")
        const textWidth = stationScheme === "AB" ? 12 : 8; // Estimate width
        const indicatorWidth = textWidth + STATION_TYPE_INDICATOR_PADDING_X * 2; // Use constant

        return (
          <g
            key={`type-indicator-${station.id}`}
            transform={`translate(${labelX}, ${labelY}) rotate(-45)`}
          >
            <rect
              x={-indicatorWidth / 2}
              y={-STATION_TYPE_INDICATOR_HEIGHT / 2 - 1} // Use constant
              width={indicatorWidth}
              // Apply vertical padding to the height
              height={
                STATION_TYPE_INDICATOR_HEIGHT +
                STATION_TYPE_INDICATOR_PADDING_Y * 2
              } // Use constants
              rx={2}
              fill={indicatorColor}
              // Add a subtle border for the white AB pill
              stroke={
                stationScheme === "AB"
                  ? STATION_TYPE_INDICATOR_BORDER_COLOR_AB
                  : "none"
              } // Use constant
              strokeWidth={0.5}
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dy=".3em"
              // Use calculated text color
              className={`text-[8px] font-semibold fill-[${textColor}]`}
            >
              {stationScheme}
            </text>
          </g>
        );
      });
    }, [stations, uiSelectedScheme]); // Depends on UI scheme selection

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

          .train-insertion {
            animation: pulse-outline 1.2s infinite;
          }

          .skipping-station {
            animation: pulse-skipping 1.5s infinite alternate;
          }
        `}
        </style>
        <div
          className={`relative w-full h-full overflow-hidden ${THEME.background}`}
        >
          {/* Sim Time & Metadata Display */}
          <div
            className={`absolute top-2 right-2 bg-card/90 dark:bg-card/90 p-2 rounded-lg shadow-md text-card-foreground z-20 flex flex-col items-end gap-0.5 text-xs`} // Adjusted padding/gap
          >
            {/* Current Time */}
            <div className="flex items-center gap-1.5 font-mono text-sm mb-0.5">
              {" "}
              {/* Larger time */}
              <IconClock className="w-4 h-4" />
              <span>{simulationTime}</span>
            </div>
            {/* Service Period */}
            {servicePeriod && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <IconCalendarEvent className="w-3.5 h-3.5" />
                <span>{servicePeriod}</span>
              </div>
            )}
            {/* Headway */}
            {headway !== null && headway !== undefined && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <IconClockHour4 className="w-3.5 h-3.5" />
                <span>Headway: {headway} min</span>
              </div>
            )}
            {/* Loop Time */}
            {loopTime !== null && loopTime !== undefined && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <IconRepeat className="w-3.5 h-3.5" />
                <span>Loop Time: {loopTime} min</span>
              </div>
            )}
          </div>

          {/* Debug Info Overlay - Conditionally render */}
          {showDebugInfo && (
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
          )}

          {/* Legend - Conditionally show sections based on visibility AND selection */}
          {selectedTrainId === null && selectedStation === null && (
            <div
              className={`absolute bottom-2 right-2 p-2 rounded shadow text-xs z-10 flex flex-col space-y-2 ${THEME.legend}`}
            >
              {/* Regular Direction Legend */}
              <div className="flex space-x-4">
                <div className="flex items-center">
                  {/* Use dedicated legend indicator theme color and increase height */}
                  <div
                    className={`w-4 h-2 mr-2 rounded-sm ${THEME.legendIndicator.southbound}`}
                  ></div>
                  {/* Use HTML text theme color */}
                  <span className={THEME.textHtmlPrimary}>
                    Southbound{" "}
                    {uiSelectedScheme === "REGULAR" ? "(In transit)" : ""}
                  </span>
                </div>
                <div className="flex items-center">
                  {/* Use dedicated legend indicator theme color and increase height */}
                  <div
                    className={`w-4 h-2 mr-2 rounded-sm ${THEME.legendIndicator.northbound}`}
                  ></div>
                  {/* Use HTML text theme color */}
                  <span className={THEME.textHtmlPrimary}>
                    Northbound{" "}
                    {uiSelectedScheme === "REGULAR" ? "(In transit)" : ""}
                  </span>
                </div>
              </div>

              {/* Regular Scheme Stopped Colors Legend */}
              {uiSelectedScheme === "REGULAR" && (
                <div className="flex space-x-4 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-2 mr-2 rounded-sm"
                      style={{
                        backgroundColor: TRAIN_COLOR_SB_STOPPED_REGULAR,
                      }}
                    ></div>
                    <span className={THEME.textHtmlPrimary}>
                      Southbound (Stopped)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div
                      className="w-4 h-2 mr-2 rounded-sm"
                      style={{
                        backgroundColor: TRAIN_COLOR_NB_STOPPED_REGULAR,
                      }}
                    ></div>
                    <span className={THEME.textHtmlPrimary}>
                      Northbound (Stopped)
                    </span>
                  </div>
                </div>
              )}

              {/* Skip-stop legend - only show when SKIP-STOP scheme is selected IN THE UI */}
              {uiSelectedScheme === "SKIP-STOP" && ( // <<< CONDITION ALREADY CORRECT
                <div className="flex flex-col space-y-2 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-medium mb-1">
                    Skip-Stop Trains:
                  </div>
                  {/* In Transit Section */}
                  <div className="pl-2">
                    <div className="text-xs mb-1 text-muted-foreground">
                      In transit:
                    </div>
                    <div className="flex space-x-4">
                      <div className="flex items-center">
                        <div
                          className="w-5 h-5 mr-2 border border-black dark:border-white rounded-sm"
                          style={{ backgroundColor: TRAIN_COLOR_A }} // Moving A color
                        ></div>
                        <span className={THEME.textHtmlPrimary}>A-Train</span>
                      </div>
                      <div className="flex items-center">
                        <div
                          className="w-5 h-5 mr-2 border border-black dark:border-white rounded-sm"
                          style={{ backgroundColor: TRAIN_COLOR_B }} // Moving B color
                        ></div>
                        <span className={THEME.textHtmlPrimary}>B-Train</span>
                      </div>
                    </div>
                  </div>
                  {/* Stopped Section */}
                  <div className="pl-2 mt-1">
                    <div className="text-xs mb-1 text-muted-foreground">
                      Stopped:
                    </div>
                    <div className="flex space-x-4">
                      <div className="flex items-center">
                        <div
                          className="w-5 h-5 mr-2 border border-black dark:border-white rounded-sm"
                          style={{ backgroundColor: TRAIN_COLOR_A_STOPPED }} // Stopped A color
                        ></div>
                        <span className={THEME.textHtmlPrimary}>A-Train</span>
                      </div>
                      <div className="flex items-center">
                        <div
                          className="w-5 h-5 mr-2 border border-black dark:border-white rounded-sm"
                          style={{ backgroundColor: TRAIN_COLOR_B_STOPPED }} // Stopped B color
                        ></div>
                        <span className={THEME.textHtmlPrimary}>B-Train</span>
                      </div>
                    </div>
                  </div>

                  {/* Conditionally render skipped station legend entry */}
                  {selectedTrainId !== null && (
                    <div className="flex items-center mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                      {/* Adjusted border to be more visible */}
                      <div className="w-5 h-5 mr-2 border-2 border-red-500 dark:border-red-400 border-dashed rounded-full bg-transparent"></div>
                      <span className={THEME.textHtmlPrimary}>
                        Skipped by Selected Train
                      </span>
                    </div>
                  )}

                  {/* Station type legend - Use updated colors */}
                  <div className="text-xs font-medium mt-1 mb-1">
                    Station Types:
                  </div>
                  <div className="flex space-x-4">
                    <div className="flex items-center">
                      {/* Use A-Train color */}
                      <div
                        className="w-6 h-3 mr-2 rounded-sm"
                        style={{
                          backgroundColor: STATION_TYPE_INDICATOR_COLOR_A,
                        }} // Use constant
                      ></div>
                      <span className={THEME.textHtmlPrimary}>A Stations</span>
                    </div>
                    <div className="flex items-center">
                      {/* Use B-Train color */}
                      <div
                        className="w-6 h-3 mr-2 rounded-sm"
                        style={{
                          backgroundColor: STATION_TYPE_INDICATOR_COLOR_B,
                        }} // Use constant
                      ></div>
                      <span className={THEME.textHtmlPrimary}>B Stations</span>
                    </div>
                    <div className="flex items-center">
                      {/* Keep AB color */}
                      <div className="w-6 h-3 mr-2 rounded-sm bg-gray-700 dark:bg-gray-200"></div>
                      <span className={THEME.textHtmlPrimary}>AB Stations</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                  stdDeviation={TRAIN_HIGHLIGHT_FILTER_STD_DEVIATION} // Use constant
                  floodColor={TRAIN_HIGHLIGHT_FILTER_COLOR} // Use constant
                  floodOpacity={TRAIN_HIGHLIGHT_FILTER_OPACITY} // Use constant
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

            {/* Render station type indicators AFTER labels */}
            {uiSelectedScheme === "SKIP-STOP" && (
              <g className="station-type-indicators">
                {stationTypeIndicatorElements}
              </g>
            )}

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

MrtMap.displayName = "MrtMap"; // Add display name for forwardRef

export default MrtMap;
