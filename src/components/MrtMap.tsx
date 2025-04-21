"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { IconTrain, IconClock } from "@tabler/icons-react";

interface Station {
  id: number;
  name: string;
  x: number;
  y: number;
  passengers?: number;
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
  [key: string]: any; // Allow any fields for now
  "Train ID": number;
  NStation: number;
  Direction: "northbound" | "southbound";
  "Arrival Time": string | null;
  "Departure Time": string | null;
  "Train Status"?: "active" | "inactive"; // Added Train Status field
  // Add other relevant fields returned by the API (e.g., Service Type, Delay)
}

interface MrtMapProps {
  stations?: Station[];
  trains?: Train[]; // This might become obsolete if positions are calculated from timetable
  selectedStation?: number | null;
  onStationClick?: (stationId: number) => void;
  simulationTime?: string;
  isRunning?: boolean;
  // Replace trainSchedules with simulationTimetable from API
  // trainSchedules?: TrainSchedule[];
  simulationTimetable?: SimulationTimetableEntry[] | null; // Use the API response type
  turnaroundTime?: number; // Added prop for turnaround duration
}

// Define the station positions along the HORIZONTAL line
// Assuming map width around 1200, Y midline around 250
const HORIZONTAL_STATION_SPACING = 85;
const MAP_START_X = 60;
const MAP_WIDTH = 1200;
const MAP_MID_Y = 150;
const TRACK_Y_OFFSET = 25; // Increased vertical offset for tracks
const STATION_RADIUS = 10;
const STATION_STROKE_WIDTH = 1.5;
const SELECTED_STATION_RADIUS = 11;
const SELECTED_STATION_STROKE_WIDTH = 3;
const LABEL_Y_OFFSET = -75;

// --- Define coordinates for turnaround visualization ---
const TURNAROUND_OFFSET_X = 40; // How far past the terminus X to place the train
const TURNAROUND_Y_OFFSET = 0; // Vertical offset from MAP_MID_Y

const NORTH_TERMINUS_ID = 1;
const SOUTH_TERMINUS_ID = 13; // Assuming 13 stations
// --- End Turnaround Coordinates ---

// --- Theme Colors (using Tailwind class names for consistency) ---
const THEME = {
  background: "bg-gray-100 dark:bg-gray-900", // Slightly darker dark bg
  textPrimary: "fill-gray-700 dark:fill-gray-300",
  textSecondary: "fill-gray-500 dark:fill-gray-400",
  textSelected: "fill-black dark:fill-white",
  station: {
    default:
      "fill-white dark:fill-gray-700 stroke-gray-400 dark:stroke-gray-500",
    selected:
      "fill-yellow-400 dark:fill-yellow-500 stroke-gray-700 dark:stroke-gray-300",
    hoverRing: "stroke-blue-500/50 dark:stroke-blue-400/50", // More visible hover
    selectedRing: "stroke-yellow-500/60 dark:stroke-yellow-400/60", // Ring for selected
  },
  track: {
    northbound: "stroke-blue-600 dark:stroke-blue-500",
    southbound: "stroke-red-600 dark:stroke-red-500",
  },
  train: {
    northbound: "fill-blue-600 dark:fill-blue-500",
    southbound: "fill-red-600 dark:fill-red-500",
    text: "fill-white font-semibold",
  },
  legend: "bg-white/90 dark:bg-gray-800/90",
  textHtmlPrimary: "text-gray-700 dark:text-gray-300", // For HTML text
  legendIndicator: {
    northbound: "bg-blue-600 dark:bg-blue-500", // Explicit background color
    southbound: "bg-red-600 dark:bg-red-500", // Explicit background color
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
const MAP_END_X = STATIONS[STATIONS.length - 1].x + 40; // End relative to last station
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

// Train operation parameters
const TRAIN_SPEED = 40; // pixels per second (can adjust based on new horizontal scale)
const DEFAULT_DWELL_TIME = 20; // seconds per station stop

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
  rotation: number;
  currentStationIndex: number;
  turnaroundProgress: number | null; // Added for loading circle
}

// Helper function to parse time string to seconds since midnight
function timeToSeconds(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":"))
    return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

