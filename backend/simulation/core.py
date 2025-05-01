import pandas as pd
import numpy as np
from datetime import datetime, time, timedelta
from queue import PriorityQueue
import json
import math
import time as py_time


debug = False
if not debug:
    from connect import db
else:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DEFAULT_SETTINGS, DEFAULT_SERVICE_PERIODS, DEFAULT_ZONE_LENGTH, UPLOAD_FOLDER
import traceback

# --- Helper Function for Headway Calculation ---
def custom_round(x):
    # Check if the number is exactly halfway between two integers
    if x == math.floor(x) + 0.5:
        # If halfway, round to the nearest EVEN integer (round half to even)
        # This is the standard behavior of Python's round() in Python 3
        # However, implementing explicitly for clarity or if Python 2 compatibility was needed
        floor_val = math.floor(x)
        if floor_val % 2 == 0:
            return floor_val # Round down to the even integer
        else:
            return math.ceil(x) # Round up to the even integer (which is floor + 1)
    else:
        # If not exactly halfway, round to the nearest integer
        return round(x)
# -----------------------------------------------

def instance_df(obj):
    # Extract instance variables from the object
    data = {}
    for var_name, var_value in obj.__dict__.items():
        # Convert lists/dicts/objects to string representation for DataFrame compatibility
        if isinstance(var_value, (list, dict)) or not isinstance(var_value, (int, float, str, bool, type(None))):
            data[var_name] = str(var_value)
        else:
            data[var_name] = var_value

    # Create a DataFrame - wrap values in lists for single-row DataFrame
    df_data = {k: [v] for k, v in data.items()}
    df = pd.DataFrame(df_data)

    return df

def instances_to_df(obj_list):
    all_data = []
    if not obj_list:
        return pd.DataFrame() # Return empty DataFrame if list is empty

    for obj in obj_list:
        data = {}
        for var_name, var_value in obj.__dict__.items():
            # Specific handling for known simulation object types
            if isinstance(var_value, Station):
                data[var_name] = var_value.station_id
            elif isinstance(var_value, TrackSegment):
                data[var_name] = var_value.segment_id # Assuming segment_id exists
            elif isinstance(var_value, Train):
                data[var_name] = var_value.train_id
            elif isinstance(var_value, Passenger_Demand):
                # Represent OD pair as a string for simplicity in DataFrame
                data[var_name] = f"{var_value.origin_station_id}-{var_value.destination_station_id}"
            # Handle datetime objects
            elif isinstance(var_value, datetime):
                data[var_name] = var_value.strftime('%H:%M:%S')
            # Handle lists and dictionaries by converting to string
            elif isinstance(var_value, (list, dict)):
                data[var_name] = str(var_value)
            # Handle basic types directly (int, float, str, bool, None)
            elif isinstance(var_value, (int, float, str, bool, type(None))):
                data[var_name] = var_value
            # Fallback for any other unexpected object types: convert to string
            else:
                data[var_name] = str(var_value)
        all_data.append(data)

    # Create a DataFrame from the list of dictionaries
    df = pd.DataFrame(all_data)
    return df

class TimetableEntry:
    def __init__(self,
                service_type,
                train_id,
                station_id,
                direction,
                arrival_time,
                departure_time,
                travel_time,
                passengers_boarded,
                passengers_alighted,
                current_station_passenger_count,
                current_passenger_count,
                train_status
            ):
        self.train_status = train_status
        self.train_id = train_id
        self.service_type = service_type
        self.station_id = station_id
        self.direction = direction
        self.arrival_time = arrival_time
        self.departure_time = departure_time
        self.travel_time = travel_time
        self.passengers_boarded = passengers_boarded
        self.passengers_alighted = passengers_alighted
        self.current_station_passenger_count = current_station_passenger_count
        self.current_passenger_count = current_passenger_count
        
class TrainSpec:
    def __init__(self, max_capacity, cruising_speed, passthrough_speed, accel_rate, decel_rate):
        self.max_capacity = max_capacity
        self.cruising_speed = cruising_speed
        self.passthrough_speed = passthrough_speed
        self.accel_rate = accel_rate
        self.decel_rate = decel_rate

# Entity Classes
class Passenger_Demand:
    def __init__(self, origin_station_id, destination_station_id, arrival_time, passenger_count, trip_type):
        self.origin_station_id = origin_station_id
        self.destination_station_id = destination_station_id
        self.transfer_station_id = None
        self.arrival_time = arrival_time # Arrival at origin
        self.arrival_at_transfer_time = None # Needed if calculating transfer wait time
        self.departure_from_origin_time = None
        self.departure_from_transfer_time = None # Added: Time train departed transfer station
        self.passenger_count = passenger_count
        self.trip_type = trip_type # DIRECT or TRANSFER

        # self.service_type = None # Removed - Not relevant for demand
        self.boarding_time = None # First boarding time at origin
        self.completion_time = None # Final arrival at destination
        
        self.wait_time = 0 # Calculated: departure_from_origin_time - arrival_time
        self.travel_time = 0 # Calculated: completion_time - boarding_time
        
        # More detailed status for multi-leg trips
        self.status = "waiting_at_origin" # waiting_at_origin, in_transit_leg1, waiting_for_transfer, in_transit_leg2, completed
        
        self.train_id = None # Current train ID
        self.direction = None # Direction needed for the current/next leg

    def calculate_wait_time(self):
        """Calculate the total wait time (Origin + Transfer)."""
        total_wait_seconds = 0
        # Origin Wait
        if self.departure_from_origin_time and self.arrival_time:
            total_wait_seconds += (self.departure_from_origin_time - self.arrival_time).total_seconds()
        # Transfer Wait (if applicable)
        if self.trip_type == 'TRANSFER' and self.departure_from_transfer_time and self.arrival_at_transfer_time:
            total_wait_seconds += (self.departure_from_transfer_time - self.arrival_at_transfer_time).total_seconds()
        
        self.wait_time = total_wait_seconds if total_wait_seconds >= 0 else 0 # Store the sum

    def calculate_travel_time(self):
        """Calculate the total time spent physically moving on trains."""
        total_travel_seconds = 0
        # Direct trip travel time
        if self.trip_type == 'DIRECT' and self.completion_time and self.boarding_time:
            total_travel_seconds = (self.completion_time - self.boarding_time).total_seconds()
        # Transfer trip travel time (sum of legs)
        elif self.trip_type == 'TRANSFER':
            leg1_travel_seconds = 0
            leg2_travel_seconds = 0
            # Leg 1: Boarding at origin to Arrival at transfer
            if self.arrival_at_transfer_time and self.boarding_time:
                leg1_travel_seconds = (self.arrival_at_transfer_time - self.boarding_time).total_seconds()
            # Leg 2: Departure from transfer to Arrival at destination
            if self.completion_time and self.departure_from_transfer_time:
                leg2_travel_seconds = (self.completion_time - self.departure_from_transfer_time).total_seconds()
            
            total_travel_seconds = leg1_travel_seconds + leg2_travel_seconds

        self.travel_time = total_travel_seconds if total_travel_seconds >= 0 else 0 # Store the sum

    def find_nearest_transfer(self, stations):
        origin = next((s for s in stations if s.station_id == self.origin_station_id), None)
        destination = next((s for s in stations if s.station_id == self.destination_station_id), None)
        
        if not origin or not destination:
            return None
        
        transfer_candidates = [s for s in stations if s.station_type == "AB"]
        
        if not transfer_candidates:
            return None
        
        min_total = float('inf')
        best_transfer = None
        
        for candidate in transfer_candidates:
            dist_origin = abs(origin.station_id - candidate.station_id)
            dist_dest = abs(destination.station_id - candidate.station_id)
            total = dist_origin + dist_dest
            
            if total < min_total:
                min_total = total
                best_transfer = candidate
            elif total == min_total:
                # Tiebreaker: choose the one closer to the origin
                if dist_origin < abs(origin.station_id - best_transfer.station_id):
                    best_transfer = candidate
        
        return best_transfer.station_id
        
class Station:
    def __init__(self, station_id, name, zone_length=None,  station_type="AB", is_terminus=False):
        self.station_id = station_id
        self.name = name
        self.zone_length = zone_length
        self.station_type = station_type
        self.waiting_demand = []

        #undocumented
        self.is_terminus = is_terminus
        # Adjacent tracks towards next station
        self.tracks = {"northbound": None, "southbound": None}
        # Station Platforms
        self.platforms = {"northbound": None, "southbound": None}

    def process_passenger_exchange(self, scheme_map, train, train_arrival_time, train_departure_time):
        """Board and Alight passenger demand groups, handling transfers."""
        
        passengers_alighted_count = 0
        passengers_boarded_count = 0
        
        # --- Alight Passengers --- #        
        for demand in train.boarded_demand[:]: 
            alight_here = False
            # Case 1: Direct trip arrives at final destination
            if demand.trip_type == 'DIRECT' and demand.destination_station_id == self.station_id:
                alight_here = True
                demand.status = "completed"
                demand.completion_time = train_arrival_time
                demand.calculate_travel_time() 
            # Case 2: Transfer trip arrives at transfer station
            elif demand.trip_type == 'TRANSFER' and demand.transfer_station_id == self.station_id and demand.status == "in_transit_leg1":
                alight_here = True
                demand.status = "waiting_for_transfer"
                demand.arrival_at_transfer_time = train_arrival_time
                demand.direction = 'southbound' if demand.destination_station_id > demand.transfer_station_id else 'northbound'
                demand.train_id = None 
                self.waiting_demand.append(demand) 
            # Case 3: Transfer trip arrives at final destination (after leg 2)
            elif demand.trip_type == 'TRANSFER' and demand.destination_station_id == self.station_id and demand.status == "in_transit_leg2":
                alight_here = True
                demand.status = "completed"
                demand.completion_time = train_arrival_time
                demand.calculate_travel_time() 

            if alight_here:
                passengers_alighted_count += demand.passenger_count
                train.current_passenger_count -= demand.passenger_count
                train.boarded_demand.remove(demand)
        
        # --- Board Passengers --- #        
        for demand in self.waiting_demand[:]: 
            board_this_train = False
            can_train_stop_here = (train.service_type == self.station_type or train.service_type == "AB" or self.station_type == "AB")
            
            if not can_train_stop_here:
                continue # Train doesn't stop here, skip to next demand

            # Condition 1: Passenger group waiting for their first train
            if demand.status == "waiting_at_origin" and demand.arrival_time <= train_departure_time:
                if demand.direction == train.direction:
                    # Check if train serves the *next required stop* (transfer or destination)
                    next_stop_id = demand.transfer_station_id if demand.trip_type == 'TRANSFER' else demand.destination_station_id
                    next_stop_type = scheme_map.get(next_stop_id)
                    if next_stop_type is None:
                        print(f"Warning: Could not find station type for next stop {next_stop_id} in scheme map.")
                    else:
                        can_train_reach_next_stop = (train.service_type == next_stop_type or train.service_type == "AB" or next_stop_type == "AB")
                        if can_train_reach_next_stop:
                            board_this_train = True

            # Condition 2: Passenger group waiting for transfer
            elif demand.status == "waiting_for_transfer" and demand.arrival_at_transfer_time <= train_departure_time:
                if demand.direction == train.direction: # Direction should already be set for leg 2
                    # Check train service is compatible with *final destination* station type
                    dest_station_type = scheme_map.get(demand.destination_station_id)
                    if dest_station_type is None:
                        print(f"Warning: Could not find station type for destination {demand.destination_station_id} in scheme map.")
                    else:
                        can_train_reach_final_dest = (train.service_type == dest_station_type or train.service_type == "AB" or dest_station_type == "AB")
                        if can_train_reach_final_dest:
                            board_this_train = True

            # Perform boarding if compatible and space available
            if board_this_train:
                available_space = train.capacity - train.current_passenger_count
                if available_space <= 0:
                    break # No more space on this train                 
                num_to_board = min(available_space, demand.passenger_count)
                
                if num_to_board > 0:
                    if num_to_board == demand.passenger_count: # Full group boards                       
                        self.waiting_demand.remove(demand)                         
                        if demand.status == "waiting_at_origin":
                            demand.boarding_time = train_arrival_time 
                            demand.departure_from_origin_time = train_departure_time
                            demand.calculate_wait_time()
                            demand.status = "in_transit_leg1"
                        elif demand.status == "waiting_for_transfer":
                            # Don't overwrite original boarding_time for travel calc
                            demand.status = "in_transit_leg2"
                            demand.departure_from_transfer_time = train_departure_time # Set departure time from transfer
                        
                        demand.train_id = train.train_id
                        train.boarded_demand.append(demand)
                        
                        passengers_boarded_count += num_to_board
                        train.current_passenger_count += num_to_board
                    else:
                        # TODO: Implement partial boarding logic if needed
                        # Create a new demand object for the boarded portion
                        # Reduce the count of the original demand object
                        pass 
                        
        return passengers_alighted_count, passengers_boarded_count

    def should_stop(self, train):
        """Determine if the train should stop at this station based on service type."""
        return self.station_type == train.service_type or self.station_type == "AB"

    def get_next_segment(self, direction):
        """Returns None if at terminus or segment missing."""
        return self.tracks.get(direction)

