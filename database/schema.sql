CREATE DATABASE IF NOT EXISTS MRT3_SIMULATION;

USE MRT3_SIMULATION;

-- Drop tables if they exist (optional, useful for development)
-- Order is important due to foreign key dependencies
DROP TABLE IF EXISTS TRAIN_MOVEMENTS;
DROP TABLE IF EXISTS PASSENGERS; -- Drop PASSENGERS before TRAINS (due to FINAL_TRAIN_ID FK)
DROP TABLE IF EXISTS TRAINS; -- Drop TRAINS before TRAIN_SPECS and STATIONS
DROP TABLE IF EXISTS TRACK_SEGMENTS;
DROP TABLE IF EXISTS STATIONS;
DROP TABLE IF EXISTS TRAIN_SPECS; -- Drop TRAIN_SPECS before SIMULATIONS
DROP TABLE IF EXISTS SIMULATIONS;


-- Create the SIMULATIONS table
CREATE TABLE IF NOT EXISTS SIMULATIONS (
    SIMULATION_ID INT AUTO_INCREMENT PRIMARY KEY,
    START_TIME DATETIME NOT NULL,
    END_TIME DATETIME NOT NULL,
    DWELL_TIME INT NOT NULL, -- in seconds
    TURNAROUND_TIME INT NOT NULL, -- in seconds
    SCHEME_TYPE VARCHAR(15) NOT NULL, -- e.g., 'REGULAR', 'AB_STOPPING'
    SERVICE_PERIODS JSON NOT NULL, -- JSON is fine for this list of periods
    PASSENGER_DATA_FILE VARCHAR(255) NOT NULL -- Increased size for longer filenames/paths
);

-- Create the TRAIN_SPECS table (Simulation-Specific Specs)
CREATE TABLE IF NOT EXISTS TRAIN_SPECS (
    SPEC_ID INT AUTO_INCREMENT PRIMARY KEY,
    SIMULATION_ID INT NOT NULL, -- Required for simulation-specific specs
    SPEC_NAME VARCHAR(50), -- Spec name unique within a simulation (handled by separate unique key now)
    MAX_CAPACITY INT NOT NULL,
    CRUISING_SPEED FLOAT NOT NULL,
    PASSTHROUGH_SPEED FLOAT NOT NULL,
    ACCEL_RATE FLOAT NOT NULL,
    DECEL_RATE FLOAT NOT NULL,

    -- Spec name is unique PER SIMULATION
    UNIQUE KEY IDX_SIMULATION_SPEC_NAME (SIMULATION_ID, SPEC_NAME),

    -- This composite unique key is needed for the foreign key reference from TRAINS
    UNIQUE KEY UNQ_SIMULATION_SPEC_ID (SIMULATION_ID, SPEC_ID),

    FOREIGN KEY (SIMULATION_ID) REFERENCES SIMULATIONS(SIMULATION_ID) ON DELETE CASCADE
);


-- Create the STATIONS table
CREATE TABLE IF NOT EXISTS STATIONS (
    SIMULATION_ID INT NOT NULL,      -- Links to the simulation run
    STATION_ID INT NOT NULL,         -- A unique ID for the station within THIS simulation (could be 1 to 13)
    STATION_NUMBER INT NOT NULL,     -- The sequential number of the station (1, 2, ..., 13) - useful for ordering
    STATION_NAME VARCHAR(255) NOT NULL, -- The name, potentially modified by the user
    STATION_TYPE VARCHAR(10) NOT NULL, -- The type ('A', 'B', 'AB'), user-defined per station
    IS_TERMINUS BOOLEAN NOT NULL,    -- Determined by its position (first/last), potentially derived or explicitly stored
    PRIMARY KEY (SIMULATION_ID, STATION_ID), -- Composite primary key
    UNIQUE KEY IDX_SIMULATION_STATION_NUMBER (SIMULATION_ID, STATION_NUMBER), -- Ensures unique sequential number per simulation
    FOREIGN KEY (SIMULATION_ID) REFERENCES SIMULATIONS(SIMULATION_ID) ON DELETE CASCADE
);

-- Create the TRACK_SEGMENTS table
CREATE TABLE IF NOT EXISTS TRACK_SEGMENTS (
    SIMULATION_ID INT NOT NULL, -- Links to the simulation run
    START_STATION_ID INT NOT NULL, -- The STATION_ID at the start of the segment
    END_STATION_ID INT NOT NULL,   -- The STATION_ID at the end of the segment
    DIRECTION VARCHAR(10) NOT NULL, -- 'northbound' or 'southbound'
    DISTANCE FLOAT NOT NULL,       -- The distance, potentially modified by the user (in meters, stay consistent)
    PRIMARY KEY (SIMULATION_ID, START_STATION_ID, END_STATION_ID, DIRECTION), -- Composite primary key
    FOREIGN KEY (SIMULATION_ID) REFERENCES SIMULATIONS(SIMULATION_ID) ON DELETE CASCADE,
    -- Foreign keys ensuring segments connect valid stations within the same simulation
    FOREIGN KEY (SIMULATION_ID, START_STATION_ID) REFERENCES STATIONS(SIMULATION_ID, STATION_ID) ON DELETE CASCADE,
    FOREIGN KEY (SIMULATION_ID, END_STATION_ID) REFERENCES STATIONS(SIMULATION_ID, STATION_ID) ON DELETE CASCADE
);

