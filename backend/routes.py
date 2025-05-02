import os
import json
from flask import request, jsonify, Blueprint
from werkzeug.utils import secure_filename
from prisma import Prisma

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
    print("Received request for /upload_csv")

    # --- 1. Check for file part ---
    if 'passenger_data_file' not in request.files:
        print("Error: No file part in request")
        return jsonify({"error": "No passenger_data_file part in the request"}), 400

    file = request.files['passenger_data_file']

    # --- 2. Check if a file was selected ---
    if file.filename == '':
        print("Error: No selected file")
        return jsonify({"error": "No selected file"}), 400

    # --- 3. Process and save the file ---
    if file:
        try:
            # Ensure upload folder exists (config.py handles initial creation, but check again)
            if not os.path.exists(UPLOAD_FOLDER):
                print(f"Warning: Upload folder {UPLOAD_FOLDER} does not exist. Attempting to create.")
                try:
                    os.makedirs(UPLOAD_FOLDER)
                    print(f"Re-created upload folder: {UPLOAD_FOLDER}")
                except OSError as e:
                    print(f"Error: Could not create upload folder {UPLOAD_FOLDER} on demand: {e}")
                    return jsonify({"error": f"Upload folder missing and could not be created: {UPLOAD_FOLDER}"}), 500

            filename = secure_filename(file.filename)
            save_path = os.path.join(UPLOAD_FOLDER, filename)

            print(f"Saving file to: {save_path}")
            file.save(save_path)
            print(f"File '{filename}' saved successfully via /upload_csv.")
            return jsonify({"message": "File uploaded successfully", "filename": filename}), 200

        except Exception as e:
            print(f"Error saving file via /upload_csv: {e}")
            return jsonify({"error": f"Could not save file: {e}"}), 500
    else:
        print("Error: File object is invalid during /upload_csv")
        return jsonify({"error": "Invalid file object received"}), 400

@main_bp.route('/run_simulation', methods=['POST'])
def run_simulation():
    try:
        simulation_input_data = request.get_json()
        print(f"[ROUTE:/RUN_SIMULATION] RECEIVED JSON PAYLOAD:\n{json.dumps(simulation_input_data, indent=2)}")
    except Exception as e:
        print(f"[ROUTE:/RUN_SIMULATION] FAILED TO GET JSON DATA: {e}")
        return jsonify({"error": f"Could not parse request JSON: {e}"}), 400

    # Get the filename and config from the JSON payload
    filename = simulation_input_data.get('filename')
    config = simulation_input_data.get('config')

    if not filename:
        print("[ROUTE:/RUN_SIMULATION] ERROR: 'filename' MISSING IN JSON PAYLOAD")
        return jsonify({"error": "'filename' is missing in the request JSON"}), 400
    if config is None: # Check for None specifically, as config could be an empty dict {}
        print("[ROUTE:/RUN_SIMULATION] ERROR: 'config' MISSING IN JSON PAYLOAD")
        return jsonify({"error": "'config' is missing in the request JSON"}), 400

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
        print(f"[ROUTE:GET_DEFAULT_SETTINGS] Returning default settings: {DEFAULT_SETTINGS}")
        return jsonify(DEFAULT_SETTINGS)
    except Exception as e:
        print(f"[ROUTE:GET_DEFAULT_SETTINGS] FAILED TO FETCH DEFAULT SETTINGS: {e}")
        return jsonify({"error": f"Could not retrieve default settings: {e}"}), 500

@main_bp.route('/get_timetable/<int:simulation_id>', methods=['GET', 'OPTIONS'])
def get_timetable(simulation_id):
    try:       
        db.connect()
        print(f"[ROUTE:GET_TIMETABLE] DATABASE CONNECTION ESTABLISHED")
            
        try:
            timetable_entries = db.train_movements.find_many(
                where={'SIMULATION_ID': simulation_id},
                order=[{'ARRIVAL_TIME': 'asc'}]
            )
            
            # Convert to serializable format
            serializable_entries = []
            for entry in timetable_entries:
                # Convert datetime objects to strings
                entry_dict = entry.dict()
                entry_dict['ARRIVAL_TIME'] = entry_dict['ARRIVAL_TIME'].strftime('%H:%M:%S')
                if entry_dict['DEPARTURE_TIME']:
                    entry_dict['DEPARTURE_TIME'] = entry_dict['DEPARTURE_TIME'].strftime('%H:%M:%S')
                serializable_entries.append(entry_dict)
            
            print(f"[ROUTE:GET_TIMETABLE] SUCCESSFULLY RETRIEVED {len(serializable_entries)} TIMETABLE ENTRIES FOR SIMULATION ID {simulation_id}")
            return jsonify(serializable_entries)
        except Exception as e:
            print(f"[ROUTE:GET_TIMETABLE] FAILED TO FETCH TIMETABLE ENTRIES: {e}")
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"[ROUTE:GET_TIMETABLE] FAILED TO CONNECT TO DATABASE: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            db.disconnect()
            print(f"[ROUTE:GET_TIMETABLE] DATABASE DISCONNECTED")
        except Exception as disconnect_error:
            print(f"[ROUTE:GET_TIMETABLE] WARNING: ERROR DISCONNECTING FROM DATABASE: {disconnect_error}")

@main_bp.route('/get_history', methods=['GET'])
def get_history():
    try:
        db.connect()
        print(f"[ROUTE:GET_HISTORY] DATABASE CONNECTION ESTABLISHED")
        
        try:
            history_entries = db.simulations.find_many(
                order=[{'START_TIME': 'desc'}]
            )
            
            # Convert to serializable format
            serializable_entries = []
            for entry in history_entries:
                entry_dict = entry.dict()
                entry_dict['START_TIME'] = entry_dict['START_TIME'].strftime('%Y-%m-%d %H:%M:%S')
                serializable_entries.append(entry_dict)
            
            print(f"[ROUTE:GET_HISTORY] SUCCESSFULLY RETRIEVED {len(serializable_entries)} HISTORY ENTRIES")
            return jsonify(serializable_entries)
        except Exception as e:
            print(f"[ROUTE:GET_HISTORY] FAILED TO FETCH HISTORY ENTRIES: {e}")
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"[ROUTE:GET_HISTORY] FAILED TO CONNECT TO DATABASE: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            db.disconnect()
            print(f"[ROUTE:GET_HISTORY] DATABASE DISCONNECTED")
        except Exception as disconnect_error:
            print(f"[ROUTE:GET_HISTORY] WARNING: ERROR DISCONNECTING FROM DATABASE: {disconnect_error}")
# Note: The app is run from backend/app.py, not here.