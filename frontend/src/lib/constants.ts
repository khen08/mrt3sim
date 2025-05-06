// Time Constants

export const PEAK_HOURS = {
  AM: { start: "07:00:00", end: "09:00:00" },
  PM: { start: "17:00:00", end: "20:00:00" },
};

export const FULL_DAY_HOURS = {
  start: "04:30:00", // Assuming the earliest possible start based on service periods
  end: "23:00:00", // Assuming latest possible end
};

export type PeakPeriod = keyof typeof PEAK_HOURS; // 'AM' | 'PM'

// API Endpoints
export const API_BASE_URL = "http://localhost:5001";
export const GET_DEFAULT_SETTINGS_ENDPOINT = `${API_BASE_URL}/get_default_settings`;
export const RUN_SIMULATION_ENDPOINT = `${API_BASE_URL}/simulations`;
export const UPLOAD_CSV_ENDPOINT = `${API_BASE_URL}/upload_csv`;
export const GET_TIMETABLE_ENDPOINT = (simId: number | string) =>
  `${API_BASE_URL}/simulations/${simId}/timetable`;
export const GET_SIMULATION_HISTORY_ENDPOINT = `${API_BASE_URL}/simulations`;
export const GET_SIMULATION_CONFIG_ENDPOINT = (simId: number | string) =>
  `${API_BASE_URL}/simulations/${simId}/config`;
export const GET_PASSENGER_DEMAND_ENDPOINT = (simId: number | string) =>
  `${API_BASE_URL}/simulations/${simId}/passenger_demand`;
export const DELETE_SIMULATION_ENDPOINT = (simId: number | string) =>
  `${API_BASE_URL}/simulations/${simId}`;
export const DELETE_BULK_SIMULATIONS_ENDPOINT = `${API_BASE_URL}/simulations`;

// --- Add new endpoint for aggregated demand ---
export const GET_AGGREGATED_PASSENGER_DEMAND_ENDPOINT = (
  simId: number | string
) => `${API_BASE_URL}/simulations/${simId}/aggregated_demand`;
// --- End new endpoint ---

// MRT Map Layout Constants
export const HORIZONTAL_STATION_SPACING = 70;
export const MAP_START_X = 170;
export const MAP_WIDTH = 1200; // ViewBox width
export const MAP_MID_Y = 150;
export const TRACK_Y_OFFSET = 25;
export const STATION_RADIUS = 10;
export const SELECTED_STATION_RADIUS = 11;
export const STATION_STROKE_WIDTH = 1.5;
export const SELECTED_STATION_STROKE_WIDTH = 3;
export const LABEL_Y_OFFSET = -85;
export const STATION_VISUAL_X_OFFSET = 0;

// Station Type Indicator Constants
export const STATION_TYPE_INDICATOR_Y_OFFSET = 11; // Gap below name
export const STATION_TYPE_INDICATOR_HEIGHT = 10; // Fixed height
export const STATION_TYPE_INDICATOR_PADDING_X = 10; // Horizontal padding
export const STATION_TYPE_INDICATOR_X_OFFSET = 13; // Horizontal offset
export const STATION_TYPE_INDICATOR_PADDING_Y = 0; // Vertical padding
export const STATION_TYPE_INDICATOR_COLOR_A = "#0066CC";
export const STATION_TYPE_INDICATOR_COLOR_B = "#9E2B25";
export const STATION_TYPE_INDICATOR_COLOR_AB = "#FFFFFF";
export const STATION_TYPE_INDICATOR_TEXT_COLOR_AB = "#333333";
export const STATION_TYPE_INDICATOR_TEXT_COLOR_DEFAULT = "#FFFFFF";
export const STATION_TYPE_INDICATOR_BORDER_COLOR_AB = "#CCCCCC";

// Station Skip Highlight Constants
export const STATION_SKIP_HIGHLIGHT_OFFSET = 8;
export const STATION_SKIP_HIGHLIGHT_STROKE_WIDTH = 1.5;
export const STATION_SKIP_HIGHLIGHT_DASHARRAY = "4,4";

// Map Logic Constants
export const NORTH_TERMINUS_ID = 1;
export const SOUTH_TERMINUS_ID = 13;

// Depot Constants
export const DEPOT_CENTER_Y = MAP_MID_Y + TRACK_Y_OFFSET + 60;
export const INACTIVE_TRAIN_SIZE = 18;
export const INACTIVE_TRAIN_SPACING = 24;

// Active Train Visual Constants
export const ACTIVE_TRAIN_SIZE = 18;
export const TRAIN_ARROW_WIDTH = 8;
export const TRAIN_LOADING_CIRCLE_RADIUS = 12;
export const TRAIN_LOADING_CIRCLE_STROKE_WIDTH = 2.5;
export const TRAIN_STAGGER_Y_OFFSET = 15; // For overlapping turning trains

// Train Highlight Filter Constants
export const TRAIN_HIGHLIGHT_FILTER_STD_DEVIATION = "3";
export const TRAIN_HIGHLIGHT_FILTER_COLOR = "#FBBF24";
export const TRAIN_HIGHLIGHT_FILTER_OPACITY = "1";

// Simulation Controller Constants
export const SIMULATION_SPEED_PRESETS = [0.5, 1, 2, 5, 10, 20, 30];

// CSV Upload Constants
export const SAMPLE_CSV_PATH = "/sample_passenger_flow.csv";
export const SAMPLE_CSV_FILENAME = "sample_passenger_flow.csv";

// Define new Train Colors
export const TRAIN_COLOR_A = "#0066CC"; // MRT Blue
export const TRAIN_COLOR_B = "#9E2B25"; // New Red
export const TRAIN_COLOR_A_STOPPED = "#304d71"; // Darker Blue when stopped
export const TRAIN_COLOR_B_STOPPED = "#80302b"; // Darker Red when stopped

// Add constants for stopped regular trains (NEW)
export const TRAIN_COLOR_NB_STOPPED_REGULAR = "#1a6a49"; // Dark Green
export const TRAIN_COLOR_SB_STOPPED_REGULAR = "#d4b751"; // Dark Yellow

// Train Highlight Filter Constants (NEW)
// export const TRAIN_HIGHLIGHT_FILTER_STD_DEVIATION = "3"; // Removed duplicate

// Simulation Controller Constants
// export const SIMULATION_SPEED_PRESETS = [0.5, 1, 2, 5, 10, 20, 30]; // Removed duplicate

// Add other shared constants as needed