-- Create the TRAINS table (Instances of trains for a simulation, linked to simulation-specific specs)
CREATE TABLE IF NOT EXISTS TRAINS (
    SIMULATION_ID INT NOT NULL,    -- Links to the simulation run
    TRAIN_ID INT NOT NULL,         -- A unique ID for the train instance within THIS simulation
    TRAIN_NUMBER INT NOT NULL,     -- Sequential number for display/identification (1, 2, ...)
    SERVICE_TYPE VARCHAR(10) NOT NULL, -- 'A', 'B', or 'AB' defined per train instance
    SPEC_ID INT NOT NULL,          -- Links to the TRAIN_SPECS table

    PRIMARY KEY (SIMULATION_ID, TRAIN_ID), -- Composite primary key
    UNIQUE KEY IDX_SIMULATION_TRAIN_NUMBER (SIMULATION_ID, TRAIN_NUMBER), -- Unique train number per simulation
    FOREIGN KEY (SIMULATION_ID) REFERENCES SIMULATIONS(SIMULATION_ID) ON DELETE CASCADE,
    -- Composite Foreign key to simulation-specific TRAIN_SPECS
    FOREIGN KEY (SIMULATION_ID, SPEC_ID) REFERENCES TRAIN_SPECS(SIMULATION_ID, SPEC_ID) ON DELETE CASCADE
);

-- Create the TRAIN_MOVEMENTS table
CREATE TABLE IF NOT EXISTS TRAIN_MOVEMENTS (
    MOVEMENT_ID INT AUTO_INCREMENT PRIMARY KEY, -- Unique auto-incrementing ID
    SIMULATION_ID INT NOT NULL,
    TRAIN_ID INT NOT NULL,
    STATION_ID INT NOT NULL,
    DIRECTION VARCHAR(10) NOT NULL,
    ARRIVAL_TIME DATETIME NOT NULL,
    DEPARTURE_TIME DATETIME NULL,
    PASSENGERS_BOARDED INT NOT NULL DEFAULT 0,
    PASSENGERS_ALIGHTED INT NOT NULL DEFAULT 0,
    CURRENT_PASSENGER_COUNT INT NOT NULL DEFAULT 0,
    TRIP_COUNT INT NOT NULL DEFAULT 0, -- Trip number for this specific train instance

    FOREIGN KEY (SIMULATION_ID) REFERENCES SIMULATIONS(SIMULATION_ID) ON DELETE CASCADE,
    -- Foreign keys using composite SIMULATION_ID to link to TRAINS and STATIONS
    FOREIGN KEY (SIMULATION_ID, TRAIN_ID) REFERENCES TRAINS(SIMULATION_ID, TRAIN_ID) ON DELETE CASCADE,
    FOREIGN KEY (SIMULATION_ID, STATION_ID) REFERENCES STATIONS(SIMULATION_ID, STATION_ID) ON DELETE CASCADE
);

-- Create the PASSENGERS table
CREATE TABLE IF NOT EXISTS PASSENGERS (
    PASSENGER_ID INT NOT NULL, -- Passenger ID unique within a simulation (from your CSV logic)
    SIMULATION_ID INT NOT NULL, -- Passenger ALWAYS belongs to a simulation (NOT NULL is correct here)
    ORIGIN_STATION_ID INT NOT NULL,
    DESTINATION_STATION_ID INT NOT NULL,
    ARRIVAL_TIME_AT_ORIGIN DATETIME NOT NULL, -- Time passenger arrived at their origin station
    BOARDING_TIME DATETIME NULL, -- Time passenger boarded a train
    COMPLETION_TIME DATETIME NULL, -- Time passenger arrived at their destination
    STATUS VARCHAR(20) NOT NULL, -- 'waiting', 'in_transit', 'completed'
    TRIP_TYPE VARCHAR(10) NOT NULL, -- e.g., 'direct', 'transfer'
    FINAL_TRAIN_ID INT NULL, -- ID of the train they _completed_ on (within THIS simulation)

    PRIMARY KEY (SIMULATION_ID, PASSENGER_ID), -- Composite primary key to uniquely identify a passenger across simulations
    FOREIGN KEY (SIMULATION_ID) REFERENCES SIMULATIONS(SIMULATION_ID) ON DELETE CASCADE, -- Foreign key to SIMULATIONS table (SIMULATION_ID NOT NULL here is fine)
    -- Foreign keys using composite SIMULATION_ID to link to STATIONS
    FOREIGN KEY (SIMULATION_ID, ORIGIN_STATION_ID) REFERENCES STATIONS(SIMULATION_ID, STATION_ID) ON DELETE CASCADE,
    FOREIGN KEY (SIMULATION_ID, DESTINATION_STATION_ID) REFERENCES STATIONS(SIMULATION_ID, STATION_ID) ON DELETE CASCADE,

    -- Corrected ForeignKey to TRAINS for FINAL_TRAIN_ID:
    -- Since the overarching goal is cascade deletion from SIMULATIONS,
    -- setting this FK to ON DELETE CASCADE is consistent. If a TRAIN is deleted
    -- because its SIMULATION was deleted, the Passenger records referring to it
    -- will also be deleted.
    FOREIGN KEY (SIMULATION_ID, FINAL_TRAIN_ID) REFERENCES TRAINS(SIMULATION_ID, TRAIN_ID) ON DELETE CASCADE -- Changed to ON DELETE CASCADE
);

-- Optional: Add indexes for improved query performance
CREATE INDEX IDX_TRAIN_MOVEMENTS_TIME ON TRAIN_MOVEMENTS (SIMULATION_ID, ARRIVAL_TIME);
CREATE INDEX IDX_PASSENGERS_STATUS ON PASSENGERS (SIMULATION_ID, STATUS);
CREATE INDEX IDX_PASSENGERS_ORIGIN ON PASSENGERS (SIMULATION_ID, ORIGIN_STATION_ID);
CREATE INDEX IDX_PASSENGERS_DESTINATION ON PASSENGERS (SIMULATION_ID, DESTINATION_STATION_ID);
