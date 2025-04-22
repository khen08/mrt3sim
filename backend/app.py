import os
from datetime import datetime, time
from flask import Flask, request, jsonify
from flask_cors import CORS


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
        UPLOAD_FOLDER = APP_DIR
        print(f"Warning: Upload folder creation failed. Saving CSV in app directory: {APP_DIR}")
        

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"


if __name__ == '__main__':
    print("Starting Flask development server...")
    app.run(debug=True, host='0.0.0.0', port=5001) 