// Helper function to get station X position by ID (Renamed from getStationYById)
function getStationXById(stationId: number): number {
  return STATIONS_BY_ID[stationId]?.x ?? 0;
}

// Remove SAMPLE_TRAIN_SCHEDULES as data comes from props now
// const SAMPLE_TRAIN_SCHEDULES: TrainSchedule[] = [ ... ];

// Define fixed animation duration (can be made a prop later)
// const TURNAROUND_ANIMATION_DURATION_SECONDS = 60; // Remove constant

export default function MrtMap({
  stations = STATIONS,
  // trains prop might be removed later
  trains: initialTrains = [], // Keep for now, but likely needs rework
  selectedStation = null,
  onStationClick = () => {},
  simulationTime = "07:00:00",
  isRunning = false,
  // Use simulationTimetable prop, default to null
  // trainSchedules = SAMPLE_TRAIN_SCHEDULES,
  simulationTimetable = null,
  turnaroundTime = 60, // Use prop with default
}: MrtMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [trainStates, setTrainStates] = useState<TrainState[]>([]);
  // State for debug information displayed on the map
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
  const [inactiveTrainCount, setInactiveTrainCount] = useState(0); // State for dynamic box width

  // --- Timetable Processing useEffect ---
  useEffect(() => {
    // --- DEBUG: Log Inputs ---
    // console.log(
    //   `[MapEffect] Update Start - SimTime: ${simulationTime}, TurnaroundTimeProp: ${turnaroundTime}`
    // );
    // --- End Debug ---

    if (!simulationTimetable || simulationTimetable.length === 0) {
      // console.log("[MapEffect] No simulation timetable data, clearing trains.");
      if (trainStates.length > 0) {
        setTrainStates([]);
        setDebugInfo({}); // Clear debug info too
      }
      return;
    }

    const currentSimSeconds = timeToSeconds(simulationTime);
    const newTrainStates: TrainState[] = [];
    let inactiveTrainIndex = 0; // Counter for placing trains in the depot

    // Calculate dynamic box width (needed for centering X calculation)
    const depotBoxWidth =
      inactiveTrainCount > 0
        ? INACTIVE_TRAIN_SPACING * inactiveTrainCount + 10
        : 60;
    // Calculate the starting X for the *center* of the first train inside the centered box
    const totalTrainGroupWidth =
      inactiveTrainCount > 0
        ? (inactiveTrainCount - 1) * INACTIVE_TRAIN_SPACING
        : 0;
    const depotStartX = CENTER_STATION_X - totalTrainGroupWidth / 2; // Center the group

    const timetableByTrain = simulationTimetable.reduce((acc, entry) => {
      if (!entry || typeof entry["Train ID"] === "undefined") {
        return acc;
      }
      const trainId = entry["Train ID"];
      if (!acc[trainId]) acc[trainId] = [];
      acc[trainId].push(entry);
      return acc;
    }, {} as { [key: number]: SimulationTimetableEntry[] });

    for (const trainIdStr in timetableByTrain) {
      const trainId = parseInt(trainIdStr, 10);
      // console.log(
      //   `[MapEffect Train ${trainId}] Processing schedule. SimTime: ${simulationTime} (${currentSimSeconds}s)`
      // );
      const trainSchedule = timetableByTrain[trainId].sort((a, b) => {
        const arrA = a["Arrival Time"]
          ? timeToSeconds(a["Arrival Time"])
          : Infinity;
        const arrB = b["Arrival Time"]
          ? timeToSeconds(b["Arrival Time"])
          : Infinity;
        if (arrA !== arrB) return arrA - arrB;
        const depA =
          a["Departure Time"] && a["Departure Time"] !== "WITHDRAWN"
            ? timeToSeconds(a["Departure Time"])
            : Infinity;
        const depB =
          b["Departure Time"] && b["Departure Time"] !== "WITHDRAWN"
            ? timeToSeconds(b["Departure Time"])
            : Infinity;
        return depA - depB;
      });

      let finalState: Partial<TrainState> & { id: number } = {
        id: trainId,
        isActive: false,
        isInDepot: false, // Default to not in depot
      };
      let stateFound = false;

      for (let i = 0; i < trainSchedule.length; i++) {
        const event = trainSchedule[i];
        const nextEvent =
          i + 1 < trainSchedule.length ? trainSchedule[i + 1] : null;
        // const prevEvent = i > 0 ? trainSchedule[i - 1] : null; // Keep if needed for fallback or complex checks

        const arrivalSec = event["Arrival Time"]
          ? timeToSeconds(event["Arrival Time"])
          : null;
        const departureSec =
          event["Departure Time"] && event["Departure Time"] !== "WITHDRAWN"
            ? timeToSeconds(event["Departure Time"])
            : null;
        const eventStationId = event.NStation;
        const eventDirection = event.Direction.toLowerCase() as Direction;
        const eventTrainStatus = event["Train Status"] ?? "active"; // Default to active if missing

        const nextArrivalSec = nextEvent?.["Arrival Time"]
          ? timeToSeconds(nextEvent["Arrival Time"])
          : null;
        const nextDepartureSec =
          nextEvent?.["Departure Time"] &&
          nextEvent["Departure Time"] !== "WITHDRAWN"
            ? timeToSeconds(nextEvent["Departure Time"])
            : null;
        const nextStationId = nextEvent?.NStation;
        const nextDirection = nextEvent?.Direction?.toLowerCase() as
          | Direction
          | undefined;

        // --- Identify Turnaround Gaps ---
        let isTurnaroundStartEvent = false; // Is `event` the arrival/dwell *before* turnaround visual?
        let turnaroundVisualStartTimeSec: number | null = null;
        let turnaroundVisualEndTimeSec: number | null = null;
        let directionBeforeTurnaround: Direction | null = null;
        let directionAfterTurnaround: Direction | null = null;

        if (
          nextEvent &&
          departureSec !== null && // Event i has a departure time (marks end of Dwell 1)
          nextDepartureSec !== null && // Event i+1 has a departure time (marks end of visual/start of Dwell 2)
          eventStationId === nextStationId && // Both events are at the same station
          (eventStationId === NORTH_TERMINUS_ID ||
            eventStationId === SOUTH_TERMINUS_ID) && // It's a terminus
          eventDirection !== nextDirection // The direction changes between event i and i+1
        ) {
          // Turnaround detected: Mark the start event and store times/directions.
          isTurnaroundStartEvent = true;
          turnaroundVisualStartTimeSec = departureSec;
          turnaroundVisualEndTimeSec = nextDepartureSec;
          directionBeforeTurnaround = eventDirection;
          directionAfterTurnaround = nextDirection!;
          // console.log(`%c[MapEffect Train ${trainId} Event ${i}] Turnaround GAP Detected`, "color: purple;",
          //     `| SimSec: ${currentSimSeconds}`, `| Dwell1 End (Visual Start): ${turnaroundVisualStartTimeSec} (${formatTime(turnaroundVisualStartTimeSec!)})`,
          //     `| Visual End: ${turnaroundVisualEndTimeSec} (${formatTime(turnaroundVisualEndTimeSec!)})`,
          //     `| PrevDir: ${directionBeforeTurnaround}`, `| NextDir: ${directionAfterTurnaround}`
          // );
        }

        // --- State Determination based on Time ---

        // 0. Check for Inactive State & Past Departure Time (Highest Priority)
        if (
          eventTrainStatus === "inactive" &&
          departureSec !== null &&
          currentSimSeconds >= departureSec
        ) {
          // Train is inactive and should be in the depot
          // console.log(`%c[MapEffect Train ${trainId} Event ${i}] Assigning STATE INACTIVE (In Depot)`, "color: gray; font-weight: bold;",
          //      `| SimSec: ${currentSimSeconds}`, `| Dep: ${departureSec}`);

          const depotX =
            depotStartX + inactiveTrainIndex * INACTIVE_TRAIN_SPACING; // Position train center
          const depotY = DEPOT_CENTER_Y; // Use fixed Y center
          inactiveTrainIndex++; // Increment for the next inactive train

          finalState = {
            id: trainId,
            x: depotX,
            y: depotY,
            direction: eventDirection, // Keep last known direction?
            isStopped: true,
            isActive: true, // Still active visually, but in depot
            isTurningAround: false,
            isInDepot: true, // Mark as in depot
            rotation: 0, // Face right in the depot
            currentStationIndex: -1, // Not at a track station
            turnaroundProgress: null,
          };
          stateFound = true;
          break; // Found the final state for this train
        }

        // 1. Turnaround Visual Phase?
        if (
          isTurnaroundStartEvent &&
          turnaroundVisualStartTimeSec !== null &&
          turnaroundVisualEndTimeSec !== null &&
          currentSimSeconds >= turnaroundVisualStartTimeSec &&
          currentSimSeconds < turnaroundVisualEndTimeSec
        ) {
          const effectiveTurnaroundDuration = Math.max(
            1,
            turnaroundVisualEndTimeSec - turnaroundVisualStartTimeSec
          );
          const timeIntoTurnaround =
            currentSimSeconds - turnaroundVisualStartTimeSec;
          const progress = Math.min(
            1,
            timeIntoTurnaround / effectiveTurnaroundDuration
          );
          const isNorthTurnaround = eventStationId === NORTH_TERMINUS_ID;

          // console.log(`%c[MapEffect Train ${trainId} Event ${i}] Assigning STATE A (Active Turnaround Visual)`, "color: blue; font-weight: bold;",
          //      `| SimSec: ${currentSimSeconds}`, `| Start: ${turnaroundVisualStartTimeSec}`, `| End: ${turnaroundVisualEndTimeSec}`, `| Progress: ${progress.toFixed(2)}`);

          // Calculate U-turn center coordinates for teleportation
          const uturnCenterX = isNorthTurnaround
            ? TRACK.start.x - TRACK_Y_OFFSET // Left of North Terminus
            : TRACK.end.x + TRACK_Y_OFFSET; // Right of South Terminus
          const uturnCenterY = MAP_MID_Y;

          finalState = {
            id: trainId,
            x: uturnCenterX,
            y: uturnCenterY,
            direction: directionAfterTurnaround!, // Set to the *next* direction
            isStopped: true,
            isActive: true,
            isTurningAround: true, // Flag for loading circle
            rotation: directionAfterTurnaround === "northbound" ? 180 : 0, // Point in the *next* direction
            currentStationIndex: -1,
            turnaroundProgress: progress,
            isInDepot: false, // Not in depot
          };
          stateFound = true;
          break;
        }

        // 2. Dwell Phase? (Covers Dwell 1, Dwell 2, standard dwell, AND inactive dwell before departure)
        if (
          !stateFound &&
          arrivalSec !== null &&
          departureSec !== null &&
          currentSimSeconds >= arrivalSec &&
          currentSimSeconds < departureSec
        ) {
          let dwellType =
            eventTrainStatus === "inactive"
              ? "Inactive (Pre-Depot)"
              : "Standard";
          if (isTurnaroundStartEvent) {
            dwellType = "Pre-Turnaround (Dwell 1)";
          }
          // Basic check if this dwell might be Dwell 2 (occurs at terminus, direction matches the *next* event's direction if a turnaround just happened)
          // This relies on the *previous* check `isTurnaroundStartEvent` identifying the preceding gap.
          // A more robust check might involve looking back further, but let's keep it simple.
          if (
            eventStationId === NORTH_TERMINUS_ID ||
            eventStationId === SOUTH_TERMINUS_ID
          ) {
            // If the *next* event exists and signifies the start of moving away from this terminus
            // and the direction matches, maybe it's Dwell 2? Very heuristic.
            // Let's assume the API provides Dwell 2 explicitly if it exists, so standard check suffices.
          }

          // console.log(`%c[MapEffect Train ${trainId} Event ${i}] Assigning STATE B (${dwellType} Dwell)`, "color: orange;",
          //     `| SimSec: ${currentSimSeconds}`, `| Arr: ${arrivalSec}`, `| Dep: ${departureSec}`, `| Dir: ${eventDirection}`);

          finalState = {
            id: trainId,
            x: getStationXById(eventStationId),
            y: getTrainYPosition(eventDirection),
            direction: eventDirection,
            isStopped: true,
            isActive: true,
            isTurningAround: false,
            rotation: eventDirection === "northbound" ? 180 : 0,
            currentStationIndex: stations.findIndex(
              (s) => s.id === eventStationId
            ),
            turnaroundProgress: null,
            isInDepot: false, // Not in depot
          };
          stateFound = true;
          break;
        }

        // 3. Moving Phase? (Only applies if train is 'active')
        if (
          !stateFound &&
          eventTrainStatus === "active" && // Ensure train is active to be moving
          departureSec !== null &&
          nextEvent &&
          nextArrivalSec !== null
        ) {
          // Segment is between current event's departure and next event's arrival
          let segmentStartTimeSec = departureSec;
          let segmentEndTimeSec = nextArrivalSec;
          let movingFromStationId = eventStationId;
          let movingToStationId = nextStationId!;
          let movingDirection = eventDirection;

          if (
            currentSimSeconds >= segmentStartTimeSec &&
            currentSimSeconds < segmentEndTimeSec
          ) {
            const segmentDuration = Math.max(
              1,
              segmentEndTimeSec - segmentStartTimeSec
            );
            const timeIntoSegment = currentSimSeconds - segmentStartTimeSec;
            const progress = Math.min(
              1,
              Math.max(0, timeIntoSegment / segmentDuration)
            );
            const prevStationX = getStationXById(movingFromStationId);
            const nextStationX = getStationXById(movingToStationId);

            // console.log(`%c[MapEffect Train ${trainId} Event ${i}] Assigning STATE C (Moving)`, "color: green; font-weight: bold;",
            //     `| SimSec: ${currentSimSeconds}`, `| Start: ${segmentStartTimeSec}`, `| End: ${segmentEndTimeSec}`, `| Progress: ${progress.toFixed(2)}`);

            finalState = {
              id: trainId,
              x: prevStationX + (nextStationX - prevStationX) * progress,
              y: getTrainYPosition(movingDirection),
              direction: movingDirection,
              isStopped: false,
              isActive: true,
              isTurningAround: false,
              rotation: movingDirection === "northbound" ? 180 : 0,
              currentStationIndex: -1,
              turnaroundProgress: null,
              isInDepot: false, // Not in depot
            };
            stateFound = true;
            break;
          }
        }

        // 4. Inactive State? (Before first event starts)
        if (
          !stateFound &&
          i === 0 &&
          (arrivalSec ?? departureSec ?? Infinity) > currentSimSeconds
        ) {
          // console.log(`[MapEffect Train ${trainId} Event ${i}] Assigning STATE D (Inactive - Before First Event Time ${arrivalSec ?? departureSec})`);
          finalState = { id: trainId, isActive: false, isInDepot: false }; // Ensure isInDepot is false
          stateFound = true;
          break;
        }
      } // End inner loop (schedule events)

      // --- Fallback Logic ---
      if (!stateFound) {
        // console.log(`[MapEffect Train ${trainId}] No state found in loop, entering fallback logic. SimSec: ${currentSimSeconds}`);
        if (trainSchedule.length === 0) {
          finalState = { id: trainId, isActive: false, isInDepot: false };
        } else {
          const firstEvent = trainSchedule[0];
          const firstKnownTime = timeToSeconds(
            firstEvent["Arrival Time"] ?? firstEvent["Departure Time"] ?? ""
          );
          const lastEvent = trainSchedule[trainSchedule.length - 1];
          const secondLastEvent =
            trainSchedule.length > 1
              ? trainSchedule[trainSchedule.length - 2]
              : null;

          // Check if after last known departure time
          const lastKnownDepartureTime = timeToSeconds(
            lastEvent["Departure Time"] ?? "99:99:99"
          );

          if (firstKnownTime > 0 && currentSimSeconds < firstKnownTime) {
            // Before first event
            // console.log(`[MapEffect Train ${trainId} Fallback] Setting Inactive (Before First Event: ${firstKnownTime})`);
            finalState = { id: trainId, isActive: false, isInDepot: false };
          } else if (
            lastKnownDepartureTime > 0 &&
            currentSimSeconds >= lastKnownDepartureTime
          ) {
            // After last departure time

            // Check if the last sequence was a turnaround visual potentially ongoing
            let wasLastEventTurnaroundEnd = false;
            let lastTurnaroundVisualStartTimeSec: number | null = null;
            let lastTurnaroundVisualEndTimeSec: number | null = null;
            let lastDirectionAfterTurnaround: Direction | null = null;

            if (
              secondLastEvent &&
              lastEvent.NStation === secondLastEvent.NStation &&
              (lastEvent.NStation === NORTH_TERMINUS_ID ||
                lastEvent.NStation === SOUTH_TERMINUS_ID) &&
              lastEvent.Direction !== secondLastEvent.Direction &&
              secondLastEvent["Departure Time"] &&
              timeToSeconds(secondLastEvent["Departure Time"]) <
                lastKnownDepartureTime
            ) {
              wasLastEventTurnaroundEnd = true;
              lastTurnaroundVisualStartTimeSec = timeToSeconds(
                secondLastEvent["Departure Time"]
              );
              lastTurnaroundVisualEndTimeSec = lastKnownDepartureTime;
              lastDirectionAfterTurnaround =
                lastEvent.Direction.toLowerCase() as Direction;
            }

            if (
              wasLastEventTurnaroundEnd &&
              lastTurnaroundVisualStartTimeSec &&
              lastTurnaroundVisualEndTimeSec &&
              currentSimSeconds >= lastTurnaroundVisualStartTimeSec &&
              currentSimSeconds < lastTurnaroundVisualEndTimeSec
            ) {
              // Fallback: Still visually turning around after schedule "ends"
              const effectiveTurnaroundDuration = Math.max(
                1,
                lastTurnaroundVisualEndTimeSec -
                  lastTurnaroundVisualStartTimeSec
              );
              const timeIntoTurnaround =
                currentSimSeconds - lastTurnaroundVisualStartTimeSec;
              const progress = Math.min(
                1,
                timeIntoTurnaround / effectiveTurnaroundDuration
              );
              const isNorthTurnaround =
                lastEvent.NStation === NORTH_TERMINUS_ID;
              const uturnCenterX = isNorthTurnaround
                ? TRACK.start.x - TRACK_Y_OFFSET
                : TRACK.end.x + TRACK_Y_OFFSET;
              const uturnCenterY = MAP_MID_Y;

              // console.log(`%c[MapEffect Train ${trainId} Fallback] Assigning STATE A (Active Turnaround Visual - Post Schedule)`, "color: blue; font-weight: bold;");
              finalState = {
                id: trainId,
                x: uturnCenterX,
                y: uturnCenterY,
                direction: lastDirectionAfterTurnaround!,
                isStopped: true,
                isActive: true,
                isTurningAround: true,
                rotation:
                  lastDirectionAfterTurnaround === "northbound" ? 180 : 0,
                currentStationIndex: -1,
                turnaroundProgress: progress,
                isInDepot: false, // Add missing isInDepot flag
              };
            } else {
              // After the last event, not in a final turnaround visual. Stop at last station.
              // console.log(`%c[MapEffect Train ${trainId} Fallback] Assigning STATE B (Dwell - Post Schedule End)`, "color: orange;");
              finalState = {
                id: trainId,
                x: getStationXById(lastEvent.NStation),
                y: getTrainYPosition(
                  lastEvent.Direction.toLowerCase() as Direction
                ),
                direction: lastEvent.Direction.toLowerCase() as Direction,
                isStopped: true,
                isActive: true, // Keep visible
                isTurningAround: false,
                rotation:
                  lastEvent.Direction.toLowerCase() === "northbound" ? 180 : 0,
                currentStationIndex: stations.findIndex(
                  (s) => s.id === lastEvent.NStation
                ),
                turnaroundProgress: null,
                isInDepot: false, // Add missing isInDepot flag
              };
            }
          } else {
            // Gap in schedule or other unexpected timing
            // console.log(`[MapEffect Train ${trainId} Fallback] Setting Inactive (Gap or Unknown)`);
            finalState = { id: trainId, isActive: false, isInDepot: false }; // Ensure isInDepot is false
          }
        }
        // Ensure final state has defaults if inactive
        if (!finalState.isActive) {
          finalState = {
            ...finalState,
            x: 0,
            y: 0,
            direction: "southbound",
            isStopped: false,
            isTurningAround: false,
            rotation: 0,
            currentStationIndex: -1,
            turnaroundProgress: null,
            isActive: false,
          };
        }
      }

      // --- Push state if active ---
      if (finalState.isActive) {
        // console.log(`[MapEffect Train ${trainId}] Pushing Final Active State:`, finalState);
        const completeState: TrainState = {
          id: trainId,
          x: finalState.x ?? 0,
          y: finalState.y ?? 0,
          direction: finalState.direction ?? "southbound",
          isStopped: finalState.isStopped ?? false,
          isActive: true,
          isTurningAround: finalState.isTurningAround ?? false,
          isInDepot: finalState.isInDepot ?? false, // Use calculated value or default
          rotation: finalState.rotation ?? 0,
          currentStationIndex: finalState.currentStationIndex ?? -1,
          turnaroundProgress: finalState.turnaroundProgress ?? null,
        };
        newTrainStates.push(completeState);
      } else {
        // console.log(`[MapEffect Train ${trainId}] Final State is Inactive.`);
      }
    } // End outer loop (trains)

    // --- Collect Debug Info ---
    const activeTrainCount = newTrainStates.length;
    const stoppedTrainCount = newTrainStates.filter(
      (t) => t.isStopped && !t.isTurningAround
    ).length;
    const movingTrainCount = newTrainStates.filter(
      (t) => !t.isStopped && !t.isTurningAround
    ).length;
    const turningAroundTrains = newTrainStates
      .filter((t) => t.isTurningAround)
      .map((t) => t.id);
    const currentDebugInfo = {
      "Active Trains": activeTrainCount,
      "Moving Trains": movingTrainCount,
      "Stopped Trains": stoppedTrainCount,
      "Turning Around":
        turningAroundTrains.length > 0
          ? turningAroundTrains.join(", ")
          : "None",
      // Add more debug fields here as needed
    };

    // Compare and update state only if necessary to avoid re-renders
    if (JSON.stringify(newTrainStates) !== JSON.stringify(trainStates)) {
      // console.log(
      //   `[MapEffect] Updating trainStates state. Prev: ${trainStates.length}, New: ${newTrainStates.length}`
      // );
      setTrainStates(newTrainStates);
      setDebugInfo(currentDebugInfo); // Update debug info only when train states change
    } else {
      // console.log("[MapEffect] No change in trainStates detected.");
    }

    // Update the count of inactive trains for dynamic box sizing
    setInactiveTrainCount(inactiveTrainIndex); // Set state after loop

    // --- DEBUG: Log Update End ---
    // console.log(
    //   `[MapEffect] Update End - SimTime: ${simulationTime}, TurnaroundTimeProp: ${turnaroundTime}`
    // );
    // --- End Debug ---
  }, [
    simulationTimetable,
    simulationTime,
    stations, // stations definition rarely changes, but keep dependency
    turnaroundTime, // turnaroundTime prop is now implicitly handled by the gap in the timetable data
    inactiveTrainCount, // ADDED dependency for centering calculation
    // trainStates dependency removed to prevent potential loops if state setting triggers effect
  ]);

  // Memoize station elements to prevent unnecessary re-renders
  const stationElements = useMemo(() => {
    return stations.map((station) => {
      const isSelected = station.id === selectedStation;
      const radius = isSelected ? SELECTED_STATION_RADIUS : STATION_RADIUS;
      const strokeWidth = isSelected
        ? SELECTED_STATION_STROKE_WIDTH
        : STATION_STROKE_WIDTH;

      return (
        <g
          key={`station-group-${station.id}`}
          className="cursor-pointer group transition-transform duration-200 ease-in-out"
          onClick={() => onStationClick && onStationClick(station.id)}
          transform={`translate(${station.x}, ${TRACK.stationCenterY})`}
        >
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
  }, [stations, selectedStation, onStationClick]);

  // Function to get Y position based on direction
  const getTrainYPosition = (direction: Direction) => {
    return direction === "southbound" ? TRACK.southboundY : TRACK.northboundY;
  };

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

        // Arrow points definition (base orientation, points right = 0 degrees)
        let arrowPoints = `0,0 ${arrowWidth},${
          arrowHeight / 2
        } 0,${arrowHeight}`;
        // Position arrow relative to center square, pointing right initially
        let arrowTransform = `translate(${halfTrainSize}, ${-halfTrainSize})`;

        // Base transform: Translate to train's x,y and apply fixed rotation based on direction
        // NO transitions here for instant teleportation
        const groupTransform = `translate(${train.x}, ${train.y}) rotate(${train.rotation})`;

        return (
          <g
            key={`train-${train.id}`}
            transform={groupTransform}
            className={`train-element group hover:scale-110 cursor-pointer ${
              train.isInDepot ? "opacity-80" : ""
            }`} // Add opacity if in depot
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
                className={`text-[10px] select-none pointer-events-none ${THEME.train.text}`}
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
                  stroke="currentColor" // Use train color or a neutral one
                  opacity={0.2} // Dim background
                  strokeWidth={loadingStrokeWidth}
                />
                {/* Progress Circle */}
                <circle
                  cx="0"
                  cy="0"
                  r={loadingRadius}
                  fill="none"
                  stroke="currentColor" // Use train color
                  strokeWidth={loadingStrokeWidth}
                  strokeDasharray={loadingCircumference}
                  // Animate offset based on progress
                  strokeDashoffset={
                    loadingCircumference * (1 - train.turnaroundProgress)
                  }
                  transform="rotate(-90)" // Start progress from top
                  // Use a fast transition only for the dash offset to make the fill smooth
                  className="transition-[stroke-dashoffset] duration-150 ease-linear"
                />
              </g>
            )}
          </g>
        );
      });
  }, [trainStates]); // Removed getTrainClass dependency

  const stationLabelElements = useMemo(() => {
    return stations.map((station) => {
      const isSelected = selectedStation === station.id;
      const labelX = station.x;
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
  }, [stations, selectedStation]); // Keep selectedStation dependency

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${THEME.background}`}
    >
      {/* Simulation Time Display */}
      <div
        className={`absolute top-2 right-2 px-3 py-1 rounded shadow text-lg font-mono font-semibold flex items-center z-10 ${THEME.legend}`}
      >
        <IconClock
          size={16}
          className="mr-2 text-gray-600 dark:text-gray-400"
        />
        {simulationTime}
      </div>

      {/* Debug Info Overlay - Top Left */}
      <div
        className={`absolute top-2 left-2 bg-white/80 dark:bg-gray-900/80 p-2 rounded shadow text-xs font-mono z-20 max-w-xs`}
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
                ? INACTIVE_TRAIN_SPACING * inactiveTrainCount + 20
                : 70) /
                2
            } // Increased padding (10+10)
            y={DEPOT_CENTER_Y - (INACTIVE_TRAIN_SIZE + 20) / 2} // Center box vertically around DEPOT_CENTER_Y
            // Calculate width: padding + (space for each train) + padding
            width={
              inactiveTrainCount > 0
                ? INACTIVE_TRAIN_SPACING * inactiveTrainCount + 20
                : 70
            } // Min width 70, added 10+10 padding
            height={INACTIVE_TRAIN_SIZE + 20} // INCREASED Height to encompass trains + more padding (10+10)
            fill="rgba(150, 150, 150, 0.1)" // Semi-transparent grey
            stroke="rgba(100, 100, 100, 0.3)" // Dim border
            strokeWidth={1}
            rx={5} // Rounded corners
          />
          <text
            // Center the text horizontally above the box relative to Station 7
            x={CENTER_STATION_X}
            y={DEPOT_CENTER_Y - (INACTIVE_TRAIN_SIZE + 20) / 2 - 5} // Position text above the larger box
            textAnchor="middle"
            className="text-[10px] fill-gray-500 dark:fill-gray-400 font-medium"
          >
            Inactive Trains
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div
        className={`absolute bottom-2 right-2 p-2 rounded shadow text-xs z-10 flex space-x-4 ${THEME.legend}`}
      >
        <div className="flex items-center">
          {/* Use dedicated legend indicator theme color and increase height */}
          <div
            className={`w-4 h-2 mr-2 rounded-sm ${THEME.legendIndicator.southbound}`}
          ></div>
          {/* Use HTML text theme color */}
          <span className={`${THEME.textHtmlPrimary}`}>Southbound</span>
        </div>
        <div className="flex items-center">
          {/* Use dedicated legend indicator theme color and increase height */}
          <div
            className={`w-4 h-2 mr-2 rounded-sm ${THEME.legendIndicator.northbound}`}
          ></div>
          {/* Use HTML text theme color */}
          <span className={`${THEME.textHtmlPrimary}`}>Northbound</span>
        </div>
      </div>
    </div>
  );
}
