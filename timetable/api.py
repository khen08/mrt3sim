import os
from datetime import datetime, time
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import json
import copy # For deep copying config

# Import the simulation logic and default config from simulation_core.py
# Assuming simulation_core.py is in the same directory or accessible via Python path
try:
    # Ensure simulation_core module can be found
    # Import necessary functions and the default config
    from simulation_core import run_simulation_from_config, DEFAULT_CONFIG, get_datetime_from_csv, parse_passenger_data
except ImportError as e:
    print(f"ERROR: Could not import from simulation_core.py. Ensure it's in the correct path. {e}")
    # Exit or raise a more specific error if the API cannot function without simulation_core.py
    raise

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Define upload folder relative to api.py location
APP_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(APP_DIR, 'uploads')
SAVED_CSV_FILENAME = 'passenger_data_input.csv' # Standard name for the saved CSV

# Ensure the upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    try:
        os.makedirs(UPLOAD_FOLDER)
        print(f"Created upload folder: {UPLOAD_FOLDER}")
    except OSError as e:
        print(f"Error creating upload folder {UPLOAD_FOLDER}: {e}")
        UPLOAD_FOLDER = APP_DIR
        print(f"Warning: Upload folder creation failed. Saving CSV in app directory: {APP_DIR}")


# --- Frontend Keys to Backend Config Keys Mapping ---
# Helps translate settings received from the frontend
FRONTEND_TO_BACKEND_MAP = {
    'dwellTime': 'dwell_time',
    'turnaroundTime': 'turnaround_time',
    'acceleration': 'accel_rate',      # Nested under train_specs
    'deceleration': 'decel_rate',      # Nested under train_specs
    'maxSpeed': 'cruising_speed',    # Nested under train_specs
    'maxCapacity': 'max_capacity',    # Nested under train_specs
    # 'passthroughSpeed': 'passthrough_speed', # Assuming passthrough speed is not configurable from frontend for now
    'schemeType': 'scheme',
    'stations': ['named_stations', 'station_distances'] # Special handling
}

# Define fixed simulation time hours/minutes
SIMULATION_START_HOUR = 5
SIMULATION_START_MINUTE = 0
SIMULATION_END_HOUR = 22
SIMULATION_END_MINUTE = 0

# --- API Endpoints --- #

@app.route('/get_default_settings', methods=['GET'])
def get_default_settings():
    """Returns the relevant default settings for the frontend."""
    print("Request received for /get_default_settings")
    try:
        # Extract only the settings needed by the frontend
        defaults_for_frontend = {
            'dwellTime': DEFAULT_CONFIG.get('dwell_time'),
            'turnaroundTime': DEFAULT_CONFIG.get('turnaround_time'),
            # Extract train_specs defaults
            'acceleration': DEFAULT_CONFIG.get('train_specs', {}).get('accel_rate'),
            'deceleration': DEFAULT_CONFIG.get('train_specs', {}).get('decel_rate'),
            'maxSpeed': DEFAULT_CONFIG.get('train_specs', {}).get('cruising_speed'),
            'maxCapacity': DEFAULT_CONFIG.get('train_specs', {}).get('max_capacity'),
            'schemeType': DEFAULT_CONFIG.get('scheme'), # Will be "Regular" or potentially a list if Skip-Stop default
            # Convert Skip-Stop list back to string if needed
            # 'stations': # Construct the initial stations list from named_stations and station_distances
        }

        # Handle scheme type conversion if default is list
        if isinstance(defaults_for_frontend['schemeType'], list):
            defaults_for_frontend['schemeType'] = "Skip-Stop"

        # Construct the stations list for the frontend
        default_names = DEFAULT_CONFIG.get('named_stations', [])
        default_distances = DEFAULT_CONFIG.get('station_distances', [])
        stations_list = []
        if default_names:
            stations_list.append({"name": default_names[0], "distance": 0}) # First station has distance 0
            for i, name in enumerate(default_names[1:]):
                distance = default_distances[i] if i < len(default_distances) else 0 # Handle potential length mismatch
                stations_list.append({"name": name, "distance": distance})
        defaults_for_frontend['stations'] = stations_list

        print(f"Returning default settings: {json.dumps(defaults_for_frontend, indent=2)}")
        return jsonify(defaults_for_frontend)

    except Exception as e:
        print(f"Error fetching default settings: {e}")
        return jsonify({"error": "Failed to retrieve default settings"}), 500


