# MRT-3 Simulation Tool

A web-based simulation interface for evaluating and replicating the operations of the MRT-3 system. This tool allows users to upload passenger flow data, configure operational parameters, and visualize train movements on an interactive SVG map.

## Features

- **CSV Data Upload**: Upload passenger flow data in CSV format
- **Operational Settings**: Configure basic and advanced operational parameters
- **Interactive Visualization**: View animated trains on an SVG map of the MRT-3 railway
- **Real-time Simulation**: Control the simulation with play, pause, and reset functions
- **Station Information**: View detailed information about each station

## Technology Stack

- **Frontend**: Next.js 15.2.2
- **UI Components**: shadcn UI
- **Icons**: Tabler Icons
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/mrt3sim.git
   cd mrt3sim
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. **Data Input**: Upload a CSV file containing passenger flow data. The file should follow the format shown in the example (4-12-23-SAMPLE-minute-level.csv).

2. **Simulation Settings**:

   - Configure basic operational parameters such as peak period, time settings, headway time, dwell time, and turnaround time.
   - Set advanced parameters including station distances, speeds, acceleration/deceleration rates, and train settings.

3. **Run Simulation**:
   - Start the simulation to see animated trains moving along the MRT-3 railway.
   - Use the simulation controls to play, pause, and reset the simulation.
   - Click on stations to view detailed information.

## CSV Format

The CSV file should contain passenger flow data with the following columns:

- DateTime: The timestamp for the data point
- Station-specific columns: Passenger counts for each station

Example:

```
Month,Day,Hour,Year,Holiday,Morning_Peak,Afternoon_Peak,Weekday,Weekend,DateTime,"1,2","1,3",...
4,12,7,2023,0,0,0,0,0,2023-04-12 07:00:00,2,6,3,1,9,16,9,5,14,6,4,2,...
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- MRT-3 operations data
- shadcn UI for the component library
- Tabler Icons for the icon set
# mrt3sim
