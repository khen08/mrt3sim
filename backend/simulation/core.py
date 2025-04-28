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

from config import DEFAULT_SETTINGS, DEFAULT_SCHEME, DEFAULT_SERVICE_PERIODS, DEFAULT_ZONE_LENGTH, UPLOAD_FOLDER
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
    """
    Converts a list of objects into a pandas DataFrame.

    Each object in the list becomes a row in the DataFrame, with object
    attributes becoming columns. Non-primitive attribute values are
    converted to strings.

    Args:
        obj_list (list): A list of objects.

    Returns:
        pd.DataFrame: A DataFrame representing the list of objects.
    """
    all_data = []
    if not obj_list:
        return pd.DataFrame() # Return empty DataFrame if list is empty

    for obj in obj_list:
        data = {}
        for var_name, var_value in obj.__dict__.items():
            # Convert lists/dicts/objects to string representation for DataFrame compatibility
            if isinstance(var_value, (list, dict)) or not isinstance(var_value, (int, float, str, bool, type(None))):
                data[var_name] = str(var_value)
            else:
                data[var_name] = var_value
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
                train_status
            ):
        """
        Initialize a Timetable Entity
        
        Args:
            train_id (int)
            station_id (int)
            scheduled_arrival (datetime)
            scheduled_departure (datetime)
        Attributes:
            arrival_time (datetime)
            departure_time (datetime)
            passengers_boarded (int)
            passengers_alighted (int)
        """
        self.service_type = service_type
        self.train_id = train_id
        self.station_id = station_id
        self.direction = direction
        self.arrival_time = arrival_time
        self.departure_time = departure_time
        self.travel_time = travel_time
        self.passengers_boarded = passengers_boarded
        self.passengers_alighted = passengers_alighted
        self.current_station_passenger_count = current_station_passenger_count
        self.train_status = train_status
        
class TrainSpec:
    def __init__(self, max_capacity, cruising_speed, passthrough_speed, accel_rate, decel_rate):
        self.max_capacity = max_capacity
        self.cruising_speed = cruising_speed
        self.passthrough_speed = passthrough_speed
        self.accel_rate = accel_rate
        self.decel_rate = decel_rate

# Entity Classes
class Passenger:
    def __init__(self, passenger_id, origin_station_id, destination_station_id, arrival_time):
        """
        Initialize a Passenger Entity
        
        Args:
            passenger_id (int):                     passenger_id
            origin_station_id (int):                origin_station_id
            destination_station_id (int):           destination_station_id
            arrival_time (datetime):                Time arrived at origin station
            
        Attributes:
            boarding_time (datetime):               Time boarded the train
            completion_time (datetime):             Time arrived at destination
            status (str):                            "waiting", "in_transit", or "completed"
        """
        self.passenger_id = passenger_id
        self.origin_station_id = origin_station_id
        self.destination_station_id = destination_station_id
        self.service_type = None # What kind of train service this passenger will ride
        self.arrival_time = arrival_time 
        self.boarding_time = None
        self.completion_time = None
        self.status = "waiting" 
        
        self.direction = None
        self.trip_type = "transfer" # "direct" or "transfer" transfer
        self.train_id = None

    def calculate_wait_time(self):
        """Calculate the time waited at the origin station."""
        if self.boarding_time:
            return self.boarding_time - self.arrival_time
        return None

    def calculate_travel_time(self):
        """Calculate the total travel time."""
        if self.completion_time and self.boarding_time:
            return self.completion_time - self.boarding_time
        return None
    
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
        
        return best_transfer
        
