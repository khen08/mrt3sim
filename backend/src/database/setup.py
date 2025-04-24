import pandas as pd
import numpy as np
from datetime import datetime, time, timedelta
import json
from ..config import DEFAULT_SCHEME, DEFAULT_SERVICE_PERIODS, DEFAULT_ZONE_LENGTH
from .connect import db

class InitializeDB_Data:
    def __init__(self, file_path, config):
        self.config = config
        self.file_path = file_path
        base_date = self.get_datetime_from_csv()
        if base_date:
            self.start_time = datetime.combine(base_date, time(hour=5, minute=0))
            self.end_time = datetime.combine(base_date, time(hour=22, minute=0))
        else:
            print("Error: Could not determine base date from CSV. Aborting initialization.")
            return
        
        self.regular_service = self.save_simulation_data(scheme_type='Regular')
        self.skip_stop_service = self.save_simulation_data(scheme_type='Skip-stop')
    
    def return_simulation_ids(self):
        return self.regular_service, self.skip_stop_service

    def save_simulation_data(self, scheme_type):
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
        self.initialize_track_segments(simulation_id=simulation_entry_id)
        self.initialize_train_specs(scheme_type=scheme_type, simulation_id=simulation_entry_id)
        self.initialize_passenger_demand(simulation_id=simulation_entry_id)

        return simulation_entry_id

    def initialize_stations(self, scheme_type, simulation_id):
        station_names = self.config['stationNames']
        num_stations = len(station_names)

        if scheme_type == 'Regular':
            station_types = ['AB'] * num_stations
        else:
            if len(DEFAULT_SCHEME) != num_stations:
                 print(f"Error: Mismatch between number of stations ({num_stations}) and DEFAULT_SCHEME length ({len(DEFAULT_SCHEME)}). Using 'AB' for all.")
                 station_types = ['AB'] * num_stations
            else:
                station_types = DEFAULT_SCHEME

        for station_id, (station_name, station_type) in enumerate(zip(station_names, station_types), start=1):
            db.stations.create(
                data={
                    'SIMULATION_ID': simulation_id,
                    'STATION_ID': station_id,
                    'STATION_NAME': station_name,
                    'STATION_TYPE': station_type,
                    'IS_TERMINUS': station_id == 1 or station_id == num_stations, # Terminus is first or last station
                    'ZONE_LENGTH': DEFAULT_ZONE_LENGTH
                }
            )
        
    def initialize_track_segments(self, simulation_id):
        station_distances = self.config['stationDistances']
        station_count = len(self.config['stationNames'])
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

    def initialize_train_specs(self, scheme_type, simulation_id):
        train_specs_entry = db.train_specs.create(
            data={
                'SIMULATION_ID': simulation_id,
                'SPEC_NAME': 'REGULAR TRAIN',
                'MAX_CAPACITY': self.config['maxCapacity'],
                'CRUISING_SPEED': self.config['maxSpeed'],
                'PASSTHROUGH_SPEED': 20,
                'ACCEL_RATE': self.config['acceleration'],
                'DECEL_RATE': self.config['deceleration'],
            }
        )

        train_specs_entry_id = train_specs_entry.SPEC_ID

        self.initialize_trains(scheme_type=scheme_type, spec_id=train_specs_entry_id, simulation_id=simulation_id)

    def initialize_trains(self, scheme_type, spec_id, simulation_id):
        train_count = 0
        for period in DEFAULT_SERVICE_PERIODS:
            train_count = max(train_count, period['train_count'])
        
        trains_data = []
        for train_id in range(1, train_count + 1):
            if scheme_type == "Regular":
                train_type = "AB"
            else:
                train_type = "B" if train_id % 2 == 0 else "A"

            trains_data.append({
                'SIMULATION_ID': simulation_id,
                'TRAIN_ID': train_id,
                'SERVICE_TYPE': train_type,
                'SPEC_ID': spec_id,
            })

        if trains_data:
            try:
                 db.trains.create_many(data=trains_data, skip_duplicates=True)
            except AttributeError:
                 print("create_many not available for trains, creating one by one.")
                 for data in trains_data:
                     db.trains.create(data=data)

    def initialize_passenger_demand(self, simulation_id):
        try:
            stations = db.stations.find_many(
                where = {'SIMULATION_ID': simulation_id},
            )
            if not stations:
                print(f"Error: No stations found for Simulation ID: {simulation_id}. Cannot initialize passengers.")
                return

            station_type_map = {s.STATION_ID: s.STATION_TYPE for s in stations}
            valid_station_ids = set(station_type_map.keys())
            num_stations = len(valid_station_ids)

            df = pd.read_csv(self.file_path)

            id_vars = []
            if 'DateTime' in df.columns:
                id_vars.append('DateTime')

            od_columns = [col for col in df.columns if ',' in col]

            if not id_vars:
                print("Error: 'DateTime' column not found in CSV. Cannot process passengers.")
                return
            if not od_columns:
                print("Error: No OD pair columns (e.g., '1,2') found in CSV. Cannot process passengers.")
                return

            melted_df = df.melt(
                id_vars=id_vars,
                value_vars=od_columns,
                var_name='OD_PAIR',
                value_name='PASSENGER_COUNT'
            )

            melted_df['ARRIVAL_TIME_AT_ORIGIN'] = pd.to_datetime(melted_df['DateTime'])
            melted_df = melted_df.dropna(subset=['PASSENGER_COUNT'])
            melted_df = melted_df[melted_df['PASSENGER_COUNT'] > 0]
            melted_df['PASSENGER_COUNT'] = melted_df['PASSENGER_COUNT'].astype(int)

            if melted_df.empty:
                print("Warning: No valid passenger demand found after melting and filtering.")
                return

            melted_df[['ORIGIN_STATION_ID', 'DESTINATION_STATION_ID']] = melted_df['OD_PAIR'].str.strip('"').str.split(',', expand=True).astype(int)

            invalid_origin = ~melted_df['ORIGIN_STATION_ID'].isin(valid_station_ids)
            invalid_destination = ~melted_df['DESTINATION_STATION_ID'].isin(valid_station_ids)
            invalid_rows = invalid_origin | invalid_destination

            if invalid_rows.any():
                print(f"Warning: Found {invalid_rows.sum()} rows with invalid station IDs. These rows will be skipped.")
                melted_df = melted_df[~invalid_rows]

            if melted_df.empty:
                 print("Warning: No valid passenger demand remaining after station ID validation.")
                 return

            melted_df['ORIGIN_STATION_TYPE'] = melted_df['ORIGIN_STATION_ID'].map(station_type_map)
            melted_df['DESTINATION_STATION_TYPE'] = melted_df['DESTINATION_STATION_ID'].map(station_type_map)

            melted_df['TRIP_TYPE'] = np.where(
                (melted_df['DESTINATION_STATION_TYPE'] == 'AB') |
                (melted_df['ORIGIN_STATION_TYPE'] == 'AB') |
                (melted_df['ORIGIN_STATION_TYPE'] == melted_df['DESTINATION_STATION_TYPE']),
                'DIRECT',
                'TRANSFER'
            )

            melted_df['SIMULATION_ID'] = simulation_id

            final_passenger_data = melted_df[[
                'SIMULATION_ID',
                'ARRIVAL_TIME_AT_ORIGIN',
                'ORIGIN_STATION_ID',
                'DESTINATION_STATION_ID',
                'TRIP_TYPE',
                'PASSENGER_COUNT'
            ]]

            passenger_records = final_passenger_data.to_dict('records')

            if passenger_records:
                 try:
                     db.passenger_demand.create_many(data=passenger_records, skip_duplicates=True)

                 except Exception as e:
                     print(f"Error during passenger bulk insert: {e}")
            else:
                print("No passenger records to insert.")

        except FileNotFoundError:
            print(f"Error: Passenger data file not found at '{self.file_path}'.")
        except KeyError as e:
            print(f"Error: Missing expected column in CSV: {e}")
        except Exception as e:
            print(f"An unexpected error occurred during passenger initialization: {e}")

    def get_datetime_from_csv(self):
        try:
            # Read only the first data row to get the date
            df = pd.read_csv(self.file_path, nrows=1)

            if df.empty:
                print(f"Warning: CSV file '{self.file_path}' appears to be empty or has no data rows.")
                return None

            # Check if 'DateTime' column exists
            if 'DateTime' not in df.columns:
                print(f"Error: 'DateTime' column not found in '{self.file_path}'.")
                return None

            datetime_str = df.iloc[0]['DateTime']

            if pd.isna(datetime_str):
                 print(f"Error: First row of 'DateTime' column in '{self.file_path}' is empty.")
                 return None

            try:
                # Parse the datetime string and extract the date part
                parsed_datetime = pd.to_datetime(datetime_str)
                # Return the date part as a datetime object (consistent with previous implementation)
                base_date = datetime.combine(parsed_datetime.date(), datetime.min.time())
                return base_date
            except (ValueError, TypeError) as e:
                print(f"Error: Could not parse date from DateTime value '{datetime_str}' in '{self.file_path}'. Error: {e}")
                return None

        except FileNotFoundError:
            print(f"Error: File not found at '{self.file_path}'.")
            return None
        except pd.errors.EmptyDataError:
             print(f"Error: CSV file '{self.file_path}' is empty.")
             return None
        except Exception as e:
            print(f"An unexpected error occurred while reading date from '{self.file_path}': {e}")
            return None