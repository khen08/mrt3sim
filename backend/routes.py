import os
import json
from flask import request, jsonify, Blueprint
from werkzeug.utils import secure_filename
from prisma import Prisma
import datetime

# Import configuration and database logic
from config import DEFAULT_SETTINGS, UPLOAD_FOLDER

# Import database client
from connect import db

# Import Simulation Handler
from simulation import Simulation

# --- Create Blueprint ---
main_bp = Blueprint('main', __name__)

# --- API Routes (using Blueprint) ---

@main_bp.route('/upload_csv', methods=['POST'])
def upload_csv():
    if 'passenger_data_file' not in request.files:
        print("[ROUTE:/UPLOAD_CSV] ERROR: NO FILE PART IN REQUEST")
        return jsonify({"error": "No passenger_data_file part in the request"}), 400

    file = request.files['passenger_data_file']

    if file.filename == '':
        print("[ROUTE:/UPLOAD_CSV] ERROR: NO SELECTED FILE")
        return jsonify({"error": "No selected file"}), 400

    allowed_extension = '.csv'
    if not file.filename.lower().endswith(allowed_extension):
        print(f"[ROUTE:/UPLOAD_CSV] ERROR: INVALID FILE TYPE. ALLOWED: {allowed_extension}")
        return jsonify({"error": f"Invalid file type. Only {allowed_extension} files are allowed."}), 400

    if file:
        try:
            # Ensure upload folder exists (config.py handles initial creation, but check again)
            if not os.path.exists(UPLOAD_FOLDER):
                print(f"[ROUTE:/UPLOAD_CSV] WARNING: UPLOAD FOLDER {UPLOAD_FOLDER} DOES NOT EXIST. ATTEMPTING TO CREATE.")
                try:
                    os.makedirs(UPLOAD_FOLDER)
                    print(f"[ROUTE:/UPLOAD_CSV] RE-CREATED UPLOAD FOLDER: {UPLOAD_FOLDER}")
                except OSError as e:
                    print(f"[ROUTE:/UPLOAD_CSV] ERROR: COULD NOT CREATE UPLOAD FOLDER {UPLOAD_FOLDER} ON DEMAND: {e}")
                    return jsonify({"error": f"UPLOAD FOLDER MISSING AND COULD NOT BE CREATED: {UPLOAD_FOLDER}"}), 500
            
            # --- Generate timestamped filename --- 
            timestamp_str = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
            _, extension = os.path.splitext(file.filename)
            new_filename = f"{timestamp_str}_passenger_flow{extension if extension else '.csv'}" # Ensure .csv if no ext
            save_path = os.path.join(UPLOAD_FOLDER, new_filename)

            print(f"[ROUTE:/UPLOAD_CSV] GENERATED FILENAME: {new_filename}")
            print(f"[ROUTE:/UPLOAD_CSV] SAVING FILE TO: {save_path}")
            file.save(save_path)
            print(f"[ROUTE:/UPLOAD_CSV] FILE '{new_filename}' SAVED SUCCESSFULLY VIA /UPLOAD_CSV.")
            # Return the *new* generated filename
            return jsonify({"message": "File uploaded successfully", "filename": new_filename}), 200

        except Exception as e:
            print(f"[ROUTE:/UPLOAD_CSV] ERROR: COULD NOT SAVE FILE VIA /UPLOAD_CSV: {e}")
            import traceback # Import traceback here if needed for debugging save errors
            print(traceback.format_exc()) 
            return jsonify({"error": f"COULD NOT SAVE FILE: {e}"}), 500
    else:
        print("[ROUTE:/UPLOAD_CSV] ERROR: FILE OBJECT IS INVALID DURING /UPLOAD_CSV")
        return jsonify({"error": "Invalid file object received"}), 400