class Station:
    def __init__(self, station_id, name, zone_length=None,  station_type="AB", is_terminus=False):
        """
        Initialize a Station Entity
        
        Args:
            station_id (int):                       Assigned number to identify station entity
            name (str):                             User-input assigned name
            zone_length (int):                      Length of the station in meters
            station_type (str):                     Determine what type of station in an AB Scheme
        
        Attributes:
            is_terminus (boolean):                  If a station is a depot
            waiting_passengers (list[Passenger()]): List of passengers waiting at the station
            dwell_time (float):                     Time for loading/unloading (in minutes)
            turnaround_time (float):                Time for direction change (in minutes)
            statistics ():                          Metrics for this station
        """
        self.station_id = station_id
        self.name = name
        self.zone_length = zone_length
        self.station_type = station_type
        self.waiting_passengers = []

        #undocumented
        self.is_terminus = is_terminus
        # Adjacent tracks towards next station
        self.tracks = {"northbound": None, "southbound": None}
        # Station Platforms
        self.platforms = {"northbound": None, "southbound": None}

    def process_passenger_exchange(self, train, train_arrival_time, train_departure_time):
        """Board and Alight passengers in current station"""
        # Alight Passengers
        passengers_alighted = []
        for passenger in train.passengers[:]: # Iterate over a copy of the list
            if passenger.destination_station_id == self.station_id:
                train.passengers.remove(passenger)
                passengers_alighted.append(passenger)
                passenger.status = "completed"  # Update passenger state
                passenger.completion_time = train_arrival_time  # Record completion time
    
        # Load waiting passengers onto the train (up to capacity)
        passengers_boarded = []
        

        for passenger in self.waiting_passengers[:]:  # Iterate over a copy of the list
            if passenger.arrival_time <= train_departure_time and passenger.direction == train.direction:
                if len(train.passengers) < train.capacity:
                    self.waiting_passengers.remove(passenger)
                    train.passengers.append(passenger)
                    passengers_boarded.append(passenger)
                    passenger.status = "in_transit"
                    passenger.boarding_time = train_arrival_time
                    passenger.train_id = train.train_id
                #else:
                #    print(train.train_id, train_arrival_time, passenger.passenger_id, len(train.passengers))
                    
        return len(passengers_alighted), len(passengers_boarded)

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
        
        self.last_exit_time = None###
        self.next_available = None#
        
    def is_available(self):
        """Check if the segment is free to enter."""
        # Logic to check if the segment is available (e.g., no train is on it)
        return self.occupied_by is None

    def enter(self, train):
        """Mark the segment as occupied."""
        if self.occupied_by is None:
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
            
            return int(total_time)
    
class Train:
    def __init__(self, train_id, train_specs, service_type="AB", current_station=None):
        """
        Initialize a Train Entity
        
        Args:
            train_id: Assigned number to identify train entity
            train_specs: Contains train characteristics
            service_type: Determine which stations the train will serve ("AB", "A", "B")
            
        Attributes:
            active: Boolean to indicate if a train is in service
            passengers: List of passenger entities who boarded
            trip_count: Number of trips the specific train entity has taken 
        """
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
        self.passengers = []
        
        self.direction = "southbound"
        self.current_station = current_station
        self.loop_count = 0
        
        self.arrival_time = None
        self.last_departure_time = None
        self.current_journey_travel_time = 0

    def board_passengers(self, boarding_passengers):
        """Add passengers to the train."""
        if len(self.passengers) + len(boarding_passengers) <= self.capacity:
            self.passengers.extend(boarding_passengers)
        else:
            # Logic for handling overcapacity (e.g., leave some passengers behind)
            pass

    def alight_passengers(self, station):
        """Remove passengers whose destination is the current station."""
        remaining_passengers = []
        for passenger in self.passengers:
            if passenger.destination_station == station:
                # Logic for handling alighted passengers (e.g., update their status)
                pass
            else:
                remaining_passengers.append(passenger)
        self.passengers = remaining_passengers
    
    def change_direction(self):
        """Reverse the train's direction."""
        self.direction = "southbound" if self.direction == "northbound" else "northbound"

    def calculate_load_factor(self):
        """Calculate the current occupancy percentage."""
        return (len(self.passengers) / self.capacity * 100)

