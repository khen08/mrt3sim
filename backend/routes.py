import os
import json
from flask import request, jsonify, Blueprint
from werkzeug.utils import secure_filename
from prisma import Prisma
import datetime
import pytz # Added for timezone conversion

# Import configuration and database logic
from config import DEFAULT_SETTINGS, UPLOAD_FOLDER

# Import database client
from connect import db
from prisma.models import PASSENGER_DEMAND # Import model for type hinting if needed

# Import Simulation Handler
from simulation import Simulation

# --- Create Blueprint ---
main_bp = Blueprint('main', __name__)

# --- API Routes (using Blueprint) ---

# Route to upload passenger data CSV file
@main_bp.route('/upload_csv', methods=['POST'])
def upload_csv():
    if 'passenger_data_file' not in request.files:
        print("[ROUTE:/UPLOAD_CSV] ERROR: NO FILE PART IN REQUEST")
        return jsonify({"error": "No passenger_data_file part in the request"}), 400

    file = request.files['passenger_data_file']

    if file.filename == '':
        print("[ROUTE:/UPLOAD_CSV] ERROR: NO SELECTED FILE")
        return jsonify({"error": "No selected file"}), 400

    allowed_extension = '.csv'
    if not file.filename.lower().endswith(allowed_extension):
        print(f"[ROUTE:/UPLOAD_CSV] ERROR: INVALID FILE TYPE. ALLOWED: {allowed_extension}")
        return jsonify({"error": f"Invalid file type. Only {allowed_extension} files are allowed."}), 400

    if file:
        try:
            # Ensure upload folder exists (config.py handles initial creation, but check again)
            if not os.path.exists(UPLOAD_FOLDER):
                print(f"[ROUTE:/UPLOAD_CSV] WARNING: UPLOAD FOLDER {UPLOAD_FOLDER} DOES NOT EXIST. ATTEMPTING TO CREATE.")
                try:
                    os.makedirs(UPLOAD_FOLDER)
                    print(f"[ROUTE:/UPLOAD_CSV] RE-CREATED UPLOAD FOLDER: {UPLOAD_FOLDER}")
                except OSError as e:
                    print(f"[ROUTE:/UPLOAD_CSV] ERROR: COULD NOT CREATE UPLOAD FOLDER {UPLOAD_FOLDER} ON DEMAND: {e}")
                    return jsonify({"error": f"UPLOAD FOLDER MISSING AND COULD NOT BE CREATED: {UPLOAD_FOLDER}"}), 500
            
            # --- Generate timestamped filename --- 
            timestamp_str = datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
            secure_name = secure_filename(file.filename)
            new_filename = f"{timestamp_str}_{secure_name}"
            save_path = os.path.join(UPLOAD_FOLDER, new_filename)

            print(f"[ROUTE:/UPLOAD_CSV] GENERATED FILENAME: {new_filename}")
            print(f"[ROUTE:/UPLOAD_CSV] SAVING FILE TO: {save_path}")
            file.save(save_path)
            print(f"[ROUTE:/UPLOAD_CSV] FILE '{new_filename}' SAVED SUCCESSFULLY VIA /UPLOAD_CSV.")
            # Return the *new* generated filename
            return jsonify({"message": "File uploaded successfully", "filename": new_filename}), 200

        except Exception as e:
            print(f"[ROUTE:/UPLOAD_CSV] ERROR: COULD NOT SAVE FILE VIA /UPLOAD_CSV: {e}")
            import traceback # Import traceback here if needed for debugging save errors
            print(traceback.format_exc()) 
            return jsonify({"error": f"COULD NOT SAVE FILE: {e}"}), 500
    else:
        print("[ROUTE:/UPLOAD_CSV] ERROR: FILE OBJECT IS INVALID DURING /UPLOAD_CSV")
        return jsonify({"error": "Invalid file object received"}), 400

