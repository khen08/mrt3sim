import pandas as pd
from datetime import datetime, time, timezone
import json
from ..config import DEFAULT_SCHEME, DEFAULT_SERVICE_PERIODS
from .connect import db
class InitializeDB_Data:
    def __init__(self, file_path, config):
        self.config = config
        self.file_path = file_path
        base_date = self.get_datetime_from_csv()
        self.start_time = datetime.combine(base_date, time(hour=5, minute=0))
        self.end_time = datetime.combine(base_date, time(hour=22, minute=0))
        
        #print("\n", pd.DataFrame(config),"\n")
        self.save_simulation_data(scheme_type='Regular')
        self.save_simulation_data(scheme_type='Skip-stop')

    def save_simulation_data(self, scheme_type):
        # Create a new simulation record and capture the returned object
        simulation_entry = db.simulations.create(
            data={
                'START_TIME': self.start_time,
                'END_TIME': self.end_time,
                'DWELL_TIME': self.config['dwellTime'],
                'TURNAROUND_TIME': self.config['turnaroundTime'],
                'SCHEME_TYPE': scheme_type,
                'SERVICE_PERIODS': json.dumps(DEFAULT_SERVICE_PERIODS),
                'PASSENGER_DATA_FILE': self.file_path
            }
        )

        simulation_entry_id = simulation_entry.SIMULATION_ID 

        self.initialize_stations(scheme_type=scheme_type, simulation_id=simulation_entry_id)

    def initialize_stations(self, scheme_type, simulation_id):
        station_names = self.config['station_names']

        if scheme_type == 'Regular':
            for station_id, station in enumerate(station_names, start=1):
                db.stations.create(
                    data={
                        'SIMULATION_ID': simulation_id,
                        'STATION_ID': station_id,
                        'STATION_NAME': station,
                        'STATION_TYPE': 'AB',
                        'IS_TERMINUS': False if station_id != 1 else True
                    }
                )
        else:
            for station_id, (station, station_type) in enumerate(zip(station_names, DEFAULT_SCHEME), start=1):
                db.stations.create(
                    data={
                        'SIMULATION_ID': simulation_id,
                        'STATION_ID': station_id,
                        'STATION_NAME': station,
                        'STATION_TYPE': station_type,   
                        'IS_TERMINUS': False if station_id != 1 else True
                    }
                )
        
        self.initialize_track_segments(scheme_type=scheme_type, simulation_id=simulation_id)

    def initialize_track_segments(self, scheme_type, simulation_id):
        station_distances = self.config['station_distances']
        station_count = len(self.config['station_names'])
        # Southbound Segments
        for idx, distance in enumerate(station_distances, start=1):
            db.track_segments.create(
                data={
                    'SIMULATION_ID': simulation_id,
                    'START_STATION_ID': idx,
                    'END_STATION_ID': idx + 1,
                    'DISTANCE': distance * 1000,
                    'DIRECTION': 'southbound'
                }
                )
        
        # Northbound Segments
        for idx, distance in enumerate(reversed(station_distances)):
            db.track_segments.create(
                data={
                    'SIMULATION_ID': simulation_id,
                    'START_STATION_ID': station_count - idx,
                    'END_STATION_ID': station_count - idx - 1,
                    'DISTANCE': distance * 1000,
                    'DIRECTION': 'northbound'
                    }
                )
        
        self.initialize_train_specs(scheme_type=scheme_type, simulation_id=simulation_id)
    def initialize_train_specs(self, scheme_type, simulation_id):
        train_specs_entry = db.train_specs.create(
            data={
                'SIMULATION_ID': simulation_id,
                'SPEC_NAME': 'REGULAR TRAIN',
                'MAX_CAPACITY': self.config['maxCapacity'],
                'CRUISING_SPEED': self.config['maxSpeed'],
                'PASSTHROUGH_SPEED': 20,# fix this
                'ACCEL_RATE': self.config['acceleration'],
                'DECEL_RATE': self.config['deceleration'],
            }
        )

        train_specs_entry_id = train_specs_entry.SPEC_ID

        self.initialize_trains(scheme_type=scheme_type, spec_id=train_specs_entry_id, simulation_id=simulation_id)

    def initialize_trains(self, scheme_type, spec_id, simulation_id):
        train_count = 0
        # Get the maximum train count from the service periods
        for period in DEFAULT_SERVICE_PERIODS:
            train_count = max(train_count, period['train_count'])
        
        for train_id in range(1, train_count + 1):
            train_type = "AB" if scheme_type == "Regular" else "B" if train_id % 2 == 0 else "A"
            db.trains.create(
                data={
                    'SIMULATION_ID': simulation_id,
                    'TRAIN_ID': train_id,
                    'SERVICE_TYPE': train_type,
                    'SPEC_ID': spec_id,
                }
            )

    def initialize_passengers(self):
        pass

    def get_datetime_from_csv(self):
        try:
            # Read only the first row of data (after the header)
            df = pd.read_csv(self.file_path, nrows=1)

            # Check if the DataFrame is not empty (in case the file only had a header)
            if df.empty:
                print(f"Warning: CSV file '{self.file_path}' appears to be empty (only contains a header).")
                return None

            # Access the data from the first row
            first_row = df.iloc[0]

            # Get the year, month, and day for the first row
            # Use .get() with a default of None to handle missing columns gracefully
            year = first_row.get('Year')
            month = first_row.get('Month')
            day = first_row.get('Day')

            # Check if required columns were found
            if year is None or month is None or day is None:
                print(f"Error: Missing Year, Month, or Day column in CSV file '{self.file_path}'.")
                return None

            # Create the datetime object for the first row
            # Use errors='coerce' for robustness
            # Convert to integer first to avoid type issues with pd.to_datetime if columns have mixed types
            try:
                first_datetime = datetime(int(year), int(month), int(day))
                
            except (ValueError, TypeError):
                print(f"Error: Invalid date values in the first row of '{self.file_path}'.")
                return None


            # Check if the conversion was successful (not NaT)
            if pd.notna(first_datetime):
                return first_datetime
            else:
                print(f"Error: Could not create a valid datetime from the first row of '{self.file_path}'. Invalid date combination ({year}-{month}-{day}).")
                return None

        except FileNotFoundError:
            print(f"Error: File not found at '{self.file_path}'.")
            return None
        except Exception as e:
            print(f"An unexpected error occurred while processing '{self.file_path}': {e}")
            return None