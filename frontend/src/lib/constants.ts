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
export const RUN_SIMULATION_ENDPOINT = `${API_BASE_URL}/run_simulation`;
export const UPLOAD_CSV_ENDPOINT = `${API_BASE_URL}/upload_csv`;
export const GET_TIMETABLE_ENDPOINT = (simId: number | string) =>
  `${API_BASE_URL}/get_timetable/${simId}`;
// Add endpoint for history later: export const GET_SIMULATION_HISTORY_ENDPOINT = ...

// MRT Map Layout Constants
export const HORIZONTAL_STATION_SPACING = 70;
export const MAP_START_X = 170;
export const MAP_WIDTH = 1200; // ViewBox width
export const MAP_MID_Y = 120;
export const TRACK_Y_OFFSET = 25;
export const STATION_RADIUS = 10;
export const SELECTED_STATION_RADIUS = 11;
export const STATION_STROKE_WIDTH = 1.5;
export const SELECTED_STATION_STROKE_WIDTH = 3;
export const LABEL_Y_OFFSET = -75;
export const STATION_VISUAL_X_OFFSET = 0;

// Map Logic Constants
export const NORTH_TERMINUS_ID = 1;
export const SOUTH_TERMINUS_ID = 13;

// Depot Constants
export const DEPOT_CENTER_Y = MAP_MID_Y + TRACK_Y_OFFSET + 60;
export const INACTIVE_TRAIN_SIZE = 18;
export const INACTIVE_TRAIN_SPACING = 24;

// Simulation Controller Constants
export const SIMULATION_SPEED_PRESETS = [0.5, 1, 2, 5, 10, 20, 30];

// CSV Upload Constants
export const SAMPLE_CSV_PATH = "/sample_passenger_flow.csv";
export const SAMPLE_CSV_FILENAME = "sample_passenger_flow.csv";

// Add other shared constants as needed
