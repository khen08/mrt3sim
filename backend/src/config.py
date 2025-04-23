import os

# --- Default Simulation Settings ---

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
    "dwellTime": 60,
    "turnaroundTime": 180,
    "acceleration": 0.8,
    "deceleration": 0.8,
    "maxSpeed": 60,
    "maxCapacity": 1182,
    "schemeType": "Regular",#REMOVE THIS
    "stations": DEFAULT_STATIONS
}

DEFAULT_SCHEME = ['AB', 'A', 'AB', 'B', 'AB', 'A', 'AB', 'B', 'AB', 'A', 'AB', 'B', 'AB']
DEFAULT_SERVICE_PERIODS = [
    {
        'name': 'Initial',
        'train_count': 13,
        'start_hour': 5,
    },
    {
        'name': 'AM Peak',
        'train_count': 18,
        'start_hour': 7
    },
    {
        'name': 'AM Transition',
        'train_count': 16,
        'start_hour': 9
    },
    {
        'name': 'Base',
        'train_count': 14,
        'start_hour': 10
    },
    {
        'name': 'PM Transition',
        'train_count': 16,
        'start_hour': 16
    },
    {
        'name': 'PM Peak',
        'train_count': 18,
        'start_hour': 17
    },
    {
        'name': 'Service End Transition',
        'train_count': 11,
        'start_hour': 20
    }
]
DEFAULT_ZONE_LENGTH = 130 # in meters
# --- File Upload Configuration ---

# Define upload folder relative to the backend directory
# Assuming config.py is in backend/src/
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