# Route to create and run a new simulation
@main_bp.route('/simulations', methods=['POST'])
def create_simulation():
    try:
        simulation_input_data = request.get_json()
        print(f"[ROUTE:/SIMULATIONS POST] RECEIVED JSON PAYLOAD:\n{json.dumps(simulation_input_data, indent=2)}")
    except Exception as e:
        print(f"[ROUTE:/SIMULATIONS POST] FAILED TO GET JSON DATA: {e}")
        return jsonify({"error": f"Could not parse request JSON: {e}"}), 400

    config = simulation_input_data.get('config')
    # Get the name from the JSON, default if not provided
    simulation_name = simulation_input_data.get('name', "Untitled Simulation")

    if config is None: # Check for None specifically, as config could be an empty dict {}
        print("[ROUTE:/SIMULATIONS POST] ERROR: 'config' MISSING IN JSON PAYLOAD")
        return jsonify({"error": "'config' is missing in the request JSON"}), 400

    filename = simulation_input_data.get('filename')
    secure_name = None
    
    if filename != None:
        secure_name = secure_filename(filename)

        # Check if the file exists in the upload folder
        file_path = os.path.join(UPLOAD_FOLDER, secure_name)

        if not os.path.exists(file_path):
            print(f"[ROUTE:/SIMULATIONS POST] FILE '{secure_name}' NOT FOUND IN UPLOAD FOLDER '{UPLOAD_FOLDER}'")
            if not os.path.exists(UPLOAD_FOLDER):
                print(f"[ROUTE:/SIMULATIONS POST] UNDERLYING ISSUE: UPLOAD FOLDER '{UPLOAD_FOLDER}' DOES NOT EXIST.")
                return jsonify({"error": f"Upload folder '{UPLOAD_FOLDER}' is missing. Cannot find file '{secure_name}'."}), 500
            else:
                return jsonify({"error": f"File '{secure_name}' not found. Please upload the file first."}), 404

    try:
        # Instantiate the Simulation class, passing the name
        sim = Simulation(simulation_name=simulation_name, csv_filename=secure_name, config=config)

        run_duration = sim.run()

        if sim.simulation_id:
            print(f"[ROUTE:/SIMULATIONS POST] SIMULATION RUN COMPLETED SUCCESSFULLY FOR ID: {sim.simulation_id}")
            
            return jsonify({
                "message": "Simulation completed successfully.",
                "simulation_id": sim.simulation_id,
                "run_duration": run_duration
                }), 200
        else:
            print(f"[ROUTE:/SIMULATIONS POST] ERROR: SIMULATION RUN FAILED TO PRODUCE A SIMULATION ID.")
            return jsonify({"error": "Simulation run failed. Check server logs for details."}), 500

    except Exception as e:
        print(f"[ROUTE:/SIMULATIONS POST] ERROR DURING SIMULATION PROCESSING: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"An unexpected error occurred during simulation: {e}"}), 500

# Route to get default simulation settings
@main_bp.route('/get_default_settings', methods=['GET'])
def get_default_settings():
    try:
        # DEFAULT_SETTINGS is imported from config
        print(f"[ROUTE:GET_DEFAULT_SETTINGS] Returning default settings")
        return jsonify(DEFAULT_SETTINGS)
    except Exception as e:
        print(f"[ROUTE:GET_DEFAULT_SETTINGS] FAILED TO FETCH DEFAULT SETTINGS: {e}")
        return jsonify({"error": f"Could not retrieve default settings: {e}"}), 500

# Route to get the timetable for a specific simulation
@main_bp.route('/simulations/<int:simulation_id>/timetable', methods=['GET', 'OPTIONS'])
def get_timetable(simulation_id):
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify(success=True)
        # Add CORS headers if needed, or handle via Flask-CORS extension
        return response
        
    try:           
        try:
            timetable_entries = db.train_movements.find_many(
                where={'SIMULATION_ID': simulation_id},
                order=[{'ARRIVAL_TIME': 'asc'}],
                include={'simulation': True}
            )
            
            service_periods_data = None
            if timetable_entries:
                simulation_record = timetable_entries[0].simulation
                if simulation_record and simulation_record.SERVICE_PERIODS:
                    if isinstance(simulation_record.SERVICE_PERIODS, (str, bytes, bytearray)):
                        try:
                            service_periods_data = json.loads(simulation_record.SERVICE_PERIODS)
                        except json.JSONDecodeError as json_err:
                            print(f"[ROUTE:/SIMULATIONS/<id>/TIMETABLE] WARNING: FAILED TO PARSE SERVICE_PERIODS JSON: {json_err}")
                            service_periods_data = {"error": "Failed to parse service periods data"}
                    elif isinstance(simulation_record.SERVICE_PERIODS, (list, dict)):
                        # If it's already a list or dict, use it directly
                        service_periods_data = simulation_record.SERVICE_PERIODS
                    else:
                        # Handle unexpected type
                        print(f"[ROUTE:/SIMULATIONS/<id>/TIMETABLE] WARNING: Unexpected type for SERVICE_PERIODS: {type(simulation_record.SERVICE_PERIODS)}")
                        service_periods_data = {"error": f"Unexpected data type for service periods: {type(simulation_record.SERVICE_PERIODS)}"}
                else:
                    print(f"[ROUTE:/SIMULATIONS/<id>/TIMETABLE] WARNING: No simulation record or SERVICE_PERIODS found for included data.")
            else:
                print(f"[ROUTE:/SIMULATIONS/<id>/TIMETABLE] No timetable entries found for simulation ID {simulation_id}")

            serializable_entries = []
            for entry in timetable_entries:
                entry_dict = entry.dict()
                # Ensure correct handling of datetime/time objects before formatting
                arrival_time = entry_dict.get('ARRIVAL_TIME')
                departure_time = entry_dict.get('DEPARTURE_TIME')
                entry_dict['ARRIVAL_TIME'] = format_time(arrival_time)
                entry_dict['DEPARTURE_TIME'] = format_time(departure_time)
                # Remove potentially non-serializable included data if not needed
                entry_dict.pop('simulation', None) 
                serializable_entries.append(entry_dict)
            
            print(f"[ROUTE:/SIMULATIONS/<id>/TIMETABLE] SUCCESSFULLY RETRIEVED {len(serializable_entries)} TIMETABLE ENTRIES FOR SIMULATION ID {simulation_id}")
            return jsonify({
                'timetable': serializable_entries,
                'service_periods': service_periods_data 
            })
        except Exception as e:
            print(f"[ROUTE:/SIMULATIONS/<id>/TIMETABLE] FAILED TO FETCH TIMETABLE ENTRIES: {e}")
            import traceback
            print(traceback.format_exc())
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        # This outer except now catches setup errors before the query
        print(f"[ROUTE:/SIMULATIONS/<id>/TIMETABLE] ERROR PROCESSING REQUEST: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Route to get the list of past simulations (history)
@main_bp.route('/simulations', methods=['GET'])
def get_simulations():
    try:
        # Get the 'since_id' query parameter
        since_id_str = request.args.get('since_id')
        since_id = None
        if since_id_str:
            try:
                since_id = int(since_id_str)
                print(f"[ROUTE:/SIMULATIONS GET] Received since_id: {since_id}")
            except ValueError:
                print(f"[ROUTE:/SIMULATIONS GET] WARNING: Invalid non-integer since_id received: {since_id_str}")

        try:
            query_args = {
                'order': [{'CREATED_AT': 'desc'}] # Keep descending order for history
            }
            if since_id is not None:
                query_args['where'] = {'SIMULATION_ID': {'gt': since_id}}

            history_entries = db.simulations.find_many(**query_args)

            # Convert to serializable format
            serializable_entries = []
            for entry in history_entries:
                entry_dict = entry.dict()
                # Safely format dates, handling potential None values
                # Convert CREATED_AT to Philippines timezone
                created_at_val = entry_dict.get('CREATED_AT')
                if created_at_val:
                    if isinstance(created_at_val, datetime.datetime):
                        # Assume created_at_val from Prisma is UTC.
                        # If naive, localize to UTC. If aware, ensure it's UTC.
                        if created_at_val.tzinfo is None or created_at_val.tzinfo.utcoffset(created_at_val) is None:
                            utc_created_at = pytz.utc.localize(created_at_val)
                        else:
                            utc_created_at = created_at_val.astimezone(pytz.utc)
                        
                        ph_tz = pytz.timezone('Asia/Manila')
                        ph_created_at = utc_created_at.astimezone(ph_tz)
                        # Format to string, maintaining the previous style
                        entry_dict['CREATED_AT'] = ph_created_at.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        # Fallback for non-datetime types (e.g., if already a string)
                        # using the existing format_time function
                        entry_dict['CREATED_AT'] = format_time(created_at_val, '%Y-%m-%d %H:%M:%S')
                else:
                    entry_dict['CREATED_AT'] = None
                
                # Attempt to parse JSON fields if they are strings
                for key in ['CONFIG', 'STATION_CAPACITIES', 'SERVICE_PERIODS', 'PERFORMANCE_METRICS']:
                    if key in entry_dict and isinstance(entry_dict[key], str):
                        try:
                            entry_dict[key] = json.loads(entry_dict[key])
                        except json.JSONDecodeError:
                            print(f"[ROUTE:/SIMULATIONS GET] WARNING: Could not decode JSON for field {key} in simulation {entry_dict.get('SIMULATION_ID')}")
                            # Keep the original string or set to an error indicator if preferred
                
                serializable_entries.append(entry_dict)
            
            print(f"[ROUTE:/SIMULATIONS GET] SUCCESSFULLY RETRIEVED {len(serializable_entries)} HISTORY ENTRIES")
            return jsonify(serializable_entries)
        except Exception as e:
            print(f"[ROUTE:/SIMULATIONS GET] FAILED TO FETCH HISTORY ENTRIES: {e}")
            import traceback
            print(traceback.format_exc())
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        # This outer except now catches setup errors before the query
        print(f"[ROUTE:/SIMULATIONS GET] ERROR PROCESSING REQUEST: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Route to delete specific simulation(s)
@main_bp.route('/simulations/<int:simulation_id>', methods=['DELETE'])
def delete_single_simulation(simulation_id):
    """ Deletes a single simulation entry by its ID. """
    try:
        print(f"[ROUTE:/SIMULATIONS/<id> DELETE] ATTEMPTING TO DELETE SIMULATION ID: {simulation_id}")
        result = db.simulations.delete(
            where={'SIMULATION_ID': simulation_id}
        )
        if result:
            deleted_count = 1
            print(f"[ROUTE:/SIMULATIONS/<id> DELETE] SUCCESSFULLY DELETED SIMULATION ID: {simulation_id}")
            return jsonify({"message": f"Successfully deleted simulation {simulation_id}."}), 200
        else:
            deleted_count = 0
            print(f"[ROUTE:/SIMULATIONS/<id> DELETE] SIMULATION ID {simulation_id} NOT FOUND FOR DELETION.")
            return jsonify({"error": f"Simulation ID {simulation_id} not found."}), 404

    except Exception as e:
        print(f"[ROUTE:/SIMULATIONS/<id> DELETE] FAILED TO DELETE SIMULATION {simulation_id}: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"Failed to delete simulation {simulation_id}: {str(e)}"}), 500

# Route to delete multiple simulations (bulk delete)
@main_bp.route('/simulations', methods=['DELETE'])
def delete_bulk_simulations():
    """ Deletes multiple simulation entries based on IDs provided in the request body. """
    try:
        request_data = request.get_json()
        simulation_ids = request_data.get('simulationIds') # Assuming body sends {"simulationIds": [1, 2, 3]}

        if simulation_ids is None:
            print("[ROUTE:/SIMULATIONS DELETE] ERROR: 'simulationIds' MISSING IN JSON PAYLOAD")
            return jsonify({"error": "'simulationIds' is missing in the request JSON"}), 400

        is_list_of_ints = isinstance(simulation_ids, list) and all(isinstance(item, int) for item in simulation_ids)

        if not is_list_of_ints:
            print(f"[ROUTE:/SIMULATIONS DELETE] ERROR: INVALID 'simulationIds' TYPE. EXPECTED LIST OF INTS. GOT: {type(simulation_ids)}")
            return jsonify({"error": "Invalid 'simulationIds'. Must be a list of integers."}), 400
        
        if not simulation_ids:
            print(f"[ROUTE:/SIMULATIONS DELETE] WARNING: Received empty list for simulation IDs. No deletion performed.")
            return jsonify({"message": "No simulation IDs provided for deletion."}), 200

        try:
            print(f"[ROUTE:/SIMULATIONS DELETE] ATTEMPTING TO DELETE SIMULATION IDS: {simulation_ids}")
            result = db.simulations.delete_many(
                where={'SIMULATION_ID': {'in': simulation_ids}}
            )
            deleted_count = result if result is not None else 0 # delete_many returns the count
            print(f"[ROUTE:/SIMULATIONS DELETE] SUCCESSFULLY DELETED {deleted_count} SIMULATION ENTRIES.")
            return jsonify({"message": f"Successfully deleted {deleted_count} simulation history entries."}), 200

        except Exception as e:
            print(f"[ROUTE:/SIMULATIONS DELETE] FAILED TO DELETE HISTORY ENTRIES: {e}")
            import traceback
            print(traceback.format_exc())
            return jsonify({"error": f"Failed to delete history entries: {str(e)}"}), 500

    except Exception as e:
        print(f"[ROUTE:/SIMULATIONS DELETE] ERROR PROCESSING BULK DELETE REQUEST: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

# Route to get passenger demand data for a specific simulation
@main_bp.route('/simulations/<int:simulation_id>/passenger_demand', methods=['GET'])
def get_passenger_demand(simulation_id):
    try:
        try:
            passenger_demand_entries = db.passenger_demand.find_many(
                where={'SIMULATION_ID': simulation_id}
            )

            formatted_entries = []
            for entry in passenger_demand_entries:
                entry_dict = entry.dict()

                # Create the new formatted dictionary
                formatted_entry = {
                    'Route': f"{entry_dict.get('ORIGIN_STATION_ID', 'N/A')}-{entry_dict.get('DESTINATION_STATION_ID', 'N/A')}",
                    'Passengers': entry_dict.get('PASSENGER_COUNT'),
                    'Demand Time': format_time(entry_dict.get('ARRIVAL_TIME_AT_ORIGIN')),
                    'Boarding Time': format_time(entry_dict.get('DEPARTURE_TIME_FROM_ORIGIN')),
                    'Arrival Destination': format_time(entry_dict.get('ARRIVAL_TIME_AT_DESTINATION')),
                    'Wait Time (s)': entry_dict.get('WAIT_TIME'),
                    'Travel Time (s)': entry_dict.get('TRAVEL_TIME'),
                    'Trip Type': entry_dict.get('TRIP_TYPE'),
                    'SchemeType': entry_dict.get('SCHEME_TYPE')
                }
                formatted_entries.append(formatted_entry)

            print(f"[ROUTE:/SIMULATIONS/<id>/PASSENGER_DEMAND] SUCCESSFULLY RETRIEVED AND FORMATTED {len(formatted_entries)} ENTRIES FOR SIMULATION ID {simulation_id}")
            return jsonify(formatted_entries)
        except Exception as e:
            import traceback
            print(f"[ROUTE:/SIMULATIONS/<id>/PASSENGER_DEMAND] FAILED TO FETCH OR FORMAT ENTRIES: {e}\n{traceback.format_exc()}")
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        # This outer except now catches setup errors before the query
        print(f"[ROUTE:/SIMULATIONS/<id>/PASSENGER_DEMAND] ERROR PROCESSING REQUEST: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Route to get the configuration for a specific simulation
@main_bp.route('/simulations/<int:simulation_id>/config', methods=['GET'])
def get_simulation_config(simulation_id):
    try:
        simulation = db.simulations.find_unique(
            where={'SIMULATION_ID': simulation_id}
        )

        if not simulation:
            print(f"[ROUTE:/SIMULATIONS/<id>/CONFIG] Simulation ID {simulation_id} not found.")
            return jsonify({"error": f"Simulation ID {simulation_id} not found."}), 404

        config_data = simulation.CONFIG

        if isinstance(config_data, str):
            try:
                config_data = json.loads(config_data)
            except json.JSONDecodeError:
                print(f"[ROUTE:/SIMULATIONS/<id>/CONFIG] WARNING: Failed to parse CONFIG JSON for simulation {simulation_id}.")
                return jsonify({"error": "Failed to parse configuration data"}), 500
        elif not isinstance(config_data, dict):
            print(f"[ROUTE:/SIMULATIONS/<id>/CONFIG] WARNING: Unexpected type for CONFIG field for simulation {simulation_id}: {type(config_data)}")
            return jsonify({"error": f"Unexpected data type for configuration: {type(config_data)}"}), 500

        print(f"[ROUTE:/SIMULATIONS/<id>/CONFIG] Successfully retrieved config for simulation ID {simulation_id}")
        return jsonify(config_data)

    except Exception as e:
        import traceback
        print(f"[ROUTE:/SIMULATIONS/<id>/CONFIG] FAILED TO FETCH CONFIG: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

# Route to get aggregated passenger demand by time period and scheme (Prisma ORM version)
@main_bp.route('/simulations/<int:simulation_id>/aggregated_demand', methods=['GET'])
def get_aggregated_demand(simulation_id):
    """
    Aggregates passenger demand for a simulation by O-D pair,
    categorized into Full Service, AM Peak (7-9), and PM Peak (17-19),
    and further broken down by scheme type, using Prisma ORM.
    """
    print(f"[ROUTE:/SIMULATIONS/<id>/AGGREGATED_DEMAND_ORM] STARTING AGGREGATION FOR SIMULATION ID: {simulation_id}")
    try:
        passenger_demand_entries = db.passenger_demand.find_many(
            where={'SIMULATION_ID': simulation_id},
            # Optional: include related station names if needed for display, though not in current output format
            # include={'origin_station': True, 'destination_station': True} 
        )
        print(f"[ROUTE:/SIMULATIONS/<id>/AGGREGATED_DEMAND_ORM] FETCHED {len(passenger_demand_entries)} ENTRIES FROM DB")

        # Intermediate structure to hold aggregated counts before final formatting
        # Format: {period: {scheme: {(origin_id, dest_id): count}}}
        aggregated_counts = {
            "FULL_SERVICE": {"REGULAR": {}, "SKIP-STOP": {}},
            "AM_PEAK": {"REGULAR": {}, "SKIP-STOP": {}},
            "PM_PEAK": {"REGULAR": {}, "SKIP-STOP": {}}
        }

        for entry in passenger_demand_entries:
            # entry_dict = entry.dict() # .dict() might not be needed if accessing attributes directly
            origin_id = entry.ORIGIN_STATION_ID
            dest_id = entry.DESTINATION_STATION_ID
            pass_count = entry.PASSENGER_COUNT
            scheme = entry.SCHEME_TYPE
            arrival_time = entry.ARRIVAL_TIME_AT_ORIGIN # This is a datetime object

            if scheme not in ["REGULAR", "SKIP-STOP"]:
                print(f"[ROUTE:/SIMULATIONS/<id>/AGGREGATED_DEMAND_ORM] WARNING: UNEXPECTED SCHEME_TYPE '{scheme}' FOUND. SKIPPING ENTRY.")
                continue
            
            od_pair = (origin_id, dest_id)

            # --- Aggregate for FULL_SERVICE ---
            current_full_service_count = aggregated_counts["FULL_SERVICE"][scheme].get(od_pair, 0)
            aggregated_counts["FULL_SERVICE"][scheme][od_pair] = current_full_service_count + pass_count

            # --- Aggregate for AM_PEAK (7:00 - 8:59) ---
            if arrival_time and 7 <= arrival_time.hour < 9:
                current_am_peak_count = aggregated_counts["AM_PEAK"][scheme].get(od_pair, 0)
                aggregated_counts["AM_PEAK"][scheme][od_pair] = current_am_peak_count + pass_count

            # --- Aggregate for PM_PEAK (17:00 - 18:59) ---
            if arrival_time and 17 <= arrival_time.hour < 19:
                current_pm_peak_count = aggregated_counts["PM_PEAK"][scheme].get(od_pair, 0)
                aggregated_counts["PM_PEAK"][scheme][od_pair] = current_pm_peak_count + pass_count
        
        print(f"[ROUTE:/SIMULATIONS/<id>/AGGREGATED_DEMAND_ORM] INTERMEDIATE AGGREGATION COMPLETE")

        # Structure the results according to the desired JSON output format
        output = {
            "FULL_SERVICE": {"REGULAR": [], "SKIP-STOP": []},
            "AM_PEAK": {"REGULAR": [], "SKIP-STOP": []},
            "PM_PEAK": {"REGULAR": [], "SKIP-STOP": []}
        }

        for period, schemes_data in aggregated_counts.items():
            for scheme, od_pairs_data in schemes_data.items():
                for od_pair, count in od_pairs_data.items():
                    if count > 0: # Only include OD pairs with passengers in this period/scheme
                        route_str = f"{od_pair[0]}-{od_pair[1]}"
                        output[period][scheme].append({
                            "ROUTE": route_str,
                            "PASSENGER_COUNT": count
                        })
        
        print(f"[ROUTE:/SIMULATIONS/<id>/AGGREGATED_DEMAND_ORM] SUCCESSFULLY PROCESSED RESULTS FOR SIMULATION ID {simulation_id}")
        return jsonify(output)

    except Exception as e:
        import traceback
        print(f"[ROUTE:/SIMULATIONS/<id>/AGGREGATED_DEMAND_ORM] FAILED TO FETCH OR PROCESS AGGREGATED DEMAND: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"Failed to retrieve or process aggregated demand: {str(e)}"}), 500

# Route to get simulation metrics for a specific simulation
@main_bp.route('/simulations/<int:simulation_id>/metrics', methods=['GET'])
def get_simulation_metrics(simulation_id):
    """
    Retrieves metrics data for a simulation and calculates additional derived metrics
    such as average wait time and average travel time per passenger.
    """
    print(f"[ROUTE:/SIMULATIONS/<id>/METRICS] STARTING METRICS RETRIEVAL FOR SIMULATION ID: {simulation_id}")
    try:
        metrics_entries = db.simulation_metrics.find_many(
            where={'SIMULATION_ID': simulation_id}
        )
        
        if not metrics_entries:
            print(f"[ROUTE:/SIMULATIONS/<id>/METRICS] No metrics found for simulation ID {simulation_id}")
            return jsonify({"error": f"No metrics data available for simulation ID {simulation_id}"}), 404
        
        print(f"[ROUTE:/SIMULATIONS/<id>/METRICS] FETCHED {len(metrics_entries)} METRICS ENTRIES FROM DB")
        
        # Process and format the metrics data
        formatted_metrics = []
        
        for entry in metrics_entries:
            scheme_type = entry.SCHEME_TYPE
            passenger_count = entry.PASSENGER_COUNT
            total_travel_time = entry.TOTAL_PASSENGER_TRAVEL_TIME_SECONDS
            total_wait_time = entry.TOTAL_PASSENGER_WAITING_TIME_SECONDS
            
            # Skip entries with no passengers to avoid division by zero
            if passenger_count <= 0:
                print(f"[ROUTE:/SIMULATIONS/<id>/METRICS] WARNING: Skipping entry with 0 passengers for scheme {scheme_type}")
                continue
            
            # Calculate average metrics
            avg_travel_time = total_travel_time / passenger_count
            avg_wait_time = total_wait_time / passenger_count
            avg_total_journey_time = (total_travel_time + total_wait_time) / passenger_count
            
            # Add basic metrics
            formatted_metrics.extend([
                {
                    "metric": f"Total Passengers ({scheme_type})",
                    "value": passenger_count,
                    "category": "basic",
                    "scheme": scheme_type
                },
                {
                    "metric": f"Total Travel Time ({scheme_type})",
                    "value": f"{total_travel_time:,} seconds",
                    "category": "basic",
                    "scheme": scheme_type
                },
                {
                    "metric": f"Total Wait Time ({scheme_type})",
                    "value": f"{total_wait_time:,} seconds",
                    "category": "basic",
                    "scheme": scheme_type
                }
            ])
            
            # Add average metrics
            formatted_metrics.extend([
                {
                    "metric": f"Average Travel Time per Passenger ({scheme_type})",
                    "value": f"{avg_travel_time:.2f} seconds",
                    "category": "average",
                    "scheme": scheme_type
                },
                {
                    "metric": f"Average Wait Time per Passenger ({scheme_type})",
                    "value": f"{avg_wait_time:.2f} seconds",
                    "category": "average",
                    "scheme": scheme_type
                },
                {
                    "metric": f"Average Total Journey Time per Passenger ({scheme_type})",
                    "value": f"{avg_total_journey_time:.2f} seconds",
                    "category": "average",
                    "scheme": scheme_type
                }
            ])
        
        print(f"[ROUTE:/SIMULATIONS/<id>/METRICS] SUCCESSFULLY PROCESSED {len(formatted_metrics)} METRICS FOR SIMULATION ID {simulation_id}")
        return jsonify(formatted_metrics)

    except Exception as e:
        import traceback
        print(f"[ROUTE:/SIMULATIONS/<id>/METRICS] FAILED TO FETCH OR PROCESS METRICS: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"Failed to retrieve or process metrics: {str(e)}"}), 500

# --- Helper Functions ---

# Utility function to format time/datetime objects safely
def format_time(time_obj, format_string='%H:%M:%S'):
    """Safely formats a datetime/time object to string, handling None or non-datetime types."""
    if isinstance(time_obj, (datetime.datetime, datetime.time)):
        try:
            return time_obj.strftime(format_string)
        except ValueError:
            # Fallback if strftime fails
            return str(time_obj)
    elif isinstance(time_obj, str): # If it's already a string, return it
        return time_obj
    # Return None or an empty string if it's not a suitable time object or None
    return None # Or return "" if preferred

# Note: The app is run from backend/app.py, not here.