@app.route('/process_passenger_data', methods=['POST'])
def process_passenger_data_endpoint():
    """Handles CSV upload, saves it, and parses passenger arrival data."""
    print("\n--- Passenger Data Processing Request Received ---")

    # --- 1. Handle File Upload --- #
    if 'passenger_data' not in request.files:
        print("Error: 'passenger_data' file part missing.")
        return jsonify({"error": "No passenger data file provided ('passenger_data' part missing)"}), 400

    file = request.files['passenger_data']
    if file.filename == '':
        print("Error: No file selected.")
        return jsonify({"error": "No file selected"}), 400

    save_path = os.path.join(UPLOAD_FOLDER, SAVED_CSV_FILENAME)
    try:
        file.save(save_path)
        print(f"Saved uploaded passenger data to: {save_path}")
    except Exception as e:
        print(f"Error saving uploaded file to {save_path}: {e}")
        return jsonify({"error": f"Could not save uploaded file: {e}"}), 500

    # --- 2. Parse Passenger Data using function from simulation_core.py --- #
    parsed_data = parse_passenger_data(save_path)

    if isinstance(parsed_data, dict) and 'error' in parsed_data:
        print(f"Error during passenger data parsing: {parsed_data['error']}")
        # Decide if we should delete the saved file on error
        # try: os.remove(save_path) except OSError: pass
        return jsonify(parsed_data), 400 # Return the error from parsing

    print("Successfully processed passenger data.")
    return jsonify(parsed_data)