@main_bp.route('/run_simulation', methods=['POST'])
def run_simulation():
    try:
        simulation_input_data = request.get_json()
        print(f"[ROUTE:/RUN_SIMULATION] RECEIVED JSON PAYLOAD:\n{json.dumps(simulation_input_data, indent=2)}")
    except Exception as e:
        print(f"[ROUTE:/RUN_SIMULATION] FAILED TO GET JSON DATA: {e}")
        return jsonify({"error": f"Could not parse request JSON: {e}"}), 400

    config = simulation_input_data.get('config')

    if config is None: # Check for None specifically, as config could be an empty dict {}
        print("[ROUTE:/RUN_SIMULATION] ERROR: 'config' MISSING IN JSON PAYLOAD")
        return jsonify({"error": "'config' is missing in the request JSON"}), 400

    filename = simulation_input_data.get('filename')
    secure_name = None
    
    if filename != None:
        secure_name = secure_filename(filename)

        # Check if the file exists in the upload folder
        file_path = os.path.join(UPLOAD_FOLDER, secure_name)

        if not os.path.exists(file_path):
            print(f"[ROUTE:/RUN_SIMULATION] FILE '{secure_name}' NOT FOUND IN UPLOAD FOLDER '{UPLOAD_FOLDER}'")
            if not os.path.exists(UPLOAD_FOLDER):
                print(f"[ROUTE:/RUN_SIMULATION] UNDERLYING ISSUE: UPLOAD FOLDER '{UPLOAD_FOLDER}' DOES NOT EXIST.")
                return jsonify({"error": f"Upload folder '{UPLOAD_FOLDER}' is missing. Cannot find file '{secure_name}'."}), 500
            else:
                return jsonify({"error": f"File '{secure_name}' not found. Please upload the file first."}), 404

    try:
        # Instantiate the Simulation class
        sim = Simulation(csv_filename=secure_name, config=config)

        run_duration = sim.run()

        if sim.simulation_id:
            print(f"[ROUTE:/RUN_SIMULATION] SIMULATION RUN COMPLETED SUCCESSFULLY FOR ID: {sim.simulation_id}")
            
            return jsonify({
                "message": "Simulation completed successfully.",
                "simulation_id": sim.simulation_id,
                "run_duration": run_duration
                }), 200
        else:
            print(f"[ROUTE:/RUN_SIMULATION] ERROR: SIMULATION RUN FAILED TO PRODUCE A SIMULATION ID.")
            return jsonify({"error": "Simulation run failed. Check server logs for details."}), 500

    except Exception as e:
        print(f"[ROUTE:/RUN_SIMULATION] ERROR DURING SIMULATION PROCESSING: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"An unexpected error occurred during simulation: {e}"}), 500

@main_bp.route('/get_default_settings', methods=['GET'])
def get_default_settings():
    try:
        # DEFAULT_SETTINGS is imported from config
        print(f"[ROUTE:GET_DEFAULT_SETTINGS] Returning default settings")
        return jsonify(DEFAULT_SETTINGS)
    except Exception as e:
        print(f"[ROUTE:GET_DEFAULT_SETTINGS] FAILED TO FETCH DEFAULT SETTINGS: {e}")
        return jsonify({"error": f"Could not retrieve default settings: {e}"}), 500

@main_bp.route('/get_timetable/<int:simulation_id>', methods=['GET', 'OPTIONS'])
def get_timetable(simulation_id):
    try:       
        db.connect()
        print(f"[ROUTE:/GET_TIMETABLE] DATABASE CONNECTION ESTABLISHED")
            
        try:
            timetable_entries = db.train_movements.find_many(
                where={'SIMULATION_ID': simulation_id},
                order=[{'ARRIVAL_TIME': 'asc'}],
                include={'simulation': True}
            )
            
            service_periods_data = None
            if timetable_entries:
                simulation_record = timetable_entries[0].simulation
                if simulation_record and simulation_record.SERVICE_PERIODS:
                    if isinstance(simulation_record.SERVICE_PERIODS, (str, bytes, bytearray)):
                        try:
                            service_periods_data = json.loads(simulation_record.SERVICE_PERIODS)
                        except json.JSONDecodeError as json_err:
                            print(f"[ROUTE:/GET_TIMETABLE] WARNING: FAILED TO PARSE SERVICE_PERIODS JSON: {json_err}")
                            service_periods_data = {"error": "Failed to parse service periods data"}
                    elif isinstance(simulation_record.SERVICE_PERIODS, (list, dict)):
                        # If it's already a list or dict, use it directly
                        service_periods_data = simulation_record.SERVICE_PERIODS
                    else:
                        # Handle unexpected type
                        print(f"[ROUTE:/GET_TIMETABLE] WARNING: Unexpected type for SERVICE_PERIODS: {type(simulation_record.SERVICE_PERIODS)}")
                        service_periods_data = {"error": f"Unexpected data type for service periods: {type(simulation_record.SERVICE_PERIODS)}"}
                else:
                    print(f"[ROUTE:/GET_TIMETABLE] WARNING: No simulation record or SERVICE_PERIODS found for included data.")
            else:
                print(f"[ROUTE:/GET_TIMETABLE] No timetable entries found for simulation ID {simulation_id}")

            serializable_entries = []
            for entry in timetable_entries:
                entry_dict = entry.dict()
                entry_dict['ARRIVAL_TIME'] = entry_dict['ARRIVAL_TIME'].strftime('%H:%M:%S')
                if entry_dict['DEPARTURE_TIME']:
                    entry_dict['DEPARTURE_TIME'] = entry_dict['DEPARTURE_TIME'].strftime('%H:%M:%S')
                serializable_entries.append(entry_dict)
            
            print(f"[ROUTE:/GET_TIMETABLE] SUCCESSFULLY RETRIEVED {len(serializable_entries)} TIMETABLE ENTRIES FOR SIMULATION ID {simulation_id}")
            return jsonify({
                'timetable': serializable_entries,
                'service_periods': service_periods_data 
            })
        except Exception as e:
            print(f"[ROUTE:/GET_TIMETABLE] FAILED TO FETCH TIMETABLE ENTRIES: {e}")
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"[ROUTE:/GET_TIMETABLE] FAILED TO CONNECT TO DATABASE: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            db.disconnect()
            print(f"[ROUTE:/GET_TIMETABLE] DATABASE DISCONNECTED")
        except Exception as disconnect_error:
            print(f"[ROUTE:/GET_TIMETABLE] WARNING: ERROR DISCONNECTING FROM DATABASE: {disconnect_error}")

@main_bp.route('/get_history', methods=['GET'])
def get_history():
    try:
        # Get the 'since_id' query parameter
        since_id_str = request.args.get('since_id')
        since_id = None
        if since_id_str:
            try:
                since_id = int(since_id_str)
                print(f"[ROUTE:/GET_HISTORY] Received since_id: {since_id}")
            except ValueError:
                print(f"[ROUTE:/GET_HISTORY] WARNING: Invalid non-integer since_id received: {since_id_str}")
                # Optionally return an error or ignore it
                # return jsonify({"error": "Invalid since_id parameter, must be an integer"}), 400

        db.connect()
        print(f"[ROUTE:/GET_HISTORY] DATABASE CONNECTION ESTABLISHED")

        try:
            # Build the query arguments dynamically
            query_args = {
                'order': [{'CREATED_AT': 'desc'}] # Keep existing sort order
            }
            if since_id is not None:
                query_args['where'] = {'SIMULATION_ID': {'gt': since_id}}

            history_entries = db.simulations.find_many(
                **query_args
            )

            # Convert to serializable format
            serializable_entries = []
            for entry in history_entries:
                entry_dict = entry.dict()
                entry_dict['CREATED_AT'] = entry_dict['CREATED_AT'].strftime('%Y-%m-%d %H:%M:%S')
                entry_dict['START_TIME'] = entry_dict['START_TIME'].strftime('%Y-%m-%d %H:%M:%S')
                entry_dict['END_TIME'] = entry_dict['END_TIME'].strftime('%Y-%m-%d %H:%M:%S')
                serializable_entries.append(entry_dict)
            
            print(f"[ROUTE:/GET_HISTORY] SUCCESSFULLY RETRIEVED {len(serializable_entries)} HISTORY ENTRIES")
            return jsonify(serializable_entries)
        except Exception as e:
            print(f"[ROUTE:/GET_HISTORY] FAILED TO FETCH HISTORY ENTRIES: {e}")
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"[ROUTE:/GET_HISTORY] FAILED TO CONNECT TO DATABASE: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            db.disconnect()
            print(f"[ROUTE:/GET_HISTORY] DATABASE DISCONNECTED")
        except Exception as disconnect_error:
            print(f"[ROUTE:/GET_HISTORY] WARNING: ERROR DISCONNECTING FROM DATABASE: {disconnect_error}")

def format_time(time_obj):
    """Safely formats a datetime object to HH:MM:S string, handling None or non-datetime types."""
    if isinstance(time_obj, (datetime.datetime, datetime.time)):
        try:
            return time_obj.strftime('%H:%M:%S')
        except ValueError:
            # Fallback if strftime fails for some reason
            return str(time_obj)
    # Return None or the original value if it's not a suitable time object
    return time_obj

@main_bp.route('/get_passenger_demand/<int:simulation_id>', methods=['GET'])
def get_passenger_demand(simulation_id):
    try:
        db.connect()
        print(f"[ROUTE:/GET_PASSENGER_DEMAND] DATABASE CONNECTION ESTABLISHED")

        try:
            passenger_demand_entries = db.passenger_demand.find_many(
                where={'SIMULATION_ID': simulation_id}
            )

            formatted_entries = []
            for entry in passenger_demand_entries:
                entry_dict = entry.dict()

                # Create the new formatted dictionary
                formatted_entry = {
                    'Route': f"{entry_dict.get('ORIGIN_STATION_ID', 'N/A')}-{entry_dict.get('DESTINATION_STATION_ID', 'N/A')}",
                    'Passengers': entry_dict.get('PASSENGER_COUNT'),
                    'Demand Time': format_time(entry_dict.get('ARRIVAL_TIME_AT_ORIGIN')),
                    'Boarding Time': format_time(entry_dict.get('DEPARTURE_TIME_FROM_ORIGIN')),
                    'Arrival Destination': format_time(entry_dict.get('ARRIVAL_TIME_AT_DESTINATION')),
                    'Wait Time (s)': entry_dict.get('WAIT_TIME'),
                    'Travel Time (s)': entry_dict.get('TRAVEL_TIME'),
                    'Trip Type': entry_dict.get('TRIP_TYPE')
                }
                formatted_entries.append(formatted_entry)

            print(f"[ROUTE:/GET_PASSENGER_DEMAND] SUCCESSFULLY RETRIEVED AND FORMATTED {len(formatted_entries)} PASSENGER DEMAND ENTRIES FOR SIMULATION ID {simulation_id}")
            return jsonify(formatted_entries)
        except Exception as e:
            import traceback
            print(f"[ROUTE:/GET_PASSENGER_DEMAND] FAILED TO FETCH OR FORMAT PASSENGER DEMAND ENTRIES: {e}\n{traceback.format_exc()}")
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"[ROUTE:/GET_PASSENGER_DEMAND] FAILED TO CONNECT TO DATABASE: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            db.disconnect()
            print(f"[ROUTE:/GET_PASSENGER_DEMAND] DATABASE DISCONNECTED")
        except Exception as disconnect_error:
            print(f"[ROUTE:/GET_PASSENGER_DEMAND] WARNING: ERROR DISCONNECTING FROM DATABASE: {disconnect_error}")

# Note: The app is run from backend/app.py, not here.