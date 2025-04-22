import pandas as pd
from datetime import datetime, time, timezone

from ..config import DEFAULT_SCHEME, DEFAULT_SERVICE_PERIODS
from .connect import db
class InitializeDB_Data:
    def __init__(self, file_path, config):
        self.config = config
        self.file_path = file_path
        base_date = self.get_datetime_from_csv()
        self.start_time = datetime.combine(base_date, time(hour=5, minute=0))
        self.end_time = datetime.combine(base_date, time(hour=22, minute=0))
        print(self.start_time.isoformat(), self.end_time.isoformat())
        self.save_simulation_data(scheme_type='Regular')

    def save_simulation_data(self, scheme_type):
        # Create a new simulation record and capture the returned object
        simulation_entry = db.simulations.create(
            data={
                'start_time': self.start_time,
                'end_time': self.end_time,
                'dwell_time': self.config['dwellTime'],
                'turnaround_time': self.config['turnaroundTime'],
                'scheme_type': scheme_type,
                'service_periods': DEFAULT_SERVICE_PERIODS,
                'passenger_data_file': self.file_path
            }
        )
        
        simulation_entry_id = simulation_entry.simulation_id 
        self.initialize_stations(simulation_entry_id)

    def initialize_stations(self, simulation_entry_id):
        print(simulation_entry_id)

    def initialize_track_segments(self):
        pass
    
    def initialize_trains(self):
        pass

    def initialize_train_movements(self):
        pass

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