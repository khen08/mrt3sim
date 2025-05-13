import os

# --- Default Simulation Settings ---

DEFAULT_STATIONS = [
    {"name": "North Avenue", "distance": 0.0},
    {"name": "Quezon Avenue", "distance": 1.2},
    {"name": "GMA-Kamuning", "distance": 1.1},
    {"name": "Araneta Cubao", "distance": 1.8},
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

DEFAULT_SCHEME = ['AB', 'A', 'AB', 'B', 'AB', 'A', 'AB', 'B', 'AB', 'A', 'AB', 'B', 'AB']
#SAMPLE SCHEME = ["AB", "A", "B", "A", "AB", "A", "B", "A", "B", "A", "B", "A", "AB"]
# TODO: Add more train specs
# CURRENT 3-CAR TRAINSET SPECS
DEFAULT_TRAIN_SPECS = {
    "acceleration": 0.8,
    "deceleration": 0.8,
    "cruisingSpeed": 45,
    "passthroughSpeed": 20,
    "maxCapacity": 1182,
}

DEFAULT_SERVICE_PERIODS = [
    {
        'NAME': 'MORNING',
        'REGULAR_TRAIN_COUNT': 14,
        'SKIP_STOP_TRAIN_COUNT': 11,
        'START_HOUR': 5,
    },
    {
        'NAME': 'AM PEAK',
        'REGULAR_TRAIN_COUNT': 19,
        'SKIP_STOP_TRAIN_COUNT': 14,
        'START_HOUR': 7
    },
    {
        'NAME': 'AM TRANSITION',
        'REGULAR_TRAIN_COUNT': 16,
        'SKIP_STOP_TRAIN_COUNT': 12,
        'START_HOUR': 9
    },
    {
        'NAME': 'BASE',
        'REGULAR_TRAIN_COUNT': 14,
        'SKIP_STOP_TRAIN_COUNT': 12,
        'START_HOUR': 10
    },
    {
        'NAME': 'PM TRANSITION',
        'REGULAR_TRAIN_COUNT': 16,
        'SKIP_STOP_TRAIN_COUNT': 12,
        'START_HOUR': 16
    },
    {
        'NAME': 'PM PEAK',
        'REGULAR_TRAIN_COUNT': 19,
        'SKIP_STOP_TRAIN_COUNT': 14,
        'START_HOUR': 17
    },
    {
        'NAME': 'NIGHT',
        'REGULAR_TRAIN_COUNT': 14,
        'SKIP_STOP_TRAIN_COUNT': 12,
        'START_HOUR': 19
    },
    {
        'NAME': 'SERVICE END',
        'REGULAR_TRAIN_COUNT': 4,
        'SKIP_STOP_TRAIN_COUNT': 4,
        'START_HOUR': 21
    }
]

DEFAULT_SETTINGS = {
    "dwellTime": 30,
    "turnaroundTime": 300,
    "schemeType": "REGULAR",
    "servicePeriods": DEFAULT_SERVICE_PERIODS,
    "schemePattern": DEFAULT_SCHEME,
    "stations": DEFAULT_STATIONS,
    "trainSpecs": DEFAULT_TRAIN_SPECS
}
DEFAULT_ZONE_LENGTH = 130 # in meters
# --- File Upload Configuration ---

# Define upload folder relative to the backend directory
# Assuming config.py is in backend/
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BACKEND_DIR, 'uploads')

# Ensure the upload folder exists at startup
if not os.path.exists(UPLOAD_FOLDER):
    try:
        os.makedirs(UPLOAD_FOLDER)
        print(f"Created upload folder: {UPLOAD_FOLDER}")
    except OSError as e:
        print(f"Error creating upload folder {UPLOAD_FOLDER}: {e}")
        # Handle error appropriately, maybe raise an exception or log critical error
        pass