class TrackSegment:
    def __init__(self, start_station_id, end_station_id, distance, direction):
        """
        Initialize a Track Segment
        
        Args:
            start_station_id (int):         ID of starting station
            end_station_id (int):           ID of ending station
            distance (float):               Length of segment in km 
            min_headway (timedelta):            Minimum time between trains (in minutes)

        Attributes: 
            occupied_by (Train()):          Train currently on the segment
            last_exit_time (datetime):      Time when the last train exited
        """
        
        self.segment_id = start_station_id, end_station_id
        self.start_station_id = start_station_id
        self.end_station_id = end_station_id
        self.distance = distance
        
        self.direction = direction
        self.occupied_by = None
        
        self.last_entry_time = None ####
        self.last_exit_time = None ####
        self.next_available = None ####
        
    def is_available(self):
        """Check if the segment is free to enter."""
        # Logic to check if the segment is available (e.g., no train is on it)
        return self.occupied_by is None

    def enter(self, train, time):
        """Mark the segment as occupied."""
        if self.occupied_by is None:
            self.last_entry_time = time
            self.occupied_by = train
            return True
        return False

    def exit(self, train, time):
        """Mark the segment as unoccupied."""
        if self.occupied_by == train:
            self.last_exit_time = time 
            self.occupied_by = None
            return True
        return False

    def calculate_traversal_time(self, train, next_station_stops, segment_distance):
            """
            Calculate the traversal time based on the current speed and the action needed for the upcoming stop.
            """
            accel_rate = train.accel_rate
            decel_rate = train.decel_rate
            cruising_speed = train.cruising_speed
            passthrough_speed = train.passthrough_speed
            current_speed = train.current_speed

            # If we need to stop, calculate decel and stop, then accel and cruise
            if next_station_stops:
                # Decelerate to a stop
                decel_time = (current_speed) / decel_rate
                decel_distance = 0.5 * decel_rate * decel_time**2
                
                # If the deceleration is longer than the segment, then this calculation is wrong
                if decel_distance > segment_distance:
                    decel_distance = segment_distance
                
                remaining_distance = segment_distance - decel_distance

                # Now we know that we are standing still, so start accelerating
                accel_time = (cruising_speed) / accel_rate
                accel_distance = 0.5 * accel_rate * accel_time**2

                # Cruise at max speed for rest of way or until max speed is reached
                remaining_distance -= accel_distance
                if remaining_distance > 0:
                    cruise_time = remaining_distance / cruising_speed
                else:
                    cruise_time = 0

                total_time = decel_time + accel_time + cruise_time

                # If successful, save the speed
                train.current_speed = 0 # Since we want to make it standstill.
                
            # Otherwise just calculate the pass through math and save the passthrough speed
            else:
                zone_length = 130 #meter
                decel_time = (current_speed - passthrough_speed) / decel_rate
                zone_time = zone_length / passthrough_speed
                accel_time = (cruising_speed - passthrough_speed) / accel_rate

                # Check that the accel_distance is actually possible
                accel_distance = 0.5 * accel_rate * accel_time**2
                remaining_distance = segment_distance - accel_distance

                # Cruise at max speed for rest of way or until max speed is reached
                if remaining_distance > 0:
                    cruise_time = remaining_distance / cruising_speed
                else:
                    cruise_time = 0
                total_time = decel_time + zone_time + accel_time + cruise_time

                train.current_speed = passthrough_speed
            
            if self.last_entry_time:
                self.next_available = self.last_entry_time + timedelta(seconds=total_time)
            
            return int(total_time)
    
class Train:
    def __init__(self, train_id, train_specs, service_type="AB", current_station=None):
        self.train_id = train_id
        # Train Specifications
        self.capacity = train_specs.max_capacity
        # Speed Conversion from km/h to m/s
        self.cruising_speed = train_specs.cruising_speed * (1000 / 3600)
        self.passthrough_speed = train_specs.passthrough_speed * (1000 / 3600)

        self.accel_rate = train_specs.accel_rate # in m/s
        self.decel_rate = train_specs.decel_rate # in m/s
        
        self.accel_time = self.cruising_speed / self.accel_rate
        self.decel_time = self.cruising_speed / self.decel_rate
        
        self.accel_distance = 0.5 * self.accel_rate * self.accel_time**2
        self.decel_distance = 0.5 * self.decel_rate * self.decel_time**2
        
        self.current_speed = 0.0
        
        self.service_type = service_type
        self.boarded_demand = [] # Renamed from self.passengers
        self.current_passenger_count = 0 # Added
        
        self.direction = "southbound"
        self.current_station = current_station
        self.is_active = True
        self.loop_count = 0
        
        self.arrival_time = None
        self.last_departure_time = None
        self.current_journey_travel_time = 0

    def board_passengers(self, boarding_passengers):
        """Add passengers to the train."""
        if self.current_passenger_count + len(boarding_passengers) <= self.capacity:
            # This needs rethinking if boarding_passengers becomes demand objects
            self.boarded_demand.extend(boarding_passengers) # Placeholder
            self.current_passenger_count += len(boarding_passengers) # Placeholder
        else:
            # Logic for handling overcapacity (e.g., leave some passengers behind)
            pass

    def alight_passengers(self, station):
        """Remove passengers whose destination is the current station."""
        # This logic will move to process_passenger_exchange
        pass
    
    def change_direction(self):
        """Reverse the train's direction."""
        self.direction = "southbound" if self.direction == "northbound" else "northbound"

    def calculate_load_factor(self):
        """Calculate the current occupancy percentage."""
        if self.capacity == 0: return 0 # Avoid division by zero
        return (self.current_passenger_count / self.capacity * 100)

class Event:
    def __init__(self, time, event_type, period=None, train=None, station=None, segment=None):
        self.time = time
        self.event_type = event_type
        self.train = train
        self.station = station
        self.segment = segment
        self.period = period

    def __lt__(self, other):
        """Comparison for priority queue (earlier events have higher priority)."""
        if self.time != other.time:
            return self.time < other.time
            
        # Times are equal, apply secondary sort based on event type priority
        # Lower number means higher priority (processed first)
        priority_map = {
            "service_period_change": 0,  # Highest priority - handle period changes first
            "train_departure": 1,        # High priority - let trains depart stations
            "segment_exit": 2,           # Let trains exit segments before new ones enter
            "train_arrival": 3,          # Prioritize arrivals over segment entries
            "turnaround": 4,             # Make turnaround higher priority than segment_enter
            "segment_enter": 5,          # Lower priority for new trains entering segments
            "train_insertion": 6,        # Lowest priority - only insert new trains after other operations
        }
        
        # Use a large default for unknown types
        self_priority = priority_map.get(self.event_type, 99)
        other_priority = priority_map.get(other.event_type, 99)
        
        return self_priority < other_priority
    
