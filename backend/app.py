import os
import json
from datetime import datetime, time
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename


app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Define upload folder relative to api.py location
APP_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(APP_DIR, 'uploads')


# Ensure the upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    try:
        os.makedirs(UPLOAD_FOLDER)
        print(f"Created upload folder: {UPLOAD_FOLDER}")
    except OSError as e:
        print(f"Error creating upload folder {UPLOAD_FOLDER}: {e}")
        # If creation fails, we cannot proceed with saving files reliably.
        # Log the error, but let endpoints handle the non-existent folder later.
        pass # Avoid setting UPLOAD_FOLDER back to APP_DIR

# --- NEW Endpoint for handling immediate file uploads ---
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
            # Ensure upload folder exists (might have failed during startup or been deleted)
            if not os.path.exists(UPLOAD_FOLDER):
                print(f"Warning: Upload folder {UPLOAD_FOLDER} does not exist. Attempting to create.")
                try:
                    os.makedirs(UPLOAD_FOLDER)
                    print(f"Re-created upload folder: {UPLOAD_FOLDER}")
                except OSError as e:
                    print(f"Error: Could not create upload folder {UPLOAD_FOLDER} on demand: {e}")
                    # If folder cannot be created, we cannot save the file
                    return jsonify({"error": f"Upload folder missing and could not be created: {UPLOAD_FOLDER}"}), 500

            # Use secure_filename to prevent directory traversal issues
            filename = secure_filename(file.filename)
            save_path = os.path.join(UPLOAD_FOLDER, filename)

            print(f"Saving file to: {save_path}")
            file.save(save_path)
            print(f"File '{filename}' saved successfully via /upload_csv.")
            # Return success, maybe include the filename saved
            return jsonify({"message": "File uploaded successfully", "filename": filename}), 200

        except Exception as e:
            print(f"Error saving file via /upload_csv: {e}")
            return jsonify({"error": f"Could not save file: {e}"}), 500
    else:
        # This case should ideally be caught earlier by file.filename check
        print("Error: File object is invalid during /upload_csv")
        return jsonify({"error": "Invalid file object received"}), 400


# --- MODIFIED Endpoint: Renamed and expects only JSON ---
@app.route('/run_simulation', methods=['POST'])
def run_simulation():
    print("Received request for /run_simulation")

    # --- 1. Check for JSON data ---
    if not request.is_json:
        print("Error: Request is not JSON")
        return jsonify({"error": "Request must be JSON"}), 400

    try:
        simulation_input_data = request.get_json()
        print("Received Simulation Input JSON:")
        # print(json.dumps(simulation_input_data, indent=2)) # Pretty print for debugging
        # Let's make the print statement active and more descriptive
        print(f"---\nReceived JSON payload:\n{json.dumps(simulation_input_data, indent=2)}\n---")
    except Exception as e:
        print(f"Error getting JSON data: {e}")
        return jsonify({"error": f"Could not parse request JSON: {e}"}), 400

    # --- 2. Validate required fields in JSON ---
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

    # --- 3. Construct path to the already uploaded file ---
    # Use secure_filename again just to be safe, though it should match the uploaded one
    secure_name = secure_filename(filename)
    file_path = os.path.join(UPLOAD_FOLDER, secure_name)

    print(f"Attempting to use pre-uploaded file: {file_path}")

    # --- 4. Check if the file exists ---
    if not os.path.exists(file_path):
        print(f"Error: File '{secure_name}' not found in upload folder '{UPLOAD_FOLDER}'")
        # Check if the folder itself exists, might give a clue
        if not os.path.exists(UPLOAD_FOLDER):
            print(f"Underlying issue: Upload folder '{UPLOAD_FOLDER}' does not exist.")
            return jsonify({"error": f"Upload folder '{UPLOAD_FOLDER}' is missing. Cannot find file '{secure_name}'."}), 500
        else:
            return jsonify({"error": f"File '{secure_name}' not found. Please upload the file first."}), 404 # 404 Not Found seems appropriate


    # --- 5. Process the simulation using the file and config ---
    try:
        print(f"Proceeding with simulation using file '{secure_name}' and config.")
        # --- Placeholder for actual simulation logic ---
        # Here you would typically:
        # 1. Validate the simulation_input_data['config']
        # 2. Read the CSV file (file_path)
        # 3. Run your simulation logic using the file and config
        # 4. Generate the simulation results (timetable)

        # For now, just return the received config and a placeholder result
        # Replace this with actual simulation results later
        placeholder_timetable = [
            {"message": "Simulation logic not implemented yet."},
            {"using_preuploaded_file": filename},
            {"received_config": config}
        ]
        print("Returning placeholder simulation result from /run_simulation.")
        return jsonify(placeholder_timetable), 200

    except Exception as e:
        # Catch potential errors during simulation processing
        print(f"Error during simulation processing: {e}")
        return jsonify({"error": f"Error during simulation processing: {e}"}), 500


# --- get_default_settings endpoint (unchanged) ---
DEFAULT_STATIONS = [
    {"name": "North Avenue", "distance": 0.0},
    {"name": "Quezon Avenue", "distance": 1.2},
    {"name": "GMA-Kamuning", "distance": 1.1},
    {"name": "Cubao", "distance": 1.8},
    {"name": "Santolan-Annapolis", "distance": 1.5},
    {"name": "Ortigas", "distance": 1.4},
    {"name": "Shaw Boulevard", "distance": 0.9},
    {"name": "Boni Avenue", "distance": 1.0},
    {"name": "Guadalupe", "distance": 1.1},
    {"name": "Buendia", "distance": 1.3},
    {"name": "Ayala", "distance": 1.0},
    {"name": "Magallanes", "distance": 1.2},
    {"name": "Taft Avenue", "distance": 1.7},
]

DEFAULT_SETTINGS = {
    "dwellTime": 30,
    "turnaroundTime": 180,
    "acceleration": 0.8,
    "deceleration": 0.8,
    "maxSpeed": 60,
    "maxCapacity": 1182,
    "schemeType": "Regular",
    "stations": DEFAULT_STATIONS
}

@app.route('/get_default_settings', methods=['GET'])
def get_default_settings():
    print("Request received for /get_default_settings")
    try:
        # In a real app, you might load these from a file or database
        print("Returning default settings:", DEFAULT_SETTINGS)
        return jsonify(DEFAULT_SETTINGS)
    except Exception as e:
        print(f"Error fetching default settings: {e}")
        return jsonify({"error": f"Could not retrieve default settings: {e}"}), 500


if __name__ == '__main__':
    print("Starting Flask development server...")
    # Ensure debug is True for development, host='0.0.0.0' to be accessible externally if needed
    app.run(debug=True, host='0.0.0.0', port=5001) 