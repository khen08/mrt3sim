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
    print("Received request for /run_simulation")

    if not request.is_json:
        print("Error: Request is not JSON")
        return jsonify({"error": "Request must be JSON"}), 400

    try:
        simulation_input_data = request.get_json()
        print(f"---Received JSON payload:{json.dumps(simulation_input_data, indent=2)}---")
    except Exception as e:
        print(f"Error getting JSON data: {e}")
        return jsonify({"error": f"Could not parse request JSON: {e}"}), 400

    if not simulation_input_data:
        print("Error: Empty JSON received")
        return jsonify({"error": "Received empty JSON data"}), 400

    filename = simulation_input_data.get('filename')
    config = simulation_input_data.get('config')

    if not filename:
        print("Error: 'filename' missing in JSON")
        return jsonify({"error": "'filename' is missing in the request JSON"}), 400

    if not config:
        print("Error: 'config' missing in JSON")
        return jsonify({"error": "'config' is missing in the request JSON"}), 400

    secure_name = secure_filename(filename)
    file_path = os.path.join(UPLOAD_FOLDER, secure_name)

    if not os.path.exists(file_path):
        print(f"Error: File '{secure_name}' not found in upload folder '{UPLOAD_FOLDER}'")
        if not os.path.exists(UPLOAD_FOLDER):
            print(f"Underlying issue: Upload folder '{UPLOAD_FOLDER}' does not exist.")
            return jsonify({"error": f"Upload folder '{UPLOAD_FOLDER}' is missing. Cannot find file '{secure_name}'."}), 500
        else:
            return jsonify({"error": f"File '{secure_name}' not found. Please upload the file first."}), 404

    try:
        print("--- Simulation Configuration ---")
        print(json.dumps(config, indent=2))
        print(f"--- Using data file: {secure_name} ---")

        # Instantiate the Simulation class
        sim = Simulation(csv_filename=secure_name, config=config)

        # Run the simulation with the specified scheme type
        sim.run()

        # Check if simulation ran successfully (indicated by simulation_id being set)
        if sim.simulation_id:
            print(f"Simulation run completed successfully for ID: {sim.simulation_id}")
            # You might want to fetch some results from the DB here if needed
            # For now, just return the ID and a success message.
            return jsonify({
                "message": "Simulation completed successfully.",
                "simulation_id": sim.simulation_id
                }), 200
        else:
            # sim.run() likely encountered an error and handled it internally
            # (e.g., failed to create DB entry, deleted failed entry)
            print("Error: Simulation run failed to produce a simulation ID.")
            return jsonify({"error": "Simulation run failed. Check server logs for details."}), 500

    except Exception as e:
        # Catch any unexpected errors during instantiation or the run call itself
        print(f"Error during simulation processing in /run_simulation route: {e}")
        import traceback
        print(traceback.format_exc())
        # Attempt to delete the simulation entry if one was created before the error
        # This is a safety net, sim.run() should handle its own cleanup on failure.
        # We might not have sim.simulation_id here if the error was early.
        # Consider more robust error handling/cleanup if necessary.
        return jsonify({"error": f"An unexpected error occurred during simulation: {e}"}), 500

@main_bp.route('/get_default_settings', methods=['GET'])
def get_default_settings():
    print("--- Inside get_default_settings function ---")
    print("Request received for /get_default_settings")
    try:
        # DEFAULT_SETTINGS is imported from config
        print("Returning default settings:", DEFAULT_SETTINGS)
        return jsonify(DEFAULT_SETTINGS)
    except Exception as e:
        print(f"Error fetching default settings: {e}")
        return jsonify({"error": f"Could not retrieve default settings: {e}"}), 500

@main_bp.route('/get_timetable/<int:simulation_id>', methods=['GET', 'OPTIONS'])
def get_timetable(simulation_id):
    try:
        # Add CORS headers for OPTIONS request
        if request.method == 'OPTIONS':
            response = jsonify({'status': 'ok'})
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.add('Access-Control-Allow-Methods', 'GET')
            return response
        
        # Connect to database - ensure we have a connection
        db.connect()
        print(f"Database connected for timetable query (simulation_id: {simulation_id})")
            
        # Fetch timetable entries from the database
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
        
        print(f"Retrieved {len(serializable_entries)} timetable entries for simulation ID {simulation_id}")
        return jsonify(serializable_entries)
    except Exception as e:
        print(f"Error fetching timetable for simulation ID {simulation_id}: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Always ensure we disconnect (to prevent connection leaks)
        try:
            db.disconnect()
            print("Database disconnected after timetable query")
        except Exception as disconnect_error:
            print(f"Warning: Error disconnecting from database: {disconnect_error}")

# Note: The app is run from backend/app.py, not here.