class EventHandler:
    def __init__(self, simulation):
        self.simulation = simulation

    def process_event(self, event):
        """Process an event and generate follow-up events.""" 
        if event.event_type == "train_arrival":
            self._handle_arrival(event)
        elif event.event_type == "train_departure":
            self._handle_departure(event)
        elif event.event_type == "segment_enter":
            self._handle_segment_enter(event)
        elif event.event_type == "segment_exit":
            self._handle_segment_exit(event)
        elif event.event_type == "turnaround":
            self._handle_turnaround(event)
        elif event.event_type == "service_period_change":
            self._handle_service_period_change(event)
        elif event.event_type == "train_insertion":
            self._handle_insertion(event)
    
    def _handle_service_period_change(self, event):
        """Adjust the number of active trains based on the service period."""
        # Immediately activate the new period's headway
        self.simulation.active_headway = event.period[f"{self.simulation.scheme_type}_HEADWAY"]#
        period = event.period
        trains = self.simulation.trains
        active_trains = self.simulation.active_trains
        target_train_count = period['TRAIN_COUNT']
        current_active_count = len(active_trains)
        
        # Deploy trains if needed
        if current_active_count < target_train_count:
            trains_to_deploy = min(
                target_train_count - current_active_count,
                len(trains) - current_active_count,
            )  # Check for number of available trains to deploy.
            available_trains = [
                train for train in trains if train not in active_trains
            ]  # Get reference to trains to deploy.
            
            # Use our congestion metrics to determine optimal scheduling
            metrics = self._calculate_system_congestion_metrics()
            headway_multiplier = metrics["recommended_headway_multiplier"]
            
            # Add initial buffer delay before inserting first train to let existing traffic flow
            initial_delay = timedelta(minutes=max(2.0, self.simulation.active_headway * 0.5))
            
            # Schedule departure event for trains with adaptive headway, starting after initial delay
            departure_time = event.time + initial_delay
            
            #print(f"[SERVICE PERIOD CHANGE] Deploying {trains_to_deploy} trains for period: {period['name']}")
            #print(f"System metrics: Segment congestion: {metrics['segment_congestion']:.2f}")
            #print(f"Using headway multiplier: {headway_multiplier:.2f}x (Base headway: {self.simulation.active_headway}min)")
            #print(f"Initial insertion delay: {initial_delay.total_seconds()/60:.1f} minutes")
            
            # Distribute insertions more evenly across a longer timespan to reduce congestion
            # Calculate an appropriate spread factor based on how many trains we're adding
            spread_factor = 1.2 if trains_to_deploy <= 3 else 1.5
            
            for i in range(trains_to_deploy):
                train = available_trains[i]  # get train to deploy
                train.is_active = True  # Explicitly mark train as active
                active_trains.append(train)  # add train to active list
                train.current_speed = train.cruising_speed
                
                # Schedule the insertion event
                self.simulation.schedule_event(
                    Event(
                        time=departure_time,
                        event_type="train_insertion",
                        train=train,
                        segment=self.simulation.get_segment_by_id((2,1))
                    )
                )
                
                # Log the scheduled insertion
                #print(f"[ADAPTIVE DEPLOYMENT] Scheduled Train {train.train_id} insertion at {departure_time}")
                
                # Get segment (2,1) current state for monitoring
                insertion_segment = self.simulation.get_segment_by_id((2,1))
                segment_status = "Available" if insertion_segment.is_available() else f"Occupied by Train {insertion_segment.occupied_by.train_id}"
                #print(f"Insertion segment status: {segment_status}")
                
                # Increment departure time by adaptive headway with spreading
                adaptive_headway = self.simulation.active_headway * headway_multiplier * spread_factor
                departure_time += timedelta(minutes=adaptive_headway)
                
                # Add more spacing between insertions as we add more trains
                if i > 0 and i % 3 == 0:
                    # Add extra buffer every few trains
                    buffer_minutes = self.simulation.active_headway * 0.5
                    departure_time += timedelta(minutes=buffer_minutes)
                    #print(f"Adding extra {buffer_minutes:.1f} minute buffer after Train {train.train_id}")
                
                # After scheduling each train, recalculate metrics as the system state will change
                if i < trains_to_deploy - 1:  # No need to recalculate after the last train
                    metrics = self._calculate_system_congestion_metrics()
                    headway_multiplier = metrics["recommended_headway_multiplier"]
                
        # Withdraw trains if needed
        elif current_active_count > target_train_count:
            trains_to_withdraw = current_active_count - target_train_count
            self.simulation.trains_to_withdraw_count = trains_to_withdraw
            #print(f"[SERVICE PERIOD CHANGE] Need to withdraw {trains_to_withdraw} trains for period: {period['name']}")
            # Actual withdrawal logic is handled in _handle_arrival for Station 1 northbound arrivals.
        
    def _record_timetable_entry(self, train, station, arrival_time, departure_time, 
                                travel_time, train_status, boarded=0, alighted=0):
            """Centralized method to log timetable entries."""
            entry = TimetableEntry(
                service_type=train.service_type,
                train_id= train.train_id,
                station_id = station.station_id,
                arrival_time = arrival_time,
                departure_time = departure_time,
                travel_time = travel_time,
                direction = train.direction,
                passengers_boarded = boarded,
                passengers_alighted = alighted,
                current_station_passenger_count = sum(demand.passenger_count for demand in station.waiting_demand if demand.arrival_time <= departure_time),
                current_passenger_count = train.current_passenger_count,
                train_status=train_status
            )
            self.simulation.timetables.append(entry)

    def _handle_arrival(self, event):
        train = event.train
        station = event.station
        arrival_time = event.time
        
        # === WITHDRAWAL CHECK (Upon Northbound Arrival at Station 1) === #
        if (self.simulation.trains_to_withdraw_count > 0 and
            station == self.simulation.stations[0] and # Station 1 (North Ave)
            train.direction == "northbound"):
            
            # Calculate end time including final dwell
            end_of_service_time = arrival_time + timedelta(seconds=self.simulation.dwell_time)

            # Remove train from active list FIRST
            if train in self.simulation.active_trains:
                self.simulation.active_trains.remove(train)
                train.is_active = False # Set the train's flag to inactive
                # Decrement withdrawal counter
                self.simulation.trains_to_withdraw_count -= 1

                #======= BOARD/ALIGHT PASSENGERS =======#
                alighted, boarded = station.process_passenger_exchange(
                    scheme_map=self.simulation.station_type_map, # Pass the map
                    train=train, 
                    train_arrival_time=train.arrival_time, 
                    train_departure_time=end_of_service_time
                )

                # Record final arrival with departure time reflecting end of dwell
                self._record_timetable_entry(
                    train=train, 
                    station=station, 
                    arrival_time=arrival_time, # Actual arrival time
                    departure_time=end_of_service_time, # Time after final dwell
                    travel_time=train.current_journey_travel_time, # Log final travel time
                    train_status="inactive", # Set status to inactive
                    boarded=boarded,
                    alighted=alighted
                )
                # Clear the platform the train arrived on
                station.platforms[train.direction] = None
            else:
                print(f"WARNING: Train {train.train_id} was targeted for withdrawal upon arrival but not found in active_trains list.")
            
            # DO NOT schedule next event (turnaround/departure) for this train.
            return # Add this return statement
        
        # === END WITHDRAWAL CHECK ===
        
        # --- Normal Arrival Processing ---
        if self.simulation.scheme_type == "REGULAR":
            # Calculate departure time based on dwell time
            departure_time = arrival_time + timedelta(seconds=self.simulation.dwell_time)
        else:
            # For Skip-stop schemes, we need to check if the train should stop at the station
            if not station.should_stop(train):
                # Train should not stop, so we can schedule a departure immediately
                departure_time = arrival_time
            else:
                # Train should stop, so we need to schedule a dwell event
                departure_time = arrival_time + timedelta(seconds=self.simulation.dwell_time)
        
        train.current_station = station
        
        # Occupy Current Station
        station.platforms[train.direction] = train
        
        if station.is_terminus:
            # Schedule turnaround event
            #print(f"\n[ARRIVAL] Train {train.train_id} arrived at terminus Station {station.station_id} ({station.name}) at {arrival_time}")
            #print(f"[ARRIVAL] Current direction: {train.direction}, scheduling turnaround event for {departure_time}")
            
            self.simulation.schedule_event(
                Event(
                    time=departure_time,
                    event_type="turnaround",
                    train=train,
                    station=station
                )
            )
            
            # Add extra debug to verify station is marked as terminus
            #print(f"[ARRIVAL] Confirming Station {station.station_id} is_terminus={station.is_terminus}")
        else:
            # Schedule departure event
            self.simulation.schedule_event(
                Event(
                    time=departure_time,
                    event_type="train_departure",
                    train=train,
                    station=station
                )
            )
    
    def _handle_insertion(self, event):
        train = event.train
        segment = event.segment
        current_time = event.time

        # Get system congestion metrics to guide insertion decisions
        metrics = self._calculate_system_congestion_metrics()
        headway_multiplier = metrics["recommended_headway_multiplier"]
        
        # Apply the recommended headway multiplier
        adaptive_headway = self.simulation.active_headway * headway_multiplier

        # --- Check for Segment Enter Conflict ---
        # Find if another train is scheduled to ENTER the same segment at the same time
        conflicting_segment_enter_event = self.simulation.get_event_by_type(
            "segment_enter",
            segment=segment
        )

        if conflicting_segment_enter_event and conflicting_segment_enter_event.time == event.time:
            # CONFLICT DETECTED: Another train wants to enter the segment simultaneously.
            
            # Apply the adaptive headway based on system metrics
            reschedule_time = event.time + timedelta(minutes=adaptive_headway)
            
            #print(f"\n[ADAPTIVE INSERTION] Train {train.train_id} insertion at {event.time} conflicts with Train {conflicting_segment_enter_event.train.train_id}.")
            #print(f"System metrics: Segment congestion: {metrics['segment_congestion']:.2f}, Upcoming arrivals: {metrics['upcoming_arrivals_station1']}")
            #print(f"Using headway multiplier: {headway_multiplier:.2f} × {self.simulation.active_headway}min = {adaptive_headway:.2f}min")
            #print(f"Rescheduling to {reschedule_time}")
            
            self.simulation.schedule_event(
                Event(
                    time=reschedule_time,
                    event_type="train_insertion",
                    train=train,
                    segment=segment
                )
            )
            return # Stop processing this event now

        # --- End Conflict Check ---

        # --- Check Track System Load ---
        # Look ahead to analyze the current system state
        station1 = self.simulation.get_station_by_id(1)
        
        # Check if station 1 northbound platform is available
        if station1.platforms.get("northbound") is not None:
            # Platform is occupied - find when it will be free
            departure_events = [e for _, e in self.simulation.event_queue.queue 
                                if e.event_type == "train_departure" and 
                                e.station == station1 and 
                                e.train.direction == "northbound"]
            
            if departure_events:
                # Get the earliest departure time
                next_departure = min(departure_events, key=lambda e: e.time)
                # Schedule after this departure with sufficient buffer
                buffer_time = timedelta(seconds=30)
                
                # Add additional buffer based on congestion
                if metrics["segment_congestion"] > 0.5:
                    buffer_time = timedelta(seconds=60)  # Longer buffer when congested
                
                required_time = next_departure.time + buffer_time
                
                if required_time > current_time:
                    #print(f"[ADAPTIVE INSERTION] Station 1 northbound platform occupied until {next_departure.time}.")
                    #print(f"System metrics: Segment congestion: {metrics['segment_congestion']:.2f}, Buffer: {buffer_time.total_seconds()}s")
                    #print(f"Rescheduling Train {train.train_id} insertion to {required_time}")
                    
                    self.simulation.schedule_event(
                        Event(
                            time=required_time,
                            event_type="train_insertion",
                            train=train,
                            segment=segment
                        )
                    )
                    return
        
        # Check if the train is still active before proceeding
        train.status = "insertion"
        train.direction = "northbound"  # Ensure train direction is northbound for insertion

        if segment.enter(train, event.time):
            # Train successfully entered segment (2,1)
            # Calculate arrival time at Station 1 (fixed 1 minute traversal time)
            arrival_time = event.time + timedelta(minutes=1)
            
            # Schedule segment exit/train arrival event at Station 1
            next_station = self.simulation.get_station_by_id(1)  # Station 1 (northbound)

            # Update last departure time from insertion rail
            train.last_departure_time = event.time
            
            # Track the train's journey
            train.current_journey_travel_time = 60  # 1 minute in seconds
            train.arrival_time = arrival_time
            
            # Add debug info with system metrics
            #print(f"[INSERTION SUCCESS] Train {train.train_id} inserted at {event.time}, ETA at Station 1: {arrival_time}")
            #print(f"Current system metrics: Active trains: {metrics['active_trains']}, Segment congestion: {metrics['segment_congestion']:.2f}")
            
            # Schedule segment exit event (which will then trigger arrival)
            self.simulation.schedule_event(
                Event(
                    time=arrival_time,
                    event_type="segment_exit",
                    train=train,
                    station=next_station,
                    segment=segment
                )
            )
        else:
            # Track segment is occupied, need to reschedule insertion
            # Use adaptive rescheduling based on current system state
            
            # Prioritize waiting for this specific segment to clear first
            conflicting_exit_event = self.simulation.get_event_by_type("segment_exit", segment=segment)
            if conflicting_exit_event and conflicting_exit_event.train:
                exit_time = conflicting_exit_event.time
                #print(f"Segment {segment.segment_id} expected to be cleared by Train {conflicting_exit_event.train.train_id} at {exit_time}")
                
                # Apply adaptive headway using system metrics
                buffer_time = timedelta(minutes=adaptive_headway)
                required_insertion_time = exit_time + buffer_time
                
                #print(f"[ADAPTIVE INSERTION] System metrics: Congestion: {metrics['segment_congestion']:.2f}, Headway multiplier: {headway_multiplier:.2f}")
                #print(f"Using adaptive headway: {adaptive_headway:.2f} minutes ({headway_multiplier:.2f} × {self.simulation.active_headway}min)")
                #print(f"Rescheduling Train {train.train_id} insertion to {required_insertion_time}")
                
                # Reschedule the insertion event with the calculated time
                self.simulation.schedule_event(
                    Event(
                        time=required_insertion_time,
                        event_type="train_insertion",
                        train=train,
                        segment=segment
                    )
                )
            else:
                # If no exit event is found but segment is still occupied
                #print(f"Segment {segment.segment_id} occupied, but no exit event found in queue.")
                # Use adaptive headway for reschedule
                fallback_time = event.time + timedelta(minutes=adaptive_headway)
                required_insertion_time = fallback_time  # Define the variable for the safety check below
                #print(f"[FALLBACK] Using adaptive headway: {adaptive_headway:.2f}min")
                #print(f"Rescheduling Train {train.train_id} insertion to {fallback_time}")
                
                self.simulation.schedule_event(
                    Event(
                        time=fallback_time,
                        event_type="train_insertion",
                        train=train,
                        segment=segment
                    )
                )

            # Safety check to prevent infinite loops - only run if we rescheduled with same timestamp
            try:
                if 'required_insertion_time' in locals() and event.time == required_insertion_time:
                    #print("\n[INSERTION] DEBUG: POTENTIAL LOOP DETECTED")
                    #print(f"Event Time: {event.time}")
                    #print(f"Required Insertion Time: {required_insertion_time}")
                    #print(f"Train ID: {train.train_id}")
                    #print(f"Segment ID: {segment.segment_id}")
                    
                    # Reset the simulation event queue
                    #print("Resetting event queue to prevent infinite loop.")
                    self.simulation.event_queue = PriorityQueue()
            except Exception as e:
                print(f"Error in insertion safety check: {str(e)}")
                # Continue normally even if there was an error in the safety check
        
    def _handle_departure(self, event):
        train = event.train
        station = event.station
        alighted = 0
        boarded = 0
        
        # Check if the train is still active before proceeding
        if not train.is_active: # Check the train's own flag
            return # Ignore event for inactive train
        
        next_station = self.simulation.get_station_by_id(station.station_id + 1) if train.direction == "southbound" else self.simulation.get_station_by_id(station.station_id - 1)
        departure_time = event.time
        next_segment = station.get_next_segment(train.direction)
        
        # Check for resource availability
        if next_station.platforms[train.direction] is None and next_segment.is_available():
            #======= TRAVEL TIME =======#
            travel_time = train.current_journey_travel_time
            train.status = "active"
            
            #======= BOARD/ALIGHT PASSENGERS =======#
            # For skip-stop schemes, we need to check if the train should stop at the station
            if station.should_stop(train):
                alighted, boarded = station.process_passenger_exchange(
                    scheme_map=self.simulation.station_type_map, # Pass the map
                    train=train, 
                    train_arrival_time=train.arrival_time, 
                    train_departure_time=departure_time
                )
            
            #======= RECORD TO TIMETABLE =======#
            self._record_timetable_entry(
                train=train, 
                station=station, 
                arrival_time = train.arrival_time,
                departure_time = departure_time, 
                travel_time=travel_time, # Use calculated travel_time
                train_status=train.status,
                boarded=boarded, 
                alighted=alighted
            )
            
            # Update Train and Station Properties
            train.last_departure_time = departure_time
            train.current_journey_travel_time = 0
            station.platforms[train.direction] = None
            
            self.simulation.schedule_event(
                Event(
                    time = departure_time,
                    event_type = "segment_enter",
                    train = train,
                    station = next_station,
                    segment = next_segment
                )
            )
            
        else: # Resources are not available
            # Use our adaptive scheduling system to calculate a better departure time
            # Apply adaptive scheduling to avoid traffic jams
            metrics = self._calculate_system_congestion_metrics()
            
            # Calculate the earliest required departure time based on conflicts and system state
            required_departure_time = event.time # Start with the original scheduled time
            
            # Use adaptive buffer time based on system congestion - use a smaller buffer for normal operations
            base_buffer = 5 # seconds - reduced from 10 to 5
            if metrics["segment_congestion"] > 0.6:
                buffer_factor = 2.0  # Reduced from 3.0 to 2.0
            elif metrics["segment_congestion"] > 0.4:
                buffer_factor = 1.5  # Reduced from 2.0 to 1.5
            else:
                buffer_factor = 1.0  # Normal buffer in low congestion
                
            buffer_time_conflict = timedelta(seconds=base_buffer * buffer_factor) 
            
            # Check and log segment conflict details for debugging
            segment_conflict_found = False
            if next_segment.occupied_by is not None:
                segment_conflict_found = True
                #print(f"\n[DEPARTURE CONFLICT] Train {train.train_id} at Station {station.station_id} cannot depart at {event.time}")
                #print(f"Segment {next_segment.segment_id} is occupied by Train {next_segment.occupied_by.train_id}")
                
                # Get the segment exit event for the occupying train
                segment_exit_events = [e for _, e in self.simulation.event_queue.queue 
                                        if e.event_type == "segment_exit" and 
                                            e.segment == next_segment and
                                            e.train == next_segment.occupied_by]
                
                if segment_exit_events:
                    earliest_exit = min(segment_exit_events, key=lambda e: e.time)
                    # Use minimal buffer for departures to reduce station dwell time
                    segment_clear_time = earliest_exit.time + buffer_time_conflict
                    #print(f"Segment will be clear at {earliest_exit.time}, scheduling after {segment_clear_time}")
                    required_departure_time = max(required_departure_time, segment_clear_time)
                else:
                    # Fallback if no exit event found (unusual but possible)
                    # Use smaller headway multiplier for departures than for insertions
                    departure_headway_multiplier = max(1.0, metrics["recommended_headway_multiplier"] * 0.8)
                    fallback_clear_time = event.time + timedelta(minutes=self.simulation.active_headway * departure_headway_multiplier)
                    #print(f"No segment exit event found. Using reduced adaptive headway: {self.simulation.active_headway * departure_headway_multiplier:.2f}min")
                    #print(f"Fallback clear time: {fallback_clear_time}")
                    required_departure_time = max(required_departure_time, fallback_clear_time)

            # Check platform conflict at the NEXT station
            platform_conflict_found = False
            if next_station.platforms[train.direction] is not None:
                platform_conflict_found = True
                preceding_train = next_station.platforms[train.direction]
                #print(f"Platform at Station {next_station.station_id} is occupied by Train {preceding_train.train_id}")
                
                # Look for departure events for the occupying train
                platform_clear_events = [e for _, e in self.simulation.event_queue.queue 
                                        if e.event_type == "train_departure" and 
                                            e.station == next_station and
                                            e.train == preceding_train]
                
                if platform_clear_events:
                    earliest_departure = min(platform_clear_events, key=lambda e: e.time)
                    platform_clear_time = earliest_departure.time + buffer_time_conflict
                    #print(f"Platform will be clear after train departs at {earliest_departure.time}, scheduling after {platform_clear_time}")
                    required_departure_time = max(required_departure_time, platform_clear_time)
                else:
                    # Fallback if no departure event found - use a smaller multiplier for departures
                    departure_headway_multiplier = max(1.0, metrics["recommended_headway_multiplier"] * 0.8)
                    fallback_clear_time = event.time + timedelta(minutes=self.simulation.active_headway * departure_headway_multiplier)
                    #print(f"No platform departure event found. Using reduced adaptive headway: {fallback_clear_time}")
                    required_departure_time = max(required_departure_time, fallback_clear_time)

            # Check for simultaneous departure conflicts at the CURRENT station
            final_departure_time = required_departure_time
            
            # Avoid exact timestamp conflicts by adding small time offsets if needed
            existing_departure_times = set()
            for _, existing_event in self.simulation.event_queue.queue:
                if (existing_event.event_type == "train_departure" and 
                        existing_event.station == station and
                        existing_event.train != train):
                    existing_departure_times.add(existing_event.time)
            
            # If our calculated time conflicts with an existing departure, add a small offset
            while final_departure_time in existing_departure_times:
                final_departure_time += timedelta(seconds=3) # Reduced from 5 to 3 seconds
            
            # Cap maximum delay to avoid excessive dwell times
            # Calculate maximum delay based on current dwell time
            current_dwell_duration = (final_departure_time - train.arrival_time).total_seconds()
            normal_dwell_time = self.simulation.dwell_time
            
            # Don't allow more than 3x normal dwell time for regular operations
            max_dwell_multiplier = 3.0
            max_allowed_dwell = normal_dwell_time * max_dwell_multiplier
            
            if current_dwell_duration > max_allowed_dwell:
                # Cap the dwell time to avoid excessive delays
                #print(f"WARNING: Excessive dwell time detected for Train {train.train_id} at Station {station.station_id}")
                #print(f"Current calculated dwell: {current_dwell_duration:.1f}s, Max allowed: {max_allowed_dwell:.1f}s")
                
                # Calculate a more reasonable departure time
                adjusted_departure_time = train.arrival_time + timedelta(seconds=max_allowed_dwell)
                
                # Only use the adjusted time if it's later than the original event time
                # (to avoid moving departures earlier than scheduled)
                if adjusted_departure_time > event.time:
                    final_departure_time = adjusted_departure_time
                    #print(f"Capping dwell time to {max_allowed_dwell:.1f}s, new departure: {final_departure_time}")
            
            # If we had to reschedule, log the details
            if final_departure_time != event.time:
                #print(f"[ADAPTIVE DEPARTURE] Rescheduling Train {train.train_id} departure from {event.time} to {final_departure_time}")
                #if segment_conflict_found:
                #    print(f"Reason: Segment {next_segment.segment_id} occupied")
                #if platform_conflict_found:
                #    print(f"Reason: Next station platform occupied")
                #print(f"System congestion metrics: {metrics['segment_congestion']:.2f}, Buffer factor: {buffer_factor}")
                
                # Reschedule the event with the final calculated time
                self.simulation.schedule_event(
                    Event(
                        time=final_departure_time,
                        event_type="train_departure",
                        train=train,
                        station=station,
                    )
                )
                return
            
            # SAFETY CHECK: This should never happen with proper scheduling, but add protection
            if event.time == final_departure_time and (next_segment.occupied_by is not None or next_station.platforms[train.direction] is not None):
                #print("\n[DEPARTURE] WARNING: Could not properly reschedule departing train due to conflicts")
                #print(f"Train {train.train_id} at Station {station.station_id}, Time: {event.time}")
                
                # Force a smaller delay to prevent infinite loops but avoid excessive dwells
                forced_delay = timedelta(minutes=self.simulation.active_headway * 0.8)  # Reduced from 1.5 to 0.8
                forced_departure_time = event.time + forced_delay
                
                #print(f"FORCING delay of {forced_delay.total_seconds()/60:.1f} minutes to {forced_departure_time}")
                
                self.simulation.schedule_event(
                    Event(
                        time=forced_departure_time,
                        event_type="train_departure",
                        train=train,
                        station=station,
                    )
                )
                return
            
    def _handle_turnaround(self, event):
        train = event.train
        station = event.station
        
        # Verbose debug message for turnarounds
        #print(f"\n[TURNAROUND] Processing turnaround event for Train {train.train_id} at Station {station.station_id} (time: {event.time})")
        
        # Check if the train is still active before proceeding
        if not train.is_active: # Check the train's own flag
            #print(f"[TURNAROUND] ERROR: Ignoring turnaround event for inactive train {train.train_id} at {event.time}")
            return # Ignore event for inactive train
        
        departure_time = event.time

        #======= BOARD/ALIGHT PASSENGERS =======#
        alighted, boarded = station.process_passenger_exchange(
            scheme_map=self.simulation.station_type_map, # Pass the map
            train=train, 
            train_arrival_time=train.arrival_time, 
            train_departure_time=departure_time
        )
        
        # Record Arrival before Turnaround
        self._record_timetable_entry(
                train=train, 
                station=station, 
                arrival_time = train.arrival_time,
                departure_time = departure_time, 
                travel_time= train.current_journey_travel_time,
                train_status=train.status,
                boarded=boarded, 
                alighted=alighted
            )
        
        # Clear Station Platform
        previous_direction = train.direction
        station.platforms[previous_direction] = None
        #print(f"[TURNAROUND] Cleared platform at Station {station.station_id} direction {previous_direction}")
        
        # Change train direction
        train.change_direction()
        #print(f"[TURNAROUND] Changed train direction from {previous_direction} to {train.direction}")
        
        if event.time <= self.simulation.end_time:
            # Calculate turnaround time and new departure time
            train.arrival_time = departure_time + timedelta(seconds=self.simulation.turnaround_time)
            train.current_journey_travel_time = self.simulation.turnaround_time
            next_departure_time = train.arrival_time + timedelta(seconds=self.simulation.dwell_time)
            
            #print(f"[TURNAROUND] Scheduling Train {train.train_id} departure from Station {station.station_id} at {next_departure_time}")
            #print(f"[TURNAROUND] Turnaround duration: {self.simulation.turnaround_time}s, Dwell time: {self.simulation.dwell_time}s")
            
            # Make sure the platform in the new direction is available
            #if station.platforms[train.direction] is not None:
            #    print(f"[TURNAROUND] WARNING: Platform at Station {station.station_id} direction {train.direction} already occupied by Train {station.platforms[train.direction].train_id}!")
            #    # We could handle this conflict if needed
            
            # Schedule the departure after turnaround
            self.simulation.schedule_event(
                Event(
                    next_departure_time, 
                    event_type="train_departure", 
                    train=train, 
                    station=station
                )
            )
        else:
            print(f"[TURNAROUND] Train {train.train_id} turnaround skipped - simulation end time reached")
            
    def _handle_segment_enter(self, event):
        train = event.train
        segment = event.segment
        station = train.current_station
        next_station = event.station
        current_time = event.time

        if segment.enter(train, event.time):    # Successfully entered segment
            station.platforms[train.direction] = None
            stops = next_station.should_stop(train)  # can change to passenger exchange logic
            segment_distance = segment.distance #get distance from each of the available stations
            traversal_time = segment.calculate_traversal_time(train, stops, segment_distance)
            
            # Update Train Status
            train.current_journey_travel_time = train.current_journey_travel_time + traversal_time
            
            # Schedule Exit Event
            exit_time = current_time + timedelta(seconds=traversal_time)
            segment.next_available = exit_time
            
            # Train Exit means Train Arrives at next station
            train.arrival_time = exit_time
            
            #Schedule Exit Event
            self.simulation.schedule_event(
                Event(
                    time= exit_time,
                    event_type= "segment_exit",
                    train= train,
                    station=next_station,
                    segment= segment
                )
            )
        else:
            # Use adaptive scheduling instead of resetting the queue
            print(f"\n[SEGMENT ENTER CONFLICT] Train {train.train_id} cannot enter segment {segment.segment_id} at {current_time}")
            
            # Get congestion metrics to determine appropriate scheduling
            metrics = self._calculate_system_congestion_metrics()
            
            # Get segment exit events to find when segment will be clear
            segment_exit_events = [e for _, e in self.simulation.event_queue.queue 
                                    if e.event_type == "segment_exit" and 
                                        e.segment == segment]
            
            # Calculate delay based on adaptive scheduling principles
            if segment_exit_events:
                # Find the earliest exit event for this segment
                earliest_exit = min(segment_exit_events, key=lambda e: e.time)
                
                # Calculate adaptive buffer based on congestion
                if metrics["segment_congestion"] > 0.6:
                    buffer_seconds = 30  # Larger buffer in high congestion
                else:
                    buffer_seconds = 15  # Smaller buffer in lower congestion
                
                # Schedule after segment will be clear plus buffer
                reschedule_time = earliest_exit.time + timedelta(seconds=buffer_seconds)
                print(f"Segment occupied by Train {segment.occupied_by.train_id}, will be clear at {earliest_exit.time}")
                print(f"Rescheduling Train {train.train_id} segment entry to {reschedule_time}")
                
                # Reschedule the segment enter event
                self.simulation.schedule_event(
                    Event(
                        time=reschedule_time,
                        event_type="segment_enter",
                        train=train,
                        station=next_station,
                        segment=segment
                    )
                )
            else:
                # No exit event found, use adaptive headway as fallback
                adaptive_headway = self.simulation.active_headway * metrics["recommended_headway_multiplier"]
                fallback_time = current_time + timedelta(minutes=adaptive_headway)
                
                print(f"No segment exit event found in queue. Using adaptive headway: {adaptive_headway:.2f}min")
                print(f"Rescheduling Train {train.train_id} segment entry to {fallback_time}")
                
                # Reschedule the segment enter event
                self.simulation.schedule_event(
                    Event(
                        time=fallback_time,
                        event_type="segment_enter",
                        train=train,
                        station=next_station,
                        segment=segment
                    )
                )
                
            # IMPORTANT: Don't reset the queue - that was causing simulation to end prematurely
    
    def _handle_segment_exit(self, event):
        train = event.train
        station = event.station
        segment = event.segment
        
        # Free up the segment
        segment.exit(train, event.time)
        
        # Schedule arrival event
        self.simulation.schedule_event(
            Event(
                time=event.time,
                event_type="train_arrival",
                train=train,
                station=station
            )
        )

    def _calculate_system_congestion_metrics(self):
        """
        Calculate system-wide congestion metrics to inform adaptive scheduling.
        Returns a dictionary of metrics for analysis.
        """
        # Gather data
        active_train_count = len(self.simulation.active_trains)
        
        # Count trains in segments vs at stations
        trains_in_segments = 0
        trains_at_stations = 0
        
        for train in self.simulation.active_trains:
            # If train has no current_station, it's in a segment
            if hasattr(train, 'current_station') and train.current_station is None:
                trains_in_segments += 1
            else:
                trains_at_stations += 1
        
        # Calculate congestion metrics
        segment_congestion = trains_in_segments / max(active_train_count, 1)
        
        # Count upcoming arrivals at Station 1 (to prevent overcrowding)
        upcoming_arrivals = 0
        for _, event in self.simulation.event_queue.queue:
            if (event.event_type == "segment_exit" and 
                event.station and event.station.station_id == 1 and
                event.train.direction == "northbound"):
                upcoming_arrivals += 1
        
        # Calculate optimal headway adjustment based on metrics
        headway_multiplier = 1.0
        
        # If system is congested, increase headway to prevent bunching
        if segment_congestion > 0.7:  
            headway_multiplier = 1.3  # 30% increase
        elif segment_congestion > 0.5:
            headway_multiplier = 1.2  # 20% increase
        elif segment_congestion > 0.3:
            headway_multiplier = 1.1  # 10% increase
        
        # If many trains about to arrive at Station 1, increase headway further
        if upcoming_arrivals > 2:
            headway_multiplier += 0.2

        # Cap the multiplier at a reasonable maximum
        headway_multiplier = min(headway_multiplier, 1.5)
        
        return {
            "active_trains": active_train_count,
            "trains_in_segments": trains_in_segments,
            "trains_at_stations": trains_at_stations,
            "segment_congestion": segment_congestion,
            "upcoming_arrivals_station1": upcoming_arrivals,
            "recommended_headway_multiplier": headway_multiplier
        }

class Simulation:
    def __init__(self, csv_filename, config):
        self.simulation_id = None
        self.passenger_data_file = csv_filename
        self.config = config
        self.scheme_type = None

        self.start_time = None
        self.end_time = None
        self.current_time = None
        self.dwell_time = config["dwellTime"]
        self.turnaround_time = config["turnaroundTime"]
        
        self.trains = []
        self.stations = []
        self.scheme_pattern = config["schemePattern"]
        print(self.scheme_pattern)
        self.track_segments = []
        self.passenger_demand = []
        self.service_periods = DEFAULT_SERVICE_PERIODS
        self.active_trains = []
        self.active_headway = 0
        self.trains_to_withdraw_count = 0
        
        self.event_queue = PriorityQueue()
        self.event_handler = EventHandler(self)

        self.timetables = []
    
    def initialize(self, scheme_type):
        self.active_trains = []
        self.active_headway = 0
        self.trains_to_withdraw_count = 0
        self.event_queue = PriorityQueue()
        self.timetables = []


        self._initialize_stations(scheme_type)
        self._initialize_track_segments() # Track segments are the same for all schemes
        self._initialize_trains(scheme_type)
        self._initialize_service_periods(scheme_type)
        self._initialize_passengers_demand()

        # Create station map for efficient lookup
        self.station_type_map = {s.station_id: s.station_type for s in self.stations}

        # print([t.train_id for t in self.trains])
        # print([s.station_id for s in self.stations])
        # print([ts.segment_id for ts in self.track_segments])
        # print(self.service_periods)
        #print(self.passenger_demand)
        
    def _create_simulation_entry(self):
        """Create a simulation entry in the database."""
        print("\n[CREATING SIMULATION ENTRY IN DB]")
        base_date = self.get_datetime_from_csv()
        if base_date:
            self.start_time = datetime.combine(base_date, time(hour=5, minute=0))
            self.end_time = datetime.combine(base_date, time(hour=22, minute=0))
        else:
            print("Error: Could not determine base date from CSV. Aborting initialization.")
            return
        
        if debug:
            self.simulation_id = 1
            return
        
        simulation_entry = db.simulations.create(
            data={
                "START_TIME": self.start_time,
                "END_TIME": self.end_time,
                "DWELL_TIME": DEFAULT_SETTINGS["dwellTime"],
                "TURNAROUND_TIME": DEFAULT_SETTINGS["turnaroundTime"],
                "SERVICE_PERIODS": json.dumps(DEFAULT_SERVICE_PERIODS),
                "PASSENGER_DATA_FILE": self.passenger_data_file
            }
        )

        self.simulation_id = simulation_entry.SIMULATION_ID
        print(f"\tCREATED SIMULATION ENTRY IN DB WITH SIMULATION_ID: {self.simulation_id}")

    def _initialize_stations(self, scheme_type):
        print("\n[INITIALIZING STATIONS]")
        self.stations.clear()
        station_names = self.config["stationNames"]
        num_stations = len(station_names)
        station_types = self.scheme_pattern

        for station_id, (station_name, station_type) in enumerate(zip(station_names, station_types), start=1):
            self.stations.append(
                Station(
                    station_id=station_id,
                    name=station_name,
                    zone_length=DEFAULT_ZONE_LENGTH, # Assuming DEFAULT_ZONE_LENGTH is available
                    station_type="AB" if scheme_type == "REGULAR" else station_type,
                    is_terminus=station_id == 1 or station_id == num_stations
                )
            )

        print(f"  INITIALIZED {len(self.stations)} STATIONS IN MEMORY")

        if not debug and self.scheme_type == self.schemes[0]:
            stations_for_db = []
            for station in self.stations:
                stations_for_db.append({
                    'SIMULATION_ID': self.simulation_id,
                    'STATION_ID': station.station_id,
                    'STATION_NAME': station.name,
                    'STATION_TYPE': station.station_type,
                    'IS_TERMINUS': station.is_terminus,
                    'ZONE_LENGTH': station.zone_length
                })
            
            if stations_for_db:
                try:
                    # Use create_many for efficiency
                    result = db.stations.create_many(data=stations_for_db, skip_duplicates=True)
                    print(f"  [DB:CREATE] ATTEMPTED TO CREATE {len(stations_for_db)} STATIONS IN DB. SUCCESSFULLY BULK INSERTED: {result} ROWS")
                except Exception as e:
                    print(f"  [DB:CREATE] FAILED TO BULK INSERT STATIONS IN DB: {e}")

    def _initialize_track_segments(self):
        print("\n[INITIALIZING TRACK SEGMENTS]")
        station_distances = self.config['stationDistances']
        station_count = len(self.config['stationNames'])
        self.track_segments = []
        
        # 1. Initialize Track Segments in Memory
        segments_in_memory = []
        # Southbound segments
        for idx, distance in enumerate(station_distances, start=1):
            segments_in_memory.append(
                TrackSegment(
                    start_station_id=idx,
                    end_station_id=idx + 1,
                    distance=distance * 1000, # Convert km to m
                    direction='southbound'
                )
            )
        # Northbound segments
        for idx, distance in enumerate(reversed(station_distances)):
            start_id = station_count - idx
            end_id = station_count - idx - 1
            segments_in_memory.append(
                TrackSegment(
                    start_station_id=start_id,
                    end_station_id=end_id,
                    distance=distance * 1000, # Convert km to m
                    direction='northbound'
                )
            )
            
        # Update the instance's track segment list
        self.track_segments = segments_in_memory

        # Link segments to stations
        for ts in self.track_segments:
            for station in self.stations:
                if station.station_id == ts.start_station_id:
                    station.tracks[ts.direction] = ts

        print(f"  INITIALIZED {len(self.track_segments)} TRACK SEGMENTS IN MEMORY")

        if not debug and self.scheme_type == self.schemes[0]:
            segments_for_db = []
            for segment in self.track_segments:
                segments_for_db.append({
                    'SIMULATION_ID': self.simulation_id,
                    'START_STATION_ID': segment.start_station_id,
                    'END_STATION_ID': segment.end_station_id,
                    'DISTANCE': segment.distance,
                    'DIRECTION': segment.direction
                })

            if segments_for_db:
                try:
                    # Use create_many for efficiency
                    result = db.track_segments.create_many(data=segments_for_db, skip_duplicates=True)
                    print(f"  [DB:CREATE] ATTEMPTED TO CREATE {len(segments_for_db)} TRACK SEGMENTS IN DB. SUCCESSFULLY BULK INSERTED: {result} ROWS")
                except Exception as e:
                    print(f"  [DB:CREATE] FAILED TO BULK INSERT TRACK SEGMENTS IN DB: {e}")

    def _initialize_trains(self, scheme_type):
        print("\n[INITIALIZING TRAINS & TRAIN_SPEC(s)]")
        self.trains.clear()
        
        train_count = 0
        for period in DEFAULT_SERVICE_PERIODS:
            train_count = max(train_count, period['TRAIN_COUNT'])

        train_specs_obj = TrainSpec(
            max_capacity=self.config["maxCapacity"],
            cruising_speed=self.config["maxSpeed"],
            passthrough_speed=20, # Assuming fixed passthrough speed
            accel_rate=self.config["acceleration"],
            decel_rate=self.config["deceleration"],
        )

        for train_id in range(1, train_count + 1):           
            self.trains.append(
                Train(
                    train_id=train_id,
                    train_specs=train_specs_obj, 
                    service_type="AB" if scheme_type == "REGULAR" else "B" if train_id % 2 == 0 else "A",
                    current_station=self.stations[0] # All trains start at North Avenue (Station 1)
                )
            )
        print(f"  INITIALIZED {len(self.trains)} TRAINS IN MEMORY")

        if not debug and self.scheme_type == self.schemes[0]:
            train_specs_entry_id = None
            try:
                train_specs_entry = db.train_specs.create(
                    data={
                        'SIMULATION_ID': self.simulation_id,
                        'SPEC_NAME': 'REGULAR TRAIN',
                        'MAX_CAPACITY': train_specs_obj.max_capacity,
                        'CRUISING_SPEED': self.config['maxSpeed'], # Use original config value
                        'PASSTHROUGH_SPEED': 20,
                        'ACCEL_RATE': train_specs_obj.accel_rate,
                        'DECEL_RATE': train_specs_obj.decel_rate,
                    }
                )
                
                train_specs_entry_id = train_specs_entry.SPEC_ID
                print(f"  [DB:CREATE] SUCCESSFULLY CREATED TRAIN SPECS ENTRY IN DB WITH SPEC_ID: {train_specs_entry_id}")
            except Exception as e:
                print(f"  [DB:CREATE] FAILED TO CREATE TRAIN SPECS ENTRY IN DB: {e}")
                # Handle error appropriately - maybe cannot proceed without spec_id?
                return # Exit if spec creation failed

            # 4b. Prepare and Bulk Insert Train Data
            if train_specs_entry_id: # Proceed only if spec ID was obtained
                trains_for_db = []
                for train in self.trains:
                    trains_for_db.append({
                        'SIMULATION_ID': self.simulation_id,
                        'TRAIN_ID': train.train_id,
                        'SERVICE_TYPE': train.service_type,
                        'SPEC_ID': train_specs_entry_id # Use the ID from the DB entry
                    })

                if trains_for_db:
                    try:
                        # Use create_many for efficiency
                        result = db.trains.create_many(data=trains_for_db, skip_duplicates=True)
                        print(f"  [DB:CREATE] ATTEMPTED TO CREATE {len(trains_for_db)} TRAINS IN DB. SUCCESSFULLY BULK INSERTED: {result} ROWS")
                    except Exception as e:
                        print(f"  [DB:CREATE] FAILED TO BULK INSERT TRAINS IN DB: {e}")

    def _initialize_service_periods(self, scheme_type):
        print("\n[INITIALIZING SERVICE PERIODS]")
        loop_time = int(self.calculate_loop_time(self.trains[0]) / 60)  # Loop Time in minutes
        
        for i, period in enumerate(self.service_periods):
            #period["HEADWAY"] = custom_round(loop_time / period["TRAIN_COUNT"])
            period[f"{scheme_type}_HEADWAY"] = custom_round(loop_time / period["TRAIN_COUNT"])

            # Schedule service period start event
            start_datetime = datetime.combine(
                self.current_time.date(),
                time(hour=(period["START_HOUR"] - 1), minute=30, second=0),
            )  # Set the datetime by the period start hour in config
        
            # Schedule Start of Event
            self.schedule_event(
                Event(
                    time=start_datetime,
                    event_type="service_period_change",
                    period=period
                )
            )

        # Create the DataFrame first
        df_periods = pd.DataFrame(
            [
                {
                    "NAME": period["NAME"],
                    "TRAIN_COUNT": period["TRAIN_COUNT"],
                    f"{scheme_type}_HEADWAY": period[f"{scheme_type}_HEADWAY"],
                }
                for period in self.service_periods
            ]
        )

        # Convert to string, split lines, and add tab prefix
        indented_df_string = '\n'.join(['  ' + line for line in df_periods.to_string().splitlines()])

        # Print the result
        print(indented_df_string)
        if scheme_type == "REGULAR":
            print(f"  LOOP TIME: {timedelta(minutes=loop_time)}")
        else:
            print(f"  LOOP TIME FOR A TRAINS: {timedelta(minutes=loop_time)}")
            print(f"  LOOP TIME FOR B TRAINS: {timedelta(minutes=int(self.calculate_loop_time(self.trains[1]) / 60))}")

        # Update the SERVICE_PERIODS field in the database with calculated headways
        if not debug :
            # Construct the correct database column name by replacing hyphen with underscore
            db_column_name = f"{scheme_type.replace('-', '_').upper()}_LOOP_TIME_MINUTES"
            try:
                updated_service_periods_json = json.dumps(self.service_periods)
                db.simulations.update(
                    where={'SIMULATION_ID': self.simulation_id},
                    data={'SERVICE_PERIODS': updated_service_periods_json, db_column_name: loop_time}
                )
                print(f"  [DB:UPDATE] SUCCESSFULLY updated SERVICE_PERIODS in SIMULATION for SIMULATION_ID: {self.simulation_id}")
                print(f"  [DB:UPDATE] SUCCESSFULLY updated {db_column_name} in SIMULATION for SIMULATION_ID: {self.simulation_id}")
            except Exception as e:
                print(f"  [DB:UPDATE] ERROR updating SERVICE_PERIODS in SIMULATION for SIMULATION_ID: {self.simulation_id}: {e}")

    def _initialize_passengers_demand(self):
        print("\n[INITIALIZING PASSENGER DEMAND OBJECTS]")
        station_type_map = {s.station_id: s.station_type for s in self.stations}
        valid_station_ids = set(station_type_map.keys())
        self.passenger_demand = []

        file_path = UPLOAD_FOLDER + "\\" + self.passenger_data_file
        try:
            df = pd.read_csv(file_path)
        except FileNotFoundError:
            print(f"  [ERROR] Passenger data file not found at '{file_path}'. Aborting passenger initialization.")
            return
        except pd.errors.EmptyDataError:
            print(f"  [ERROR] Passenger data file '{file_path}' is empty. Aborting passenger initialization.")
            return
        except Exception as e:
            print(f"  [ERROR] Error reading passenger data CSV '{file_path}': {e}. Aborting passenger initialization.")
            return

        # --- Data Processing --- #
        id_vars = []
        if 'DateTime' in df.columns:
            id_vars.append('DateTime')
        od_columns = [col for col in df.columns if ',' in col]

        if not id_vars:
            print("  [ERROR] 'DateTime' column not found in CSV. Cannot process passengers.")
            return
        if not od_columns:
            print("  [ERROR] No OD pair columns (e.g., '1,2') found in CSV. Cannot process passengers.")
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
            print("  [WARNING] No valid passenger demand found after melting and filtering.")
            return

        melted_df[['ORIGIN_STATION_ID', 'DESTINATION_STATION_ID']] = melted_df['OD_PAIR'].str.strip('"').str.split(',', expand=True).astype(int)
        invalid_origin = ~melted_df['ORIGIN_STATION_ID'].isin(valid_station_ids)
        invalid_destination = ~melted_df['DESTINATION_STATION_ID'].isin(valid_station_ids)
        invalid_rows = invalid_origin | invalid_destination

        if invalid_rows.any():
            print(f"  [WARNING] Found {invalid_rows.sum()} rows with invalid station IDs. These rows will be skipped.")
            melted_df = melted_df[~invalid_rows]

        if melted_df.empty:
            print("  [WARNING] No valid passenger demand remaining after station ID validation.")
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

        # --- Create Passenger_Demand Objects in Memory --- #
        for index, row in melted_df.iterrows():
            demand = Passenger_Demand(
                origin_station_id=row['ORIGIN_STATION_ID'],
                destination_station_id=row['DESTINATION_STATION_ID'],
                arrival_time=row['ARRIVAL_TIME_AT_ORIGIN'],
                passenger_count=row['PASSENGER_COUNT'],
                trip_type=row['TRIP_TYPE']
            )
            demand.direction = 'southbound' if demand.destination_station_id > demand.origin_station_id else 'northbound'
            self.passenger_demand.append(demand)

        print(f"  INITIALIZED {len(self.passenger_demand)} PASSENGER DEMAND OBJECTS IN MEMORY")

        # --- Calculate and Store Total Passenger Count --- #
        total_passenger_count = sum(demand.passenger_count for demand in self.passenger_demand)
        print(f"  TOTAL PASSENGER COUNT FROM DEMAND DATA: {total_passenger_count}")

        for demand in self.passenger_demand:
            for station in self.stations:
                # --- Add Passenger_Demand object to Station waiting_demand list --- #
                if station.station_id == demand.origin_station_id:
                    station.waiting_demand.append(demand)
                
                # --- Add Transfer Station ID and Direction --- #
                if demand.trip_type == "TRANSFER":
                    demand.transfer_station_id = int(demand.find_nearest_transfer(self.stations))
                    demand.direction = 'southbound' if demand.transfer_station_id > demand.origin_station_id else 'northbound'

    def schedule_event(self, event):
        """Add an event to the priority queue."""
        self.event_queue.put((event.time, event))  # Use (priority, item) format

    def run(self):
        """Run the simulation until the end time."""
        print(f"\n================[SIMULATION.RUN() STARTED]================\n")
        start_run_time = py_time.perf_counter() # Record start time
        self.schemes = ["SKIP-STOP","REGULAR"]
        self._create_simulation_entry()
        
        for scheme_type in self.schemes:
            try:
                print(f"\n\t===[RUNNING SIMULATION FOR SCHEME TYPE: {scheme_type}]===")
                self.current_time = self.start_time
                self.scheme_type = scheme_type
                self.initialize(scheme_type)

                self.event_history = []
                while self.current_time < self.end_time and not self.event_queue.empty():
                    priority, event = self.event_queue.get()  # Get the next event
                    self.event_history.append(event)
                    # Ensure we don't process events past the end time
                    if event.time >= self.end_time:
                        self.current_time = event.time              
                        continue # Skip processing this event

                    self.current_time = event.time
                    self.event_handler.process_event(event)

                # Indicate success for this simulation ID run
                print(f"  SIMULATION_ID: {self.simulation_id} COMPLETED UP TO {self.current_time.strftime('%H:%M:%S')}")
                print(f"  GENERATED {len(self.timetables)} TRAIN_MOVEMENTS ENTRIES")
                print(f"\n\t===[SIMULATION COMPLETED]===")

                # Save results before potentially moving to the next simulation_id or disconnecting
                if not debug:
                    self.save_timetable_to_db()
                    self.save_passenger_demand_to_db()

            except Exception as e:
                print(f"Error during simulation run for ID {self.simulation_id}, Scheme: {scheme_type}: {e}")
                print(traceback.format_exc())

                # Attempt to delete the failed simulation entry from the database
                if not debug and self.simulation_id is not None:
                    try:
                        print(f"Attempting to delete failed simulation entry with ID: {self.simulation_id}")
                        db.simulations.delete(where={'SIMULATION_ID': self.simulation_id})
                        print(f"Successfully deleted simulation entry with ID: {self.simulation_id}")
                    except Exception as db_error:
                        print(f"Error deleting simulation entry with ID {self.simulation_id} from database: {db_error}")

                # Decide if you want to stop all simulations or continue with the next ID
                break # Stop processing further simulation IDs on error
        
        end_run_time = py_time.perf_counter()
        run_duration = end_run_time - start_run_time
        print(f"\n[SIMULATION.RUN() EXECUTION TIME: {run_duration:.3f} SECONDS]")

        # Update the TOTAL_RUN_TIME_SECONDS field in the database
        if not debug:
            try:
                db.simulations.update(
                    where={'SIMULATION_ID': self.simulation_id},
                    data={'TOTAL_RUN_TIME_SECONDS': round(run_duration, 3)}
                )
                print(f"  [DB:UPDATE] SUCCESSFULLY updated TOTAL_RUN_TIME_SECONDS in DB for SIMULATION_ID: {self.simulation_id}")
            except Exception as e:
                print(f"  [DB:UPDATE] ERROR updating TOTAL_RUN_TIME_SECONDS in DB for SIMULATION_ID: {self.simulation_id}: {e}")

        # Disconnect shared Prisma client after all simulations in the queue are attempted or completed
        if not debug and db.is_connected():
            print("Disconnecting shared DB client after simulation run.")
            db.disconnect()

        print(f"\n================[SIMULATION.RUN() COMPLETED]================\n")

    def save_timetable_to_db(self):
        """Formats timetable entries and bulk inserts them into the TRAIN_MOVEMENTS table."""
        print(f"\n[SAVING TRAIN_MOVEMENTS TO DB]")
        if not self.timetables:
            print("  [ERROR]: NO TIMETABLE ENTRIES TO SAVE.")
            return

        if not db.is_connected():
            print("\tERROR: DATABASE IS NOT CONNECTED. CANNOT SAVE TIMETABLE.")
            return


        print(f"  PREPARING {len(self.timetables)} TIMETABLE ENTRIES FOR DATABASE INSERTION...")
        data_to_insert = []
        skipped_count = 0
        for entry in self.timetables:
            # Handle potential non-datetime departure times (like "WITHDRAWN")
            departure_time_db = None
            if isinstance(entry.departure_time, datetime):
                departure_time_db = entry.departure_time
            # else: leave as None if it's "WITHDRAWN" or other non-datetime

            # Skip entries with None arrival time if required by DB schema
            if entry.arrival_time is None and entry.departure_time is None: # Example condition
                #print(f"Skipping entry for Train {entry.train_id} at Station {entry.station_id} due to missing times.")
                skipped_count += 1
                continue
            
            travel_time_db = 0 # Default to 0
            if isinstance(entry.travel_time, (int, float)):
                travel_time_db = int(entry.travel_time)

            # Adjust these keys based on your actual Prisma schema for TRAIN_MOVEMENTS
            data = {
                "SIMULATION_ID": self.simulation_id,
                "SCHEME_TYPE": self.scheme_type,
                "TRAIN_ID": entry.train_id,
                "TRAIN_SERVICE_TYPE": entry.service_type,
                "STATION_ID": entry.station_id,
                "DIRECTION": entry.direction,
                "TRAIN_STATUS": entry.train_status,
                "ARRIVAL_TIME": entry.arrival_time,
                "DEPARTURE_TIME": departure_time_db,
                "TRAVEL_TIME_SECONDS": travel_time_db, 
                "PASSENGERS_BOARDED": entry.passengers_boarded,
                "PASSENGERS_ALIGHTED": entry.passengers_alighted,
                "CURRENT_STATION_PASSENGER_COUNT": entry.current_station_passenger_count,
                "CURRENT_PASSENGER_COUNT": entry.current_passenger_count,
            }
            data_to_insert.append(data)

        if skipped_count > 0:
            print(f"SKIPPED {skipped_count} ENTRIES DUE TO MISSING TIME DATA.")

        if not data_to_insert:
            print("NO VALID ENTRIES REMAINING TO INSERT AFTER FILTERING.")
            return

        try:
            result = db.train_movements.create_many(
                data=data_to_insert,
            )
            print(f"  [DB:INSERT] ATTEMPTED TO CREATE {len(data_to_insert)} TRAIN_MOVEMENTS ENTRIES IN DB. SUCCESSFULLY BULK INSERTED: {result} ROWS")
        except Exception as e:
            print(f"  [DB:INSERT] FAILED TO BULK INSERT TRAIN_MOVEMENTS ENTRIES IN DB: {e}")
            # Consider logging the failed data or implementing retry logic if necessary

    def save_passenger_demand_to_db(self):
        print(f"\n[SAVING PASSENGER DEMAND TO DB]")
        # --- Prepare Data for Database Insertion --- #
        total_passenger_count = sum(demand.passenger_count for demand in self.passenger_demand)
        if not debug:
            # Update the main simulation entry with the total count
            try:
                db.simulations.update(
                    where={'SIMULATION_ID': self.simulation_id},
                    data={'TOTAL_PASSENGER_COUNT': total_passenger_count}
                )
                print(f"  [DB:UPDATE] SUCCESSFULLY updated TOTAL_PASSENGER_COUNT in DB for SIMULATION_ID: {self.simulation_id}")
            except Exception as e:
                print(f"  [DB:UPDATE] ERROR updating TOTAL_PASSENGER_COUNT in DB for SIMULATION_ID: {self.simulation_id}: {e}")

            passenger_records_for_db = []
            for demand in self.passenger_demand:
                passenger_records_for_db.append({
                    'SIMULATION_ID': self.simulation_id,
                    'SCHEME_TYPE': self.scheme_type,
                    'ARRIVAL_TIME_AT_ORIGIN': demand.arrival_time,
                    'DEPARTURE_TIME_FROM_ORIGIN': demand.departure_from_origin_time,
                    'ORIGIN_STATION_ID': demand.origin_station_id,
                    'DESTINATION_STATION_ID': demand.destination_station_id,
                    'TRIP_TYPE': demand.trip_type,
                    'PASSENGER_COUNT': demand.passenger_count
                })

            # --- Bulk Insert into Database --- #
            if passenger_records_for_db:
                try:
                    result = db.passenger_demand.create_many(data=passenger_records_for_db)
                    print(f"  [DB:INSERT] ATTEMPTED TO CREATE {len(passenger_records_for_db)} PASSENGER DEMAND ENTRIES IN DB. SUCCESSFULLY BULK INSERTED: {result} ROWS")
                except Exception as e:
                    print(f"  [DB:INSERT] FAILED TO BULK INSERT PASSENGER DEMAND ENTRIES IN DB: {e}")
            else:
                print("  [ERROR]: NO PASSENGER DEMAND ENTRIES TO INSERT INTO DB.")

    def compute_demand_metrics(self):
        pass

    def get_station_by_id(self, station_id):
        """Fast O(1) station lookup by ID."""
        return next((s for s in self.stations if s.station_id == station_id), None)
    
    def get_segment_by_id(self, segment_id):
        """Fast O(1) segment lookup by ID."""
        return next((s for s in self.track_segments if s.segment_id == segment_id), None)
    
    def get_event_by_type(self, event_type, station=None, segment=None):
        return next((
            e for _, e in self.event_queue.queue # Iterate through (priority, event) tuples
            if e.event_type == event_type and
            (station is None or e.station == station) and
            (segment is None or e.segment == segment)
        ), None)
    
    def calculate_loop_time(self, train):
        total_time = 0
        start_station = train.current_station
        current_station = train.current_station
        direction = train.direction
        stations = self.stations
        dwell_time = self.dwell_time
        turnaround_time = self.turnaround_time
        
        # Set initial current speed
        train.current_speed = train.cruising_speed
        
        # Check for valid direction
        if direction != "northbound" and direction != "southbound":
            raise ValueError("Invalid train direction: must be 'northbound' or 'southbound'.")

        # Helper function to get the next station
        def get_next_station(station, direction):
            index = stations.index(station)
            if direction == "southbound":
                if index < len(stations) - 1:
                    return stations[index + 1]
                else:
                    return None  # Reached terminus
            else:  # direction == "northbound"
                if index > 0:
                    return stations[index - 1]
                else:
                    return None  # Reached terminus

        # Helper function to get the segment between stations
        def get_segment(start_station, end_station, direction):
            for segment in self.track_segments:
                if (segment.start_station_id == start_station.station_id and
                    segment.end_station_id == end_station.station_id and
                    segment.direction == direction):
                    return segment
            return None

        def calculate_loop_debug(is_debug=False):
            if is_debug:
                print(f"\nCurrent Station: {current_station.station_id}-{current_station.station_type}")
                print(f"Next Station: {next_station.station_id}-{next_station.station_type}")
                print(f"Segment: {segment.segment_id}")
                print(f"Stops: {stops}")
                print(f"Traversal Time: {traversal_time}")
                print(f"Total Time: {total_time}")


        # Traverse to the further point
        while True:
            # Get next, not set
            next_station = get_next_station(current_station, direction)

            # If its not valid that all stations for the loop has been traversed
            if not next_station:
                # Change parameters for calculation

                total_time += turnaround_time # add turnaround

                # Change to reverse travel
                if direction == "northbound":
                    direction = "southbound"
                else:
                    direction = "northbound"

                break  # Terminus has been hit

            segment = get_segment(current_station, next_station, direction)

            if segment is None:  # Handle cases where station and segment are missing
                raise ValueError(f"Could not find segment between {current_station.station_id} and {next_station.station_id} ({direction}).")
                break  # Exit loop due to missing segment

            # Check if need to perform a stop at that segment
            stops = next_station.should_stop(train)  # can change to passenger exchange logic
            segment_distance = segment.distance #get distance from each of the available stations
            traversal_time = segment.calculate_traversal_time(train, stops, segment_distance)
            total_time += traversal_time
            total_time += dwell_time if stops else 0
            # DEBUGGING
            calculate_loop_debug()
            current_station = next_station
        
        # Main Loop again back towards it
        while True:
            next_station = get_next_station(current_station, direction)

            # Check if its base destination if its looped to starting position
            if next_station == start_station:

                segment = get_segment(current_station, next_station, direction)

                if segment is None:  # Handle cases where station and segment are missing
                    raise ValueError(f"Could not find segment between {current_station.station_id} and {next_station.station_id} ({direction}).")
                    break  # Exit loop due to missing segment

                # Check if need to perform a stop at that segment
                stops = next_station.should_stop(train)  # can change to passenger exchange logic

                segment_distance = segment.distance #get distance from each of the available stations
                traversal_time = segment.calculate_traversal_time(train, stops, segment_distance)
                total_time += traversal_time + dwell_time
                # DEBUGGING
                calculate_loop_debug()
                break  # now return proper loop
            
            segment = get_segment(current_station, next_station, direction)

            # Do not call if segment is missing
            if segment is None:  # Handle cases where station and segment are missing
                raise ValueError(f"Could not find segment between {current_station.station_id} and {next_station.station_id} ({direction}).")
                break # Exit loop due to missing segment
            # If statements

            # Check if need to perform a stop at that segment
            stops = next_station.should_stop(train)  # can change to passenger exchange logic
            segment_distance = segment.distance #get distance from each of the available stations
            traversal_time = segment.calculate_traversal_time(train, stops, segment_distance)
            total_time += traversal_time
            total_time += dwell_time if stops else 0
            # DEBUGGING
            calculate_loop_debug()
            current_station = next_station # set current to next for looping

        return total_time

    def get_datetime_from_csv(self):
        try:
            file_path = UPLOAD_FOLDER + "\\" + self.passenger_data_file
            # Read only the first data row to get the date
            df = pd.read_csv(file_path, nrows=1)

            if df.empty:
                print(f"Warning: CSV file '{file_path}' appears to be empty or has no data rows.")
                return None

            # Check if 'DateTime' column exists
            if 'DateTime' not in df.columns:
                print(f"Error: 'DateTime' column not found in '{file_path}'.")
                return None

            datetime_str = df.iloc[0]['DateTime']

            if pd.isna(datetime_str):
                print(f"Error: First row of 'DateTime' column in '{file_path}' is empty.")
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
        
        
if __name__ == "__main__":
    """ Method to run the simulation as a standalone script"""
    sample_config = {
        'acceleration': 0.8, 
        'deceleration': 0.8, 
        'dwellTime': 60, 
        'maxCapacity': 1182, 
        'maxSpeed': 60, 
        'turnaroundTime': 300, 
        'stationNames': ['North Avenue', 'Quezon Avenue', 'GMA-Kamuning', 'Cubao', 'Santolan-Annapolis', 'Ortigas', 'Shaw Boulevard', 'Boni Avenue', 'Guadalupe', 'Buendia', 'Ayala', 'Magallanes', 'Taft Avenue'], 
        'stationDistances': [1.2, 1.1, 1.8, 1.5, 1.4, 0.9, 1, 1.1, 1.3, 1, 1.2, 1.7],
        'schemePattern': ['AB', 'A', 'AB', 'B', 'AB', 'A', 'AB', 'B', 'AB', 'A', 'AB', 'B', 'AB']
        }
    test_sim = Simulation("4-12-23-SAMPLE-minute-level.csv", sample_config)

    test_sim.run()

    simulation_instance = instance_df(test_sim)
    stations = instances_to_df(test_sim.stations)
    track_segments = instances_to_df(test_sim.track_segments)
    trains = instances_to_df(test_sim.trains)
    service_periods = test_sim.service_periods
    passenger_demand = instances_to_df(test_sim.passenger_demand)
    train_movements = instances_to_df(test_sim.timetables)
    event_history = instances_to_df(test_sim.event_history)

    print("\nSimulation script finished.")

