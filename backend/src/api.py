import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from prisma import Prisma

# Import configuration and database logic
from .config import DEFAULT_SETTINGS, UPLOAD_FOLDER
from .database import InitializeDB_Data
from .database.connect import db

# Import Simulation Handler
from .simulation import Simulation
# --- Initialize Flask App ---
app = Flask(__name__)
CORS(app) # Enable CORS for all routes
print("API initialized") # Adjust print statement


# --- API Routes ---

@app.route('/upload_csv', methods=['POST'])
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

@app.route('/run_simulation', methods=['POST'])
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
        initialize_db = InitializeDB_Data(file_path, config)
        regular_service_id, skip_stop_service_id = initialize_db.return_simulation_ids()
        print(f"Regular service ID: {regular_service_id}")
        print(f"Skip-stop service ID: {skip_stop_service_id}")

        simulation = Simulation(regular_service_id, skip_stop_service_id)
        simulation.run()

        placeholder_timetable = [
            {"message": "Simulation logic placeholder."},
            {"using_preuploaded_file": filename},
            {"received_config": config}
        ]
        #print("Returning placeholder simulation result from /run_simulation.")
        return jsonify(placeholder_timetable), 200 # Or return 'results'

    except Exception as e:
        print(f"Error during simulation processing: {e}")
        return jsonify({"error": f"Error during simulation processing: {e}"}), 500

@app.route('/get_default_settings', methods=['GET'])
def get_default_settings():
    print("Request received for /get_default_settings")
    try:
        # DEFAULT_SETTINGS is imported from config
        print("Returning default settings:", DEFAULT_SETTINGS)
        return jsonify(DEFAULT_SETTINGS)
    except Exception as e:
        print(f"Error fetching default settings: {e}")
        return jsonify({"error": f"Could not retrieve default settings: {e}"}), 500

# Note: The app is run from backend/app.py, not here.