import pandas as pd
from datetime import datetime, time, timedelta
from queue import PriorityQueue
from prisma import Prisma

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
            if passenger.passenger_id == 7:
                print(train.current_station.station_id)

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
                                travel_time=None, boarded=0, alighted=0):
            """Centralized method to log timetable entries."""
            # Swap to save to DB
            
            #entry = TimetableEntry(
            #    train_id= train.train_id,
            #    service_type = train.service_type,
            #    station_id = station.station_id,
            #    arrival_time = arrival_time,
            #    departure_time = departure_time,
            #    travel_time = travel_time,
            #    direction = train.direction,
            #    passengers_boarded = boarded,
            #    passengers_alighted = alighted,
            #    trip_count = train.trip_count
            #)
            #self.simulation.timetables.append(entry)

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
                #print(f"Successfully withdrew Train {train.train_id}.")
                #print(f"Active trains AFTER withdrawal: {[t.train_id for t in self.simulation.active_trains]}")
                #print(f"Remaining trains to withdraw: {self.simulation.trains_to_withdraw_count}")
                # Record final arrival but do not schedule turnaround/departure
                self._record_timetable_entry(
                    train=train, 
                    station=station, 
                    arrival_time=arrival_time, 
                    departure_time="WITHDRAWN", # Indicate withdrawn status
                    travel_time=timedelta(seconds=int(train.current_journey_travel_time)) # Log final travel time
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
                alighted=0
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
    def __init__(self, regular_service_id, skip_stop_service_id):
        self.simulation_queue = [regular_service_id, skip_stop_service_id]
        self.start_time = None
        self.end_time = None
        self.current_time = None
        self.config = None
        self.dwell_time = None
        self.turnaround_time = None
        
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
        
        self.prisma = Prisma()
        self.event_queue = PriorityQueue()
        self.event_handler = EventHandler(self)
    
    def initialize(self):
        """Set up simulation components."""
        self._initialize_stations()
        self._initialize_trains()
        self._initialize_track_segments()
        self._initialize_passengers()
        self._initialize_service_periods()
        
        # Set initial simulation time based on config
        self.current_time = self.start_time
        
        # Schedule initial events (like service period changes)
        self._schedule_initial_events()
        
        # Disconnect Prisma client after initialization
        if self.prisma.is_connected():
            self.prisma.disconnect()

    def _load_simulation_config(self, simulation_id):
        """Load general simulation parameters from the database."""
        print(f"Loading config for simulation {simulation_id}...")
        sim_config = self.prisma.simulations.find_unique(
            where={'SIMULATION_ID': simulation_id}
        )
        if not sim_config:
            raise ValueError(f"Simulation configuration not found for SIMULATION_ID: {self.simulation_id}")

        self.start_time = sim_config.START_TIME
        self.end_time = sim_config.END_TIME
        self.dwell_time = timedelta(seconds=sim_config.DWELL_TIME) # Assuming DWELL_TIME is in seconds
        self.turnaround_time = timedelta(seconds=sim_config.TURNAROUND_TIME) # Assuming TURNAROUND_TIME is in seconds
        self.scheme_type = sim_config.SCHEME_TYPE
        self.service_periods_data = sim_config.SERVICE_PERIODS # Keep raw JSON/dict for now
        self.passenger_data_file = sim_config.PASSENGER_DATA_FILE
        print(f"\nConfig loaded: Start={self.start_time}, End={self.end_time}")

    def _initialize_stations(self):
        """Fetch station data from DB and create Station objects."""
        print("Initializing stations...")
        db_stations = self.prisma.stations.find_many(
            where={'SIMULATION_ID': self.simulation_id},
            order={'STATION_ID': 'asc'} # Ensure stations are ordered by ID
        )
        
        if not db_stations:
             print(f"Warning: No stations found for SIMULATION_ID: {self.simulation_id}")
             return

        self.stations = [] # Clear existing stations if any
        for db_station in db_stations:
            station = Station(
                station_id=db_station.STATION_ID,
                name=db_station.STATION_NAME,
                station_type=db_station.STATION_TYPE,
                is_terminus=db_station.IS_TERMINUS,
                # zone_length might need to be added to the schema or handled differently
                # zone_length=db_station.ZONE_LENGTH 
            )
            self.stations.append(station)
        print(f"Initialized {len(self.stations)} stations.")

    def _initialize_trains(self):
        pass

    def _initialize_track_segments(self):
        pass
    
    def _initialize_service_periods(self):
        """Initialize service periods from the loaded config data."""
        # Example: Parse self.service_periods_data if needed
        # This depends heavily on the structure of the SERVICE_PERIODS JSON
        # For now, just storing it. Logic will be added when needed.
        self.service_periods = self.service_periods_data 
        print("Service periods loaded (raw data).")
        
    def _initialize_passengers(self):
        # Passenger initialization might involve reading the PASSENGER_DATA_FILE
        # or querying a PASSENGER_DEMAND table if it exists and is populated.
        # Placeholder for now.
        print("Passenger initialization skipped (placeholder).")
        pass

    def _schedule_initial_events(self):
        """Schedule initial events like the first service period change."""
        print("Scheduling initial events...")
        # Example: Schedule the first service period change event
        # This requires parsing self.service_periods
        # Placeholder logic:
        # if self.service_periods and isinstance(self.service_periods, list) and len(self.service_periods) > 0:
        #     first_period = self.service_periods[0] # Assuming sorted list
        #     period_start_time_str = first_period.get('start_time') # Example key
        #     if period_start_time_str:
        #         # Convert string time to datetime relative to simulation start
        #         # This conversion logic depends on the format in SERVICE_PERIODS
        #         # period_start_dt = ... # Conversion logic needed here
        #         
        #         # Check if the period start is within the simulation time frame
        #         if self.start_time <= period_start_dt < self.end_time:
        #             self.schedule_event(Event(
        #                 time=period_start_dt,
        #                 event_type="service_period_change",
        #                 period=first_period 
        #             ))
        #             print(f"Scheduled first service period change at {period_start_dt}")
        #         else:
        #              print("First service period start time is outside simulation window.")
        # else:
        #      print("No service periods found or invalid format to schedule initial change.")
        pass # Placeholder implementation

    def schedule_event(self, event):
        """Add an event to the priority queue."""
        self.event_queue.put((event.time, event))  # Use (priority, item) format

    def run(self):
        """Run the simulation until the end time."""
        print("Simulation running...")
        for simulation_id in self.simulation_queue:
            self._load_simulation_config(simulation_id)
            #self.initialize(simulation_id)
            
            #while self.current_time < self.end_time and not self.event_queue.empty():
            #    priority, event = self.event_queue.get()  # Get the next event 
            #    self.current_time = event.time
            #    self.event_handler.process_event(event)
            
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