class Event:
    def __init__(self, time, event_type, simulation_id=None, period=None, train=None, station=None, segment=None):
        """
        Initialize a Simulation Event

        Args:
            time (datetime): Time of the event
            event_type (str): Type of event (e.g., "train_arrival")
            period (dict, optional): Service period data for period change events.
            train (Train, optional): Train involved in the event.
            station (Station, optional): Station involved in the event.
            segment (TrackSegment, optional): Track segment involved in the event.
        """
        self.time = time
        self.event_type = event_type
        self.period = period
        self.train = train
        self.station = station
        self.segment = segment

    def __lt__(self, other):
        """Comparison for priority queue (earlier events have higher priority)."""
        return self.time < other.time
    
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
            #print(
            #    "\nSERVICE PERIOD CHANGE: ",
            #    event.time.strftime('%H:%M:%S'),
            #    "\nHEADWAY",
            #    self.simulation.active_headway,
            #    "\nACTIVE TRAINS:",
            #    len([t.train_id for t in self.simulation.active_trains]),
            #    )
    
    def _handle_service_period_change(self, event):
        """Adjust the number of active trains based on the service period."""
        # Immediately activate the new period's headway
        self.simulation.active_headway = event.period['headway']
        period = event.period
        trains = self.simulation.trains
        active_trains = self.simulation.active_trains
        target_train_count = period['train_count']
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
            
            # Schedule departure event for the train with proper headway
            departure_time = event.time
            
            for i in range(trains_to_deploy):
                train = available_trains[i]  # get train to deploy
                active_trains.append(train)  # add train to active list
                train.current_speed = train.cruising_speed
                
                # Schedule the arrival event to terminus
                self.simulation.schedule_event(
                    Event(
                        time=departure_time,
                        event_type="train_departure",
                        train=train,
                        station=train.current_station
                    )
                )
                
                # Increment departure time by headway
                departure_time += timedelta(minutes=self.simulation.active_headway)
                
        # Withdraw trains if needed
        elif current_active_count > target_train_count:
            trains_to_withdraw = current_active_count - target_train_count
            self.simulation.trains_to_withdraw_count = trains_to_withdraw # Khen
            #print(f"SERVICE PERIOD CHANGE: Need to withdraw {trains_to_withdraw} trains.")
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
                current_station_passenger_count = len(station.waiting_passengers),
                train_status=train_status
            )
            self.simulation.timetables.append(entry)

    def _handle_arrival(self, event):
        train = event.train
        station = event.station
        arrival_time = event.time
        
        # === WITHDRAWAL CHECK (Upon Northbound Arrival at Station 1) === #
        if (self.simulation.trains_to_withdraw_count > 0 and # Khen
            station == self.simulation.stations[0] and # Station 1 (North Ave)
            train.direction == "northbound"):
            
            # Calculate end time including final dwell
            end_of_service_time = arrival_time + timedelta(seconds=self.simulation.dwell_time)

            # Remove train from active list FIRST
            if train in self.simulation.active_trains:
                self.simulation.active_trains.remove(train)
                # Decrement withdrawal counter
                self.simulation.trains_to_withdraw_count -= 1

                # Record final arrival with departure time reflecting end of dwell
                self._record_timetable_entry(
                    train=train, 
                    station=station, 
                    arrival_time=arrival_time, # Actual arrival time
                    departure_time=end_of_service_time, # Time after final dwell
                    travel_time=train.current_journey_travel_time, # Log final travel time
                    train_status="inactive" # Set status to inactive
                )
                # Clear the platform the train arrived on
                station.platforms[train.direction] = None
            else:
                print(f"WARNING: Train {train.train_id} was targeted for withdrawal upon arrival but not found in active_trains list.")
            
            # DO NOT schedule next event (turnaround/departure) for this train.
            return 
        # === END WITHDRAWAL CHECK ===
        
        # --- Normal Arrival Processing (If not withdrawn) ---
        # Calculate departure time based on dwell time
        departure_time = arrival_time + timedelta(seconds=self.simulation.dwell_time)
        ##train.arrival_time = arrival_time
        train.current_station = station
        
        # Occupy Current Station
        station.platforms[train.direction] = train
        
        if station.is_terminus:
            # Schedule turnaround event
            self.simulation.schedule_event(
                Event(
                    time=departure_time,
                    event_type="turnaround",
                    train=train,
                    station=station
                )
            )
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
        
    def _handle_departure(self, event):
        train = event.train
        station = event.station
        next_station = self.simulation.get_station_by_id(station.station_id + 1) if train.direction == "southbound" else self.simulation.get_station_by_id(station.station_id - 1)
        departure_time = event.time
        next_segment = station.get_next_segment(train.direction)
        
        # Check for resource availability
        if next_station.platforms[train.direction] is None and next_segment.is_available():
            #======= HANDLE TRAIN STATUS & TRAVEL TIME =======#
            train_status = "active"
            if train.last_departure_time is None:
                travel_time = 0 # Initial departure has 0 travel time for this leg
                train.arrival_time = departure_time - timedelta(seconds=self.simulation.dwell_time)
            else: 
                travel_time = train.current_journey_travel_time
            
            #======= BOARD/ALIGHT PASSENGERS =======#
            alighted, boarded = station.process_passenger_exchange(
                train, 
                train_arrival_time=train.arrival_time, 
                train_departure_time=departure_time
            )
            
            #print(
            #    "\nPassengers",
            #    "\nAlighted:", alighted,
            #    "\nBoarded:", boarded
            #)
            
            #======= RECORD TO TIMETABLE =======#
            self._record_timetable_entry(
                train=train, 
                station=station, 
                arrival_time = train.arrival_time,
                departure_time = departure_time, 
                travel_time=travel_time, # Use calculated travel_time
                train_status=train_status, # Pass the status
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
            print(
                f"\nRESCHEDULE: {event.time}\nCURRENT Station: {station.station_id} "
                f"| Train: {train.train_id} | Next Platform Occupied by: "
                f"{next_station.platforms[train.direction].train_id if next_station.platforms[train.direction] is not None else None} "
                f"| Segment {next_segment.segment_id}, Available: {next_segment.is_available()}"
            )

            # Calculate the earliest required departure time based on original schedule and conflicts
            required_departure_time = event.time # Start with the original scheduled time
            buffer_time_conflict = timedelta(seconds=10) # Small buffer for conflict resolution

            # Check platform conflict at the NEXT station
            if next_station.platforms[train.direction] is not None:
                preceding_train = next_station.platforms[train.direction]
                # Required time is when preceding train ARRIVES + DWELL + BUFFER
                # We need the arrival time of the preceding train at the *next* station
                # This information might not be directly available on the train object easily
                # Let's stick to last_departure_time + headway for now, but note this limitation.
                # Alternative: Use a simpler, potentially overly conservative approach if arrival isn't tracked well
                if preceding_train.last_departure_time: # Fallback to previous logic if arrival not readily available
                    station_clear_time = preceding_train.last_departure_time + timedelta(minutes=self.simulation.active_headway)
                    required_departure_time = max(required_departure_time, station_clear_time)
                    print(f"Due to station {next_station.station_id} Occupied by {preceding_train.train_id}, requires departure after {station_clear_time} (using headway fallback)")

            # Check segment conflict for the NEXT segment
            if next_segment.occupied_by is not None:
                preceding_train_on_segment = next_segment.occupied_by
                # Required time is when the segment is expected to be free (next_available) + BUFFER
                if next_segment.next_available: 
                    segment_clear_time = next_segment.next_available + buffer_time_conflict
                    required_departure_time = max(required_departure_time, segment_clear_time)
                    print(f"Due to segment {next_segment.segment_id} Occupied by {preceding_train_on_segment.train_id}, requires departure after {segment_clear_time}")
                # Fallback if next_available isn't set (shouldn't happen if occupied)
                elif preceding_train_on_segment.last_departure_time: 
                    segment_clear_time = preceding_train_on_segment.last_departure_time + timedelta(minutes=self.simulation.active_headway)
                    required_departure_time = max(required_departure_time, segment_clear_time)
                    print(f"Due to segment {next_segment.segment_id} Occupied by {preceding_train_on_segment.train_id}, requires departure after {segment_clear_time} (using headway fallback)")


            # Check for simultaneous departure conflicts at the CURRENT station
            final_departure_time = required_departure_time
            queue_snapshot = list(self.simulation.event_queue.queue)

            # Keep checking and adjusting until no more simultaneous conflicts exist for the final_departure_time
            while True:
                conflict_found = False
                for _, existing_event in queue_snapshot:
                    # Check for departure events from the same station by a different train at the exact same time
                    if (existing_event.time == final_departure_time and
                        existing_event.event_type == "train_departure" and
                        existing_event.station == station and
                        existing_event.train != train):
                        
                        original_conflict_time = final_departure_time
                        final_departure_time += timedelta(seconds=10) # Add 10s delay
                        print(f"-> Simultaneous departure conflict detected at {original_conflict_time}. Adding 10s delay for train {train.train_id}.")
                        conflict_found = True
                        break # Re-check the queue with the new time

                if not conflict_found:
                    break # Exit the while loop if no conflict was found in this pass

            print(f"-> Final rescheduled departure for train {train.train_id} at station {station.station_id} is {final_departure_time}")

            # Reschedule the event with the final calculated time.
            self.simulation.schedule_event(
                Event(
                    time=final_departure_time,
                    event_type="train_departure",
                    train=train,
                    station=station,
                )
            )

            if event.time == final_departure_time:
                print("LOOPING ERROR STARTS ENDING HERE")
                self.simulation.event_queue = PriorityQueue()
            
    def _handle_turnaround(self, event):
        train = event.train
        station = event.station
        departure_time = event.time
        
        # Record Arrival before Turnaround
        self._record_timetable_entry(
                train=train, 
                station=station, 
                arrival_time = train.arrival_time,
                departure_time = departure_time, 
                travel_time= train.current_journey_travel_time,
                train_status="active", # Set status to active
                boarded=0, 
                alighted=0
            )
        
        # Clear Station Platform
        station.platforms[train.direction] = None
        
        # Change train direction
        train.change_direction()
        
        if event.time <= self.simulation.end_time:
            train.arrival_time = departure_time + timedelta(seconds=self.simulation.turnaround_time)
            train.current_journey_travel_time = self.simulation.turnaround_time
            departure_time = train.arrival_time + timedelta(seconds=self.simulation.dwell_time)
            self.simulation.schedule_event(
                Event(
                    departure_time, 
                    event_type="train_departure", 
                    train=train, 
                    station=station
                    )
                )
            
    def _handle_segment_enter(self, event):
        train = event.train
        segment = event.segment
        station = train.current_station
        next_station = event.station
        current_time = event.time

            
        if segment.enter(train):    # Successfully entered segment
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

class Simulation:
    def __init__(self, csv_filename, config):
        self.simulation_id = None
        self.passenger_data_file = csv_filename
        self.config = config
        self.is_staging = False

        self.start_time = None
        self.end_time = None
        self.current_time = None
        self.dwell_time = config["dwellTime"]
        self.turnaround_time = config["turnaroundTime"]
        
        self.trains = []
        self.stations = []
        self.track_segments = []
        self.passengers = []##########
        self.passenger_demand = []
        self.timetables = []
        self.service_periods = None
        self.active_trains = []
        self.active_headway = 0
        self.trains_to_withdraw_count = 0
        
        self.event_queue = PriorityQueue()
        self.event_handler = EventHandler(self)

        self.timetables = []
    
    def initialize(self, scheme_type):
        self.stations.clear()
        self.track_segments.clear()
        self.trains.clear()
        self.service_periods = None
        self.active_trains = []
        self.active_headway = 0
        self.trains_to_withdraw_count = 0
        self.event_queue = PriorityQueue()
        self.timetables.clear()


        self._initialize_stations(scheme_type)
        self._initialize_track_segments() # Track segments are the same for all schemes
        self._initialize_trains(scheme_type)
        self._initialize_service_periods(scheme_type)

        if scheme_type != "Regular":
            print(f"\nLOOP TIME A: {timedelta(seconds=self.calculate_loop_time(self.trains[1]))}")
            print(f"\nLOOP TIME B: {timedelta(seconds=self.calculate_loop_time(self.trains[2]))}")
        self._initialize_passengers_demand()
        # print([t.train_id for t in self.trains])
        # print([s.station_id for s in self.stations])
        # print([ts.segment_id for ts in self.track_segments])
        # print(self.service_periods)
        
        self.is_staging = True

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
        
        # Set initial simulation time based on config
        self.current_time = self.start_time
        
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
        print(f"\tCREATED SIMULATION ENTRY IN DB WITH ID: {self.simulation_id}")

    def _initialize_stations(self, scheme_type):
        print("\n[INITIALIZING STATIONS]")
        self.stations.clear()
        station_names = self.config["stationNames"]
        num_stations = len(station_names)
        station_types = DEFAULT_SCHEME

        for station_id, (station_name, station_type) in enumerate(zip(station_names, station_types), start=1):
            self.stations.append(
                Station(
                    station_id=station_id,
                    name=station_name,
                    zone_length=DEFAULT_ZONE_LENGTH, # Assuming DEFAULT_ZONE_LENGTH is available
                    station_type="AB" if scheme_type == "Regular" else station_type,
                    is_terminus=station_id == 1 or station_id == num_stations
                )
            )

        if not debug and not self.is_staging: 
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
                    print(f"\tATTEMPTED TO CREATE {len(stations_for_db)} STATIONS IN DB. SUCCESSFULLY INSERTED: {result} ROWS")
                except Exception as e:
                    print(f"\tERROR during stations bulk insert: {e}")

    def _initialize_track_segments(self):
        print("\n[INITIALIZING TRACK SEGMENTS]")
        station_distances = self.config['stationDistances']
        station_count = len(self.config['stationNames'])
        
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

        if not debug and not self.is_staging:
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
                    print(f"\tATTEMPTED TO CREATE {len(segments_for_db)} TRACK SEGMENTS IN DB. SUCCESSFULLY INSERTED: {result} ROWS")
                except Exception as e:
                    print(f"\tERROR during track_segments bulk insert: {e}")

    def _initialize_trains(self, scheme_type):
        print("\n[INITIALIZING TRAINS & TRAIN_SPEC(s)]")
        
        train_count = 0
        for period in DEFAULT_SERVICE_PERIODS:
            train_count = max(train_count, period['train_count'])

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
                    service_type="AB" if scheme_type == "Regular" else "B" if train_id % 2 == 0 else "A",
                    current_station=self.stations[0] # All trains start at North Avenue (Station 1)
                )
            )

        if not debug and not self.is_staging:
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
                print(f"\tSUCCESSFULLY CREATED TRAIN SPECS ENTRY IN DB WITH ID: {train_specs_entry_id}")
            except Exception as e:
                print(f"\tERROR during train_specs upsert/create: {e}")
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
                        print(f"\tATTEMPTED TO CREATE {len(trains_for_db)} TRAINS IN DB. SUCCESSFULLY INSERTED: {result} ROWS")
                    except Exception as e:
                        print(f"\tERROR during trains bulk insert: {e}")

    def _initialize_service_periods(self, scheme_type):
        print("\n[INITIALIZING SERVICE PERIODS]")
        self.service_periods = DEFAULT_SERVICE_PERIODS

        loop_time = int(self.calculate_loop_time(self.trains[0]) / 60)  # Loop Time in minutes
        print(f"\tLOOP TIME: {timedelta(minutes=loop_time)}")
        for i, period in enumerate(self.service_periods):
            period["headway"] = custom_round(loop_time / period["train_count"])

            # Schedule service period start event
            start_datetime = datetime.combine(
                self.current_time.date(),
                time(hour=period["start_hour"], minute=0, second=0),
            )  # Set the datetime by the period start hour in config
            
            if i != 0:
                start_datetime -= timedelta(minutes=30)

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
                    "Name": period["name"],
                    "Train Count": period["train_count"],
                    "Headway": period["headway"],
                }
                for period in self.service_periods
            ]
        )

        # Convert to string, split lines, and add tab prefix
        indented_df_string = '\n'.join(['\t' + line for line in df_periods.to_string().splitlines()])

        # Print the result
        print("\tService Periods:")
        print(indented_df_string)
        print("\n") # Add a final newline if desired

        # Update the SERVICE_PERIODS field in the database with calculated headways
        if not debug:
            loop_time_column = 'REGULAR_LOOP_TIME_MINUTES' if scheme_type == 'Regular' else 'SKIP_STOP_LOOP_TIME_MINUTES'
            try:
                updated_service_periods_json = json.dumps(self.service_periods)
                db.simulations.update(
                    where={'SIMULATION_ID': self.simulation_id},
                    data={'SERVICE_PERIODS': updated_service_periods_json, loop_time_column: loop_time}
                )
                print(f"\tSUCCESSFULLY updated SERVICE_PERIODS in DB for SIMULATION_ID: {self.simulation_id}")
                print(f"\tSUCCESSFULLY updated {loop_time_column} in DB for SIMULATION_ID: {self.simulation_id}")
            except Exception as e:
                print(f"\tERROR updating SERVICE_PERIODS in DB for SIMULATION_ID: {self.simulation_id}: {e}")

    def _initialize_passengers_demand(self):
        print("\n[INITIALIZING PASSENGERS DEMAND]")
        station_type_map = {s.station_id: s.station_type for s in self.stations}
        valid_station_ids = set(station_type_map.keys())
        
        file_path = UPLOAD_FOLDER + "\\" + self.passenger_data_file
        df = pd.read_csv(file_path)
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
        melted_df['SIMULATION_ID'] = self.simulation_id
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
        
    def schedule_event(self, event):
        """Add an event to the priority queue."""
        self.event_queue.put((event.time, event))  # Use (priority, item) format

    def run(self):
        """Run the simulation until the end time."""
        print("Simulation running...")
        start_run_time = py_time.perf_counter() # Record start time
        schemes = ["Regular", "Skip-stop"] # Add Skip-stop
        self._create_simulation_entry()
        #'''
        for scheme_type in schemes:
            try:
                self.initialize(scheme_type)

                while self.current_time < self.end_time and not self.event_queue.empty():
                    priority, event = self.event_queue.get()  # Get the next event
                    # Ensure we don't process events past the end time
                    if event.time >= self.end_time:
                        self.current_time = event.time # Update time but don't process
                        continue # Skip processing this event

                    self.current_time = event.time
                    self.event_handler.process_event(event)

                # Indicate success for this simulation ID run
                print(f"Simulation for ID {self.simulation_id} completed up to {self.current_time}.")
                print(f"Generated {len(self.timetables)} TRAIN_MOVEMENTS entries.")

                # Save results before potentially moving to the next simulation_id or disconnecting
                self.save_timetable_to_db()

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
        #'''
        end_run_time = py_time.perf_counter() # Record end time
        run_duration = end_run_time - start_run_time
        print(f"Total simulation run() execution time: {run_duration:.4f} seconds")

        # Disconnect shared Prisma client after all simulations in the queue are attempted or completed
        if not debug and db.is_connected():
            print("Disconnecting shared DB client after simulation run.")
            db.disconnect()

    def save_timetable_to_db(self):
        """Formats timetable entries and bulk inserts them into the TRAIN_MOVEMENTS table."""
        if not self.timetables:
            print("No timetable entries generated to save.")
            return

        if not db.is_connected():
            print("Error: Database is not connected. Cannot save timetable.")
            # Optionally try to reconnect if desired, but better practice is to save before disconnect.
            # try:
            #     db.connect()
            # except Exception as e:
            #     print(f"Failed to reconnect to DB: {e}")
            #     return
            return


        print(f"Preparing {len(self.timetables)} timetable entries for database insertion...")
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
                "SIMULATION_ID": self.simulation_id, # Add simulation ID for context
                "SERVICE_TYPE": entry.service_type,
                "TRAIN_ID": entry.train_id,
                "STATION_ID": entry.station_id,
                "DIRECTION": entry.direction,
                "TRAIN_STATUS": entry.train_status,
                "ARRIVAL_TIME": entry.arrival_time,
                "DEPARTURE_TIME": departure_time_db,
                "TRAVEL_TIME_SECONDS": travel_time_db, 
                "PASSENGERS_BOARDED": entry.passengers_boarded,
                "PASSENGERS_ALIGHTED": entry.passengers_alighted,
                "CURRENT_STATION_PASSENGER_COUNT": entry.current_station_passenger_count,
            }
            data_to_insert.append(data)

        if skipped_count > 0:
            print(f"Skipped {skipped_count} entries due to missing time data.")

        if not data_to_insert:
            print("No valid entries remaining to insert after filtering.")
            return

        try:
            print(f"Attempting to insert {len(data_to_insert)} entries into TRAIN_MOVEMENTS...")
            # Ensure you have imported 'db' from your Prisma client setup
            result = db.train_movements.create_many(
                data=data_to_insert,
                skip_duplicates=True  # Prevent errors if an identical entry exists (adjust if needed)
            )
            print(f"Successfully inserted {result} records into TRAIN_MOVEMENTS.")
        except Exception as e:
            print(f"Error inserting timetable data into database: {e}")
            # Consider logging the failed data or implementing retry logic if necessary

    def get_station_by_id(self, station_id):
        """Fast O(1) station lookup by ID."""
        return next((s for s in self.stations if s.station_id == station_id), None)
    
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

            total_time += traversal_time + dwell_time
            current_station = next_station

        # Loop back until reach intial
        # Reset stations
        #current_station = next_station
        
        # Main Loop again back towards it
        while True:
            next_station = get_next_station(current_station, direction)

            # Check if its base destination if its looped to starting position
            if next_station == start_station:
                # if starting station has been hit.

                segment = get_segment(current_station, next_station, direction)

                if segment is None:  # Handle cases where station and segment are missing
                    raise ValueError(f"Could not find segment between {current_station.station_id} and {next_station.station_id} ({direction}).")
                    break  # Exit loop due to missing segment

                # Check if need to perform a stop at that segment
                stops = next_station.should_stop(train)  # can change to passenger exchange logic

                segment_distance = segment.distance #get distance from each of the available stations
                traversal_time = segment.calculate_traversal_time(train, stops, segment_distance)

                total_time += traversal_time + dwell_time  # loop back for complete calculations
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
            
            total_time += traversal_time + dwell_time
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
    debug = False
    sample_config = {
        'acceleration': 0.8, 
        'deceleration': 0.8, 
        'dwellTime': 60, 
        'maxCapacity': 1182, 
        'maxSpeed': 60, 
        'turnaroundTime': 180, 
        'stationNames': ['North Avenue', 'Quezon Avenue', 'GMA-Kamuning', 'Cubao', 'Santolan-Annapolis', 'Ortigas', 'Shaw Boulevard', 'Boni Avenue', 'Guadalupe', 'Buendia', 'Ayala', 'Magallanes', 'Taft Avenue'], 
        'stationDistances': [1.2, 1.1, 1.8, 1.5, 1.4, 0.9, 1, 1.1, 1.3, 1, 1.2, 1.7]
        }
    test_sim = Simulation("4-12-23-SAMPLE-minute-level.csv", sample_config)

    test_sim.run()

    simulation_instance = instance_df(test_sim)
    stations = instances_to_df(test_sim.stations)
    track_segments = instances_to_df(test_sim.track_segments)
    trains = instances_to_df(test_sim.trains)
    service_periods = test_sim.service_periods

    print("\nSimulation script finished.")

