import pandas as pd
import numpy as np
from datetime import datetime, time, timedelta
from queue import PriorityQueue
start_timee = datetime.now()
class TimetableEntry:
    def __init__(self,
                train_id,
                service_type,
                station_id,
                arrival_time,
                departure_time,
                travel_time,
                direction,
                passengers_boarded,
                passengers_alighted,
                trip_count,
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
        self.train_id = train_id
        self.service_type = service_type
        self.station_id = station_id
        self.arrival_time = arrival_time
        self.departure_time = departure_time
        self.travel_time = travel_time
        self.direction = direction
        self.passengers_boarded = passengers_boarded
        self.passengers_alighted = passengers_alighted
        self.trip_count = trip_count
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
    def __init__(self, train_id, train_specs, service_type="AB"):
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
        
        self.direction = None
        self.current_station = None
        self.trip_count = 0
        self.turnaround_status = None##
        self.status = "inactive" # Added train status
        
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
    def __init__(self, time, event_type, period=None, train=None, station=None, segment=None):
        """
        Initialize a Simulation Event

        Args:
            time = time
            event_type = event_type  # e.g., "train_arrival", "train_departure", "segment_enter", "segment_exit"
            train = train
            station = station
            
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
                train.status = "active"  # Set status to active on deployment
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
                                travel_time=None, boarded=0, alighted=0,
                                train_status=None):
            """Centralized method to log timetable entries."""
            entry = TimetableEntry(
                train_id= train.train_id,
                service_type = train.service_type,
                station_id = station.station_id,
                arrival_time = arrival_time,
                departure_time = departure_time,
                travel_time = travel_time,
                direction = train.direction,
                passengers_boarded = boarded,
                passengers_alighted = alighted,
                trip_count = train.trip_count,
                train_status = train_status
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
            
            #print(f"\n--- Train Withdrawal Process Start (Time: {arrival_time}) ---")
            #print(f"Train {train.train_id} arrived at Station 1 northbound and is targeted for withdrawal.")
            #print(f"Required withdrawal count: {self.simulation.trains_to_withdraw_count}")
            #print(f"Active trains BEFORE withdrawal: {[t.train_id for t in self.simulation.active_trains]}")

            # Remove train from active list
            if train in self.simulation.active_trains:
                self.simulation.active_trains.remove(train)
                # Decrement withdrawal counter
                self.simulation.trains_to_withdraw_count -= 1
                # Set status before recording final entry
                train.status = "inactive"
                #print(f"Successfully withdrew Train {train.train_id}.")
                #print(f"Active trains AFTER withdrawal: {[t.train_id for t in self.simulation.active_trains]}")
                #print(f"Remaining trains to withdraw: {self.simulation.trains_to_withdraw_count}")
                
                # Calculate the potential departure time (arrival + dwell)
                potential_departure_time = arrival_time + self.simulation.dwell_time
                
                # Record final arrival but do not schedule turnaround/departure
                self._record_timetable_entry(
                    train=train, 
                    station=station, 
                    arrival_time=arrival_time, 
                    departure_time=potential_departure_time, # Use calculated time instead of "WITHDRAWN"
                    travel_time=timedelta(seconds=int(train.current_journey_travel_time)), # Log final travel time
                    train_status=train.status # Pass inactive status
                )
                # Clear the platform the train arrived on
                station.platforms[train.direction] = None
            else:
                print(f"WARNING: Train {train.train_id} was targeted for withdrawal upon arrival but not found in active_trains list.")
            
            #print(f"--- Train Withdrawal Process End ---")
            # DO NOT schedule next event (turnaround) for this train.
            return 
        # === END WITHDRAWAL CHECK ===
        
        # --- Normal Arrival Processing (If not withdrawn) ---
        # Calculate departure time based on dwell time
        departure_time = arrival_time + self.simulation.dwell_time
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
            #======= HANDLE NEWLY INSERTED TRAINS =======#
            if train.last_departure_time is None:
                travel_time = "INITIAL DEPARTURE"
                train.arrival_time = departure_time - self.simulation.dwell_time
            else: 
                travel_time = timedelta(seconds=int(train.current_journey_travel_time))
            
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
                travel_time=travel_time,
                boarded=boarded, 
                alighted=alighted,
                train_status=train.status # Pass current train status
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
            #print(
            #    f"\nRESCHEDULE: {event.time}\nCURRENT Station: {station.station_id} "
            #    f"| Train: {train.train_id} | Next Platform Occupied by: "
            #    f"{next_station.platforms[train.direction].train_id if next_station.platforms[train.direction] is not None else None} "
            #    f"| Segment {next_segment.segment_id}, Available: {next_segment.is_available()}"
            #)

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
                    #print(f"Due to station {next_station.station_id} Occupied by {preceding_train.train_id}, requires departure after {station_clear_time} (using headway fallback)")

            # Check segment conflict for the NEXT segment
            if next_segment.occupied_by is not None:
                preceding_train_on_segment = next_segment.occupied_by
                # Required time is when the segment is expected to be free (next_available) + BUFFER
                if next_segment.next_available: 
                    segment_clear_time = next_segment.next_available + buffer_time_conflict
                    required_departure_time = max(required_departure_time, segment_clear_time)
                    #print(f"Due to segment {next_segment.segment_id} Occupied by {preceding_train_on_segment.train_id}, requires departure after {segment_clear_time}")
                # Fallback if next_available isn't set (shouldn't happen if occupied)
                elif preceding_train_on_segment.last_departure_time: 
                    segment_clear_time = preceding_train_on_segment.last_departure_time + timedelta(minutes=self.simulation.active_headway)
                    required_departure_time = max(required_departure_time, segment_clear_time)
                    #print(f"Due to segment {next_segment.segment_id} Occupied by {preceding_train_on_segment.train_id}, requires departure after {segment_clear_time} (using headway fallback)")


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
                        #print(f"-> Simultaneous departure conflict detected at {original_conflict_time}. Adding 10s delay for train {train.train_id}.")
                        conflict_found = True
                        break # Re-check the queue with the new time

                if not conflict_found:
                    break # Exit the while loop if no conflict was found in this pass

            #print(f"-> Final rescheduled departure for train {train.train_id} at station {station.station_id} is {final_departure_time}")

            # Reschedule the event with the final calculated time.
            self.simulation.schedule_event(
                Event(
                    time=final_departure_time,
                    event_type="train_departure",
                    train=train,
                    station=station,
                )
            )         
            
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
                travel_time=timedelta(seconds=int(train.current_journey_travel_time)),
                boarded=0, 
                alighted=0,
                train_status=train.status # Pass current train status
            )
        
        # Clear Station Platform
        station.platforms[train.direction] = None
        
        # Change train direction
        train.change_direction()
        
        if event.time <= self.simulation.end_time:
            train.arrival_time = departure_time + self.simulation.turnaround_time
            train.current_journey_travel_time = self.simulation.turnaround_time.total_seconds()
            departure_time = train.arrival_time + self.simulation.dwell_time
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
    def __init__(self, start_time, end_time, config):
        self.current_time = start_time
        self.end_time = end_time
        self.config = config
        self.dwell_time = timedelta(seconds=self.config['dwell_time'])
        self.turnaround_time = timedelta(seconds=self.config['turnaround_time'])
        
        self.trains = []
        self.stations = []
        self.track_segments = []
        self.passengers = []
        self.timetables = []
        self.service_periods = self.config['service_periods']
        self.active_trains = []
        self.active_headway = 0
        self.trains_to_withdraw_count = 0 # Khen
        
        self.event_queue = PriorityQueue()
        self.event_handler = EventHandler(self)
    
    def initialize(self):
        """Set up simulation components."""
        self._initialize_stations()
        self._initialize_trains()
        self._initialize_track_segments()
        self._initialize_passengers()
        self._initialize_service_periods()
        # Begin initial scheduling events
        #self._schedule_initial_departure()

    def _parse_od_matrix(self, file_path):
        """Parse the OD matrix CSV file into northbound and southbound dataframes."""
        #start_time = time.time()
        
        # Read the CSV file
        df = pd.read_csv(file_path)
        
        # Drop unnecessary columns
        drop_cols = ['Month', 'Day', 'Hour', 'Year', 'Holiday', 
                    'Morning_Peak', 'Afternoon_Peak', 'Weekday', 'Weekend']
        df = df.drop(columns=drop_cols, errors='ignore')
        
        # Initialize empty lists for column classification
        southbound_cols = ['DateTime'] if 'DateTime' in df.columns else []
        northbound_cols = ['DateTime'] if 'DateTime' in df.columns else []
        
        # Classify columns into northbound and southbound
        for col in df.columns:
            if ',' in col:
                parts = col.strip('"').split(',')
                if len(parts) == 2:
                    origin, destination = int(parts[0]), int(parts[1])
                    if origin > destination:
                        northbound_cols.append(col)
                    elif origin < destination:
                        southbound_cols.append(col)
        
        # Create separated dataframes
        northbound = df[northbound_cols]
        southbound = df[southbound_cols]
        
        # Print processing time and trip totals
        #elapsed_time = time.time() - start_time
        #print(f"Data separation completed in {elapsed_time:.4f} seconds")
        
        datetime_offset = 1 if 'DateTime' in df.columns else 0
        northbound_sum = northbound.iloc[:, datetime_offset:].values.sum()
        southbound_sum = southbound.iloc[:, datetime_offset:].values.sum()
        
        ######################################
        print(f"Total northbound trips: {northbound_sum}")
        print(f"Total southbound trips: {southbound_sum}")
        station1_passengers = 0

        # Check northbound and southbound DataFrames
        for df in [northbound, southbound]:
            # Filter columns where origin = 1 (e.g., "1,2", "1,3")
            station1_cols = [
                col for col in df.columns 
                if ',' in col and int(col.strip('"').split(',')[0]) == 1
            ]
            
            # Sum all values in these columns
            station1_passengers += df[station1_cols].sum().sum()

        print(f"\nTotal passengers originating from Station 1: {station1_passengers}\n")
        #######################################
        return northbound, southbound
    
    def _initialize_passengers(self):
        """Generate passengers from OD matrix and assign them to pre-initialized stations."""
        northbound, southbound = self._parse_od_matrix(self.config['passenger_csv'])
        passenger_id = 1  # Track passenger IDs

        # Process northbound and southbound data
        for df in [northbound, southbound]:
            for idx, row in df.iterrows():
                # Get current time for this row
                current_time = (
                    pd.to_datetime(row['DateTime']) 
                    if 'DateTime' in df.columns 
                    else self.current_time + timedelta(minutes=idx)
                )

                # Process each OD pair column
                for col in df.columns:
                    if ',' in col and row[col] > 0:
                        origin, dest = map(int, col.strip('"').split(','))
                        num_passengers = int(row[col])

                        # Validate origin exists
                        if origin < 1 or origin > len(self.stations):
                            #print(f"⚠️ Error: Origin {origin} is invalid. Skipping {num_passengers} passengers.")
                            continue

                        # Add passengers to station's waiting queue
                        station = self.stations[origin - 1]  # Stations are 0-indexed
                        for _ in range(num_passengers):
                            passenger = Passenger(
                                passenger_id=passenger_id,
                                origin_station_id=origin,
                                destination_station_id=dest,
                                arrival_time=current_time
                            )
                            passenger_id += 1
                            self.passengers.append(passenger)
                            station.waiting_passengers.append(passenger)
        
        for passenger in self.passengers:
            passenger.direction = "southbound" if passenger.origin_station_id < passenger.destination_station_id else "northbound"
            # Assign Passenger service type
            for station in self.stations:
                if station.station_id == passenger.destination_station_id:
                    passenger.service_type = station.station_type
                    break
        
        # Check for transfers
        for passenger in self.passengers:
            origin = self.get_station_by_id(passenger.origin_station_id)
            destination = self.get_station_by_id(passenger.destination_station_id)
            if destination.station_type == "AB" or origin.station_type == "AB" or origin.station_type == destination.station_type:
                passenger.trip_type = "direct"
                
        
        print(len([passenger.arrival_time for passenger in self.passengers if datetime(2023, 4, 12, 7, 0) <= passenger.arrival_time <= datetime(2023, 4, 12, 7, 3)]))
        print(f"✅ Generated {len(self.passengers)} passengers\n")
        print(f"Sample check - Station 1 has {len(self.stations[0].waiting_passengers)} waiting passengers\n")

    def _initialize_stations(self):
        """Create station objects."""
        named_stations = self.config['named_stations']
        zone_length = self.config["station_zone_length"]
        
        if self.config['scheme'] == "Regular":
            for station_id, station_name in enumerate(named_stations):
                self.stations.append(
                    Station(
                        station_id=station_id + 1, 
                        name=station_name, 
                        )
                    )
        else:
            for station_id, station in enumerate(zip(named_stations, self.config['scheme'])):
                self.stations.append(
                    Station(
                        station_id=station_id + 1,
                        name=station[0], 
                        zone_length=zone_length,
                        station_type=station[1]
                        )
                    )
        
        self.stations[0].is_terminus = True
        self.stations[-1].is_terminus = True
        
        #print("Initialized Stations\n", pd.DataFrame([{"Station": station.station_id, "name": station.name, "Type": station.station_type, "is_Terminus": station.is_terminus} for station in self.stations]), '\n')

    def _initialize_trains(self):
        """Create train objects."""
        train_count = self.config['total_trains']
        train_specs = self.config['train_specs']
        
        if self.config['scheme'] == "Regular":
            for train_id in range(1, train_count + 1):
                self.trains.append(Train(train_id, train_specs))
        else:
            for train_id in range(1, train_count + 1):
                scheme_type  = "B" if train_id % 2 == 0 else "A"
                self.trains.append(Train(train_id, train_specs, scheme_type))
        
        # All trains initially start from Station 1 (North Avenue) going southbound
        for train in self.trains:
            train.current_station = self.stations[0]
            train.direction = "southbound"
            
        #print("Initialized Trains\n", pd.DataFrame([{"ID": t.train_id, "Type": t.service_type, "Station": t.current_station.station_id, "Direction": t.direction} for t in self.trains]), '\n')

    def _initialize_track_segments(self):
        """Create track segment objects."""
        station_distances = self.config['station_distances']
        
        # Southbound Segments
        for i, distance in enumerate(station_distances):
            self.track_segments.append(
                TrackSegment(
                    start_station_id=self.stations[i].station_id, 
                    end_station_id=self.stations[i+1].station_id, 
                    distance=distance * 1000, # from km to m
                    direction="southbound"
                    )
                )
        # Northbound Segments
        for i, distance in enumerate(reversed(station_distances)):
            self.track_segments.append(
                TrackSegment(
                    start_station_id=self.stations[-(i+1)].station_id, 
                    end_station_id=self.stations[-(i+2)].station_id, 
                    distance=distance * 1000, # from km to m
                    direction="northbound"
                    )
                )
        
        # Link segments to stations
        for ts in self.track_segments:
            for station in self.stations:
                if station.station_id == ts.start_station_id:
                    station.tracks[ts.direction] = ts
        
        #print("Initialized Track Segments\n", pd.DataFrame({"Segment_ID": ts.segment_id, "Length": ts.distance, "Direction": ts.direction} for ts in self.track_segments), '\n')
    
    def _initialize_service_periods(self):
        def custom_round(x):
            if x > int(x) + 0.5:
                return int(x) + 1
            elif x < int(x) + 0.5:
                return int(x)
            else:
                return x

        loop_time = int(self.calculate_loop_time(self.trains[0]) / 60)  # Loop Time in minutes
        
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

        # Print service period for validation
        print("Initialized Service Periods")
        print(
            pd.DataFrame(
                [
                    {
                        "Name": period["name"],
                        "Train Count": period["train_count"],
                        "Headway": period["headway"],
                    }
                    for period in self.service_periods
                ]
            ),
            "\n",
        )
        
    def schedule_event(self, event):
        """Add an event to the priority queue."""
        self.event_queue.put((event.time, event))  # Use (priority, item) format

    def run(self):
        """Run the simulation until the end time."""
        while self.current_time < self.end_time and not self.event_queue.empty():
            priority, event = self.event_queue.get()  # Get the next event 
            self.current_time = event.time
            self.event_handler.process_event(event)
            
    def get_station_by_id(self, station_id):
        """Fast O(1) station lookup by ID."""
        return next((s for s in self.stations if s.station_id == station_id), None)
    
    def calculate_loop_time(self, train):
        """
        Calculate the total loop time for a train, including turnaround time, 
        returning to the original starting station.

        Args:
            train (Train): The train for which to calculate the loop time.

        Returns:
            float: Theoretical minimum loop time in seconds for the entire loop.
        """
        # Get starting properties
        total_time = 0
        start_station = train.current_station
        current_station = train.current_station
        direction = train.direction
        stations = self.stations
        dwell_time = self.dwell_time.total_seconds()
        
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

                total_time += self.turnaround_time.total_seconds() # add turnaround

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

        # Final
        print(timedelta(seconds=total_time))
        return total_time
    
    def get_station_by_id(self, station_id):
        """Fast O(1) station lookup by ID."""
        return next((s for s in self.stations if s.station_id == station_id), None)

def get_datetime_from_csv(csv_file_path):
    """
    Reads the first data row from a CSV, extracts Year, Month, and Day,
    and returns a datetime object.

    Args:
        csv_file_path (str): The path to the CSV file.

    Returns:
        datetime or None: The datetime object from the first data row,
                        or None if the file is empty, columns are missing,
                        or the date is invalid.
    """
    try:
        # Read only the first row of data (after the header)
        df = pd.read_csv(csv_file_path, nrows=1)

        # Check if the DataFrame is not empty (in case the file only had a header)
        if df.empty:
            print(f"Warning: CSV file '{csv_file_path}' appears to be empty (only contains a header).")
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
            print(f"Error: Missing Year, Month, or Day column in CSV file '{csv_file_path}'.")
            return None

        # Create the datetime object for the first row
        # Use errors='coerce' for robustness
        # Convert to integer first to avoid type issues with pd.to_datetime if columns have mixed types
        try:
            year = int(year)
            month = int(month)
            day = int(day)
            first_datetime = pd.to_datetime({'year': [year], 'month': [month], 'day': [day]}, errors='coerce').iloc[0]
        except (ValueError, TypeError):
            print(f"Error: Invalid date values in the first row of '{csv_file_path}'.")
            return None


        # Check if the conversion was successful (not NaT)
        if pd.notna(first_datetime):
            return first_datetime
        else:
            print(f"Error: Could not create a valid datetime from the first row of '{csv_file_path}'. Invalid date combination ({year}-{month}-{day}).")
            return None

    except FileNotFoundError:
        print(f"Error: File not found at '{csv_file_path}'.")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while processing '{csv_file_path}': {e}")
        return None

''' DEFAULT CONFIGURATION '''
# Operating Hours - These will be overridden by API based on CSV date and fixed times
# simulation_date = get_datetime_from_csv('4-12-23-SAMPLE-minute-level.csv') # Remove direct call
# start_time = datetime.combine(
#                 simulation_date.date(),
#                 time(hour=5, minute=0)
#             )
# end_time = datetime.combine(
#                 simulation_date.date(),
#                 time(hour=22, minute=0)
#             )

# Rename input_config to DEFAULT_CONFIG
DEFAULT_CONFIG = {
    # Station Parameters
    'named_stations': [
        "North Avenue",
        "Quezon Avenue",
        "GMA Kamuning",
        "Araneta-Cubao",
        "Santolan-Annapolis",
        "Ortigas",
        "Shaw Boulevard",
        "Boni Avenue",
        "Guadalupe",
        "Buendia",
        "Ayala",
        "Magallanes",
        "Taft"
    ],
    'station_distances': [1.2, 1, 1.9, 1.5, 2.3, 0.8, 1.1, 1, 1.8, 1, 1.2, 2],
    #'scheme': ["AB", "A", "AB", "B", "AB", "A", "AB", "B", "AB", "A", "AB", "B", "AB"],
    'station_zone_length': 130, # Platform Length in meters
    'scheme': "Regular",
    #'station_distances': [1.2, 1, 1.9, 1.5],   #
    #'scheme': ["AB", "B", "A", "A", "AB"],          #
    #'named_stations': ["North Avenue", "Quezon Avenue", "GMA Kamuning", "Araneta-Cubao", "Santolan-Annapolis"],
    
    # Train Parameters
    'total_trains': 18, # This might still be needed for loop time calc, but service periods define active trains
    'train_specs': { # Store TrainSpec parameters directly in the dict
        'max_capacity': 1182,
        'cruising_speed': 60, # km/h
        'passthrough_speed': 20, #km/h
        'accel_rate': 1.03, # m/s
        'decel_rate': 1.01 # m/s
    },

    # Passenger Input - CSV path will be provided dynamically
    # "passenger_csv": "4-12-23-SAMPLE-minute-level.csv", # Remove placeholder path
    'service_periods': [
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
    ],
    'dwell_time': 60,  # seconds
    'turnaround_time': 180  # seconds - time needed at terminus stations for trains to switch direction
}

''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''

def instance_df(obj):
    # Extract instance variables from the object
    data = {var_name: var_value for var_name, var_value in obj.__dict__.items()}
    
    # Create a DataFrame
    #df = pd.DataFrame(data)
    
    return data

def format_time(decimal_seconds):
    minutes = int(decimal_seconds // 60)
    seconds = round(decimal_seconds % 60)
    if minutes != 0:
        return f"{minutes} min, {seconds} s"
    else:
        return f"{seconds} s"
        

# New function to run the simulation based on config
def run_simulation_from_config(config, passenger_csv_path, sim_start_time, sim_end_time):
    """
    Initializes and runs the simulation with the provided configuration and time range.

    Args:
        config (dict): The configuration dictionary, potentially merged with overrides.
        passenger_csv_path (str): Path to the passenger data CSV.
        sim_start_time (datetime): The simulation start datetime.
        sim_end_time (datetime): The simulation end datetime.

    Returns:
        pd.DataFrame or None: The resulting timetable DataFrame, or None if simulation fails.
    """
    start_run_time = datetime.now()
    print(f"\n--- Starting Simulation Run ---")
    print(f"Start Time: {sim_start_time}, End Time: {sim_end_time}")
    print(f"Using Passenger Data: {passenger_csv_path}")
    # print("Configuration:")
    # import json # Temporary import for pretty printing
    # print(json.dumps(config, indent=2, default=str)) # Pretty print config, handle non-serializable

    try:
        # --- Create TrainSpec from config ---
        # Ensure train_specs dict exists and has required keys
        if 'train_specs' not in config or not isinstance(config['train_specs'], dict):
            print("Error: 'train_specs' dictionary missing or invalid in config.")
            return None
        required_specs = ['max_capacity', 'cruising_speed', 'passthrough_speed', 'accel_rate', 'decel_rate']
        if not all(spec in config['train_specs'] for spec in required_specs):
            print(f"Error: Missing required keys in 'train_specs'. Required: {required_specs}")
            return None

        try:
            train_specs_instance = TrainSpec(
                max_capacity=int(config['train_specs']['max_capacity']),
                cruising_speed=float(config['train_specs']['cruising_speed']),
                passthrough_speed=float(config['train_specs']['passthrough_speed']),
                accel_rate=float(config['train_specs']['accel_rate']),
                decel_rate=float(config['train_specs']['decel_rate'])
            )
            # Replace the dict in config with the instance for the Simulation class
            config_for_sim = config.copy() # Avoid modifying the original config dict if reused
            config_for_sim['train_specs'] = train_specs_instance
            config_for_sim['passenger_csv'] = passenger_csv_path # Add csv path to config for _initialize_passengers

        except (ValueError, TypeError) as e:
            print(f"Error creating TrainSpec object from config: Invalid value type? {e}")
            return None


        # --- Initialize Simulation ---
        print("Initializing simulation components...")
        simulation_instance = Simulation(
            start_time=sim_start_time,
            end_time=sim_end_time,
            config=config_for_sim # Use the config with TrainSpec instance
        )
        simulation_instance.initialize() # This will call _initialize_passengers using the path in config

        # --- Run Simulation ---
        print("Running simulation events...")
        simulation_instance.run()

        # --- Generate Timetable ---
        print("Generating timetable DataFrame...")
        # Internal helper to generate DataFrame from the simulation instance
        def _generate_timetable_df_internal(sim):
            data = []
            for entry in sim.timetables:
                # Basic validation before appending
                if not all([hasattr(entry, attr) for attr in ['train_id', 'service_type', 'station_id', 'direction', 'passengers_boarded', 'passengers_alighted', 'trip_count', 'train_status']]): # Added train_status check
                    print(f"Warning: Skipping invalid TimetableEntry: {vars(entry)}")
                    continue

                # Format times safely
                arrival_str = None
                if isinstance(entry.arrival_time, datetime):
                    try:
                        arrival_str = entry.arrival_time.strftime('%H:%M:%S')
                    except ValueError: # Handle potential issues like year 0
                        arrival_str = "Invalid Arrival Time"

                departure_str = None
                if isinstance(entry.departure_time, datetime):
                    try:
                        departure_str = entry.departure_time.strftime('%H:%M:%S')
                    except ValueError:
                        departure_str = "Invalid Departure Time"

                # Format travel time safely
                travel_time_str = None
                total_seconds = None # Initialize total_seconds
                if isinstance(entry.travel_time, timedelta):
                    try:
                        total_seconds = int(entry.travel_time.total_seconds())
                        travel_time_str = f"{total_seconds // 3600:02d}:{(total_seconds % 3600) // 60:02d}:{total_seconds % 60:02d}"
                    except OverflowError: # Handle extremely large timedeltas if they occur
                        travel_time_str = "Overflow"
                elif isinstance(entry.travel_time, str): # Handle "INITIAL DEPARTURE"
                    travel_time_str = entry.travel_time

                data.append({
                    "Train ID": entry.train_id,
                    "Service Type": entry.service_type,
                    "NStation": entry.station_id, # Use NStation for consistency? Or keep Station? Let's keep NStation based on frontend use
                    "Direction": entry.direction,
                    "Arrival Time": arrival_str,
                    "Departure Time": departure_str,
                    # Store the string if it's INITIAL DEPARTURE, otherwise store seconds (or null)
                    "Travel Time (s)": travel_time_str if isinstance(entry.travel_time, str) else total_seconds,
                    "Passengers Boarded": entry.passengers_boarded,
                    "Passengers Alighted": entry.passengers_alighted,
                    "Trip Count": entry.trip_count,
                    "Train Status": entry.train_status, # Added train status
                })
                
            if not data:
                print("Warning: No timetable entries were generated.")
                # Return an empty DataFrame with expected columns?
                return pd.DataFrame(columns=["Train ID", "Service Type", "NStation", "Direction", "Arrival Time", "Departure Time", "Travel Time (s)", "Passengers Boarded", "Passengers Alighted", "Trip Count", "Train Status"]) # Added Train Status column
                
            return pd.DataFrame(data)

        timetable_df = _generate_timetable_df_internal(simulation_instance)

        end_run_time = datetime.now()
        elapsed_time = end_run_time - start_run_time
        print(f"Simulation Run Time: {elapsed_time.total_seconds():.4f} seconds")
        print(f"Generated {len(timetable_df)} timetable entries.")
        print("--- Simulation Run Complete ---")
        return timetable_df

    except Exception as e:
        print(f"CRITICAL ERROR during simulation run: {e}")
        import traceback
        traceback.print_exc() # Print detailed traceback for debugging
        return None

# New function to parse passenger data for frontend display
def parse_passenger_data(passenger_csv_path):
    """
    Parses the passenger CSV to get arrival counts per station per hour.
    Returns a dictionary suitable for JSON serialization.
    """
    try:
        df = pd.read_csv(passenger_csv_path)
        print(f"Parsing passenger data from: {passenger_csv_path}")

        # Ensure 'DateTime' column exists and parse it
        if 'DateTime' not in df.columns:
            print("Error: CSV missing 'DateTime' column.")
            # Attempt to use Year, Month, Day, Hour if available
            if all(col in df.columns for col in ['Year', 'Month', 'Day', 'Hour']):
                print("Attempting to construct DateTime from Year, Month, Day, Hour...")
                # Ensure types are numeric before combining
                for col in ['Year', 'Month', 'Day', 'Hour']:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    df = df.dropna(subset=['Year', 'Month', 'Day', 'Hour']) # Drop rows with invalid numeric values
                    df['DateTime'] = pd.to_datetime(df[['Year', 'Month', 'Day', 'Hour']])
            else:
                print("Error: Cannot determine passenger arrival times without 'DateTime' or Y/M/D/H columns.")
                return {"error": "Missing required time columns in CSV"}
        else:
            df['DateTime'] = pd.to_datetime(df['DateTime'])

        # Melt the DataFrame to long format: DateTime, OD_Pair, Count
        id_vars = ['DateTime'] # Add other potential ID vars if they exist
        value_vars = [col for col in df.columns if ',' in col] # OD pair columns
        df_melted = df.melt(id_vars=id_vars, value_vars=value_vars,
                            var_name='OD_Pair', value_name='Count')

        # Filter out zero counts
        df_melted = df_melted[df_melted['Count'] > 0]

        # Extract Origin Station ID
        df_melted['Origin'] = df_melted['OD_Pair'].str.split(',').str[0].str.strip('"').astype(int)

        # Extract Hour
        df_melted['Hour'] = df_melted['DateTime'].dt.hour

        # Group by Origin Station and Hour, sum the counts
        passenger_arrivals = df_melted.groupby(['Origin', 'Hour'])['Count'].sum().reset_index()

        # Pivot for easier frontend consumption: {station_id: {hour: count}}
        arrivals_dict = {}
        for _, row in passenger_arrivals.iterrows():
            station_id = int(row['Origin'])
            hour = int(row['Hour'])
            count = int(row['Count'])
            if station_id not in arrivals_dict:
                arrivals_dict[station_id] = {}
            arrivals_dict[station_id][hour] = count

        print("Successfully parsed passenger arrival data.")
        return arrivals_dict

    except FileNotFoundError:
        print(f"Error: Passenger CSV file not found at '{passenger_csv_path}'.")
        return {"error": "Passenger CSV file not found."}
    except Exception as e:
        print(f"An unexpected error occurred during passenger data parsing: {e}")
        # Consider logging the full traceback here for debugging
        return {"error": f"Failed to parse passenger data: {e}"}