@app.route('/run_simulation', methods=['POST'])
def handle_simulation():
    """Runs the simulation using previously uploaded CSV and current settings."""
    print("\n--- Simulation Run Request Received ---")

    # --- 1. Check if Passenger Data Exists --- #
    csv_path = os.path.join(UPLOAD_FOLDER, SAVED_CSV_FILENAME)
    if not os.path.exists(csv_path):
        print(f"Error: Required passenger data file not found at {csv_path}. Please upload first.")
        return jsonify({"error": "Passenger data not found. Please upload the CSV file first via /process_passenger_data."}), 400

    # --- 2. Determine Simulation Date from Saved CSV --- #
    print(f"Determining simulation date from: {csv_path}")
    simulation_date = get_datetime_from_csv(csv_path)
    if not simulation_date:
        print("Error: Could not determine simulation date from the saved CSV.")
        return jsonify({"error": "Could not determine a valid simulation date (Year, Month, Day) from the saved CSV."}), 400
    print(f"Determined Simulation Date: {simulation_date.date()}")

    # --- 3. Define Fixed Simulation Start and End Times --- #
    try:
        sim_start_time = datetime.combine(simulation_date.date(), time(hour=SIMULATION_START_HOUR, minute=SIMULATION_START_MINUTE))
        sim_end_time = datetime.combine(simulation_date.date(), time(hour=SIMULATION_END_HOUR, minute=SIMULATION_END_MINUTE))
        print(f"Simulation Period Set: {sim_start_time} to {sim_end_time}")
    except ValueError as e:
        print(f"Error creating simulation start/end times: Invalid hour/minute? {e}")
        return jsonify({"error": "Internal error setting simulation time boundaries."}), 500

    # --- 4. Handle Settings Overrides from Request Body --- #
    config_overrides = {}
    if request.is_json:
        try:
            config_overrides = request.get_json()
            if config_overrides:
                print("Received configuration overrides from JSON body.")
            else:
                print("Received empty/null JSON body. Using default settings for overrides.")
                config_overrides = {}
        except Exception as e:
            print(f"Error parsing JSON body: {e}. Using default settings for overrides.")
            config_overrides = {}
    else:
        print("No JSON body found. Using default settings for overrides.")
        config_overrides = {}

    if config_overrides is None: # Ensure it's a dict
        config_overrides = {}

    print("Raw config_overrides received:")
    print(json.dumps(config_overrides, indent=2))

    # --- 5. Merge Default Config with Allowed Overrides --- #
    final_config = copy.deepcopy(DEFAULT_CONFIG) # Start with defaults
    print("\nMerging configuration...")

    # --- Apply Overrides using the mapping --- #
    for fe_key, be_mapping in FRONTEND_TO_BACKEND_MAP.items():
        if fe_key in config_overrides and config_overrides[fe_key] is not None:
            value_to_set = config_overrides[fe_key]

            # Handle direct mappings (dwell, turnaround)
            if isinstance(be_mapping, str) and be_mapping in ['dwell_time', 'turnaround_time']:
                be_key = be_mapping
                print(f"  Attempting to override {be_key} with value '{value_to_set}' (type: {type(value_to_set)}). Current value: {final_config.get(be_key)}")
                try:
                    converted_value = int(value_to_set)
                    final_config[be_key] = converted_value
                    print(f"    Successfully set {be_key} to: {final_config[be_key]} (type: {type(final_config[be_key])})")
                except (ValueError, TypeError) as e:
                    print(f"    ERROR converting/setting {be_key}: {e}. Ignoring override for {fe_key}: {value_to_set}")

            # Handle train_specs mappings
            elif isinstance(be_mapping, str) and be_mapping in DEFAULT_CONFIG.get('train_specs', {}):
                 be_key = be_mapping
                 # Ensure train_specs dict exists
                 if 'train_specs' not in final_config: final_config['train_specs'] = {}
                 try:
                    if be_key == 'max_capacity':
                        final_config['train_specs'][be_key] = int(value_to_set)
                    else:
                        final_config['train_specs'][be_key] = float(value_to_set)
                    print(f"    Overriding train_specs.{be_key} (from {fe_key}): {final_config['train_specs'][be_key]}")
                 except (ValueError, TypeError):
                    print(f"    Ignoring invalid value for {fe_key}: {value_to_set}")

            # Handle scheme mapping
            elif be_mapping == 'scheme':
                be_key = be_mapping # Assign be_key here
                scheme_type = value_to_set
                print(f"  Processing schemeType override: {scheme_type}")
                if scheme_type == "Skip-Stop":
                    # Define the standard skip-stop pattern
                    final_config[be_key] = [
                        "AB", "A", "AB", "B", "AB", "A", "AB", "B", "AB", "A", "AB", "B", "AB"
                    ]
                    # Adjust length based on default stations if needed, or let simulation_core.py handle it.
                    if len(final_config[be_key]) != len(DEFAULT_CONFIG.get('named_stations', [])):
                        print("Warning: Generated Skip-Stop scheme length differs from default station count.")
                    print(f"    Set {be_key} to Skip-Stop list.")
                elif scheme_type == "Regular":
                    final_config[be_key] = "Regular"
                    print(f"    Set {be_key} to Regular string.")
                else:
                    # Use .get() for safer access to potentially missing default key
                    print(f"    Warning: Unknown schemeType '{scheme_type}'. Using default: {final_config.get(be_key)}")

            # Handle stations mapping (list of keys)
            elif isinstance(be_mapping, list) and fe_key == 'stations':
                frontend_stations = value_to_set
                print(f"  Processing stations override ({len(frontend_stations)} stations received)...")
                # Check if frontend_stations is a list
                if isinstance(frontend_stations, list) and len(frontend_stations) >= 2: # Need at least 2 stations
                    # Extract names
                    new_names = [s.get('name') for s in frontend_stations if s and isinstance(s, dict) and s.get('name')]
                    # Check all stations had names and format was correct
                    if len(new_names) == len(frontend_stations):
                        final_config['named_stations'] = new_names # be_mapping[0] is 'named_stations'
                        print(f"    Updated named_stations: {len(final_config['named_stations'])} stations")

                        # Extract distances (one less than names)
                        raw_distances = [s.get('distance') for s in frontend_stations[1:] if s and isinstance(s, dict)]
                        new_distances = []
                        valid_distances = True
                        # Check correct number of distances provided
                        if len(raw_distances) == len(new_names) - 1:
                            for i, d in enumerate(raw_distances):
                                if d is not None:
                                    try: new_distances.append(float(d))
                                    except (ValueError, TypeError): valid_distances = False; break
                                else: valid_distances = False; break # Missing distance

                            if valid_distances:
                                final_config['station_distances'] = new_distances # be_mapping[1] is 'station_distances'
                                print(f"    Updated station_distances: {len(final_config['station_distances'])} segments")
                            else:
                                print("    Warning: Invalid or missing distances in stations override. Ignoring distance override.")
                                # Revert to default if distances are invalid
                                final_config['station_distances'] = DEFAULT_CONFIG.get('station_distances', [])
                        else:
                             print("    Warning: Incorrect number of distances provided. Ignoring distance override.")
                             # Revert to default if count is wrong
                             final_config['station_distances'] = DEFAULT_CONFIG.get('station_distances', [])
                    else:
                        print("    Warning: Missing names or invalid format in stations override. Ignoring station override.")
                        # Revert stations if names are wrong
                        final_config['named_stations'] = DEFAULT_CONFIG.get('named_stations', [])
                        final_config['station_distances'] = DEFAULT_CONFIG.get('station_distances', [])
                else:
                     print("    Warning: Insufficient stations (< 2) or invalid format in override. Ignoring station override.")
                     # Revert stations if list is too short or not a list
                     final_config['named_stations'] = DEFAULT_CONFIG.get('named_stations', [])
                     final_config['station_distances'] = DEFAULT_CONFIG.get('station_distances', [])

    # --- Log Final Config (Before creating TrainSpec instance) --- #
    print("\n--- Final Configuration Prepared for Simulation (TrainSpec as dict): ---")
    print(json.dumps(final_config, indent=2, default=str))
    print("-------------------------------------------------------------------")

    # --- 6. Run Simulation --- #
    print("Calling simulation function...")
    try:
        result_df = run_simulation_from_config(
            config=final_config, # Pass the dict; run_simulation_from_config creates the TrainSpec instance
            passenger_csv_path=csv_path,
            sim_start_time=sim_start_time,
            sim_end_time=sim_end_time
        )
    except Exception as e:
        print(f"CRITICAL ERROR: Unhandled exception during call to run_simulation_from_config: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred during simulation execution."}), 500

    # --- 7. Format and Return Results --- #
    if result_df is not None and isinstance(result_df, pd.DataFrame):
        print("Simulation successful. Preparing JSON response...")
        try:
            # Save Timetable Output
            now = datetime.now()
            timestamp_str = now.strftime("%Y%m%d_%H%M%S")
            output_filename = f"timetable_output_{timestamp_str}.csv"
            output_path = os.path.join(APP_DIR, output_filename)
            result_df.to_csv(output_path, index=False)
            print(f"Output timetable saved to: {os.path.abspath(output_path)}")
        except Exception as e:
            print(f"Warning: Error saving timetable CSV output: {e}")

        # Convert DataFrame to JSON using to_json() for better NaN handling
        # result_df_filled = result_df.where(pd.notnull(result_df), None) # Old method
        # result_json = result_df_filled.to_dict(orient='records') # Old method
        try:
            # default_handler=str helps with potential non-standard types like Timedelta if they slip through
            # double_precision=10 can help with float precision issues if any arise
            result_json_string = result_df.to_json(orient='records', date_format='iso', default_handler=str, double_precision=10)
            print(f"Returning JSON response string (length: {len(result_json_string)}). First 200 chars: {result_json_string[:200]}")
            # Return the JSON string directly with the correct content type
            return app.response_class(
                response=result_json_string,
                status=200,
                mimetype='application/json'
            )
        except Exception as json_conversion_error:
            print(f"CRITICAL ERROR: Failed to convert DataFrame to JSON: {json_conversion_error}")
            return jsonify({"error": "Failed to serialize simulation results."}), 500

    else:
        print("Simulation function returned None or invalid result.")
        return jsonify({"error": "Simulation failed to produce results. Check server logs."}), 500

if __name__ == '__main__':
    print("Starting Flask development server...")
    app.run(debug=True, host='0.0.0.0', port=5001) 