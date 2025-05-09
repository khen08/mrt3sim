# MRT-3 Simulation Tool

A web-based simulation interface for evaluating and replicating the operations of the MRT-3 system. This tool allows users to upload passenger flow data, configure operational parameters, and visualize train movements on an interactive SVG map.

## Features

- **CSV Data Upload**: Upload passenger flow data in CSV format
- **Operational Settings**: Configure basic and advanced operational parameters
- **Interactive Visualization**: View animated trains on an SVG map of the MRT-3 railway
- **Real-time Simulation**: Control the simulation with play, pause, and reset functions
- **Station Information**: View detailed information about each station
- **Data Analytics**: Advanced visualization of simulation results with multiple chart types including bar charts and time series
- **Metrics Dashboard**: Comprehensive analysis of system performance metrics
- **Simulation History**: Save and load previous simulation runs

## Technology Stack

### Frontend

- **Framework**: Next.js 15.3.1 with React 19
- **UI Components**: shadcn UI with Radix UI primitives
- **Icons**: Tabler Icons and Lucide React
- **Styling**: Tailwind CSS v4
- **Form Handling**: React Hook Form
- **State Management**: Zustand
- **Data Visualization**: ECharts, Recharts
- **Data Parsing**: PapaParse for CSV handling
- **Notifications**: React-Toastify

### Backend

- **Framework**: Flask 3.1.0
- **Database**: Prisma ORM
- **Data Processing**: Pandas and NumPy
- **CORS**: Flask-CORS for cross-origin requests
- **Simulation Engine**: Custom Python simulation for train operations

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- Python 3.9 or higher
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/mrt3sim.git
   cd mrt3sim
   ```

2. Set up the frontend:

   ```bash
   cd frontend
   npm install
   # or
   yarn install
   ```

3. Set up the backend:

   ```bash
   cd backend
   pip install -r requirements.txt
   # Create a virtual environment if needed:
   # python -m venv .venv
   # source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

4. Start the frontend development server:

   ```bash
   cd frontend
   npm run dev
   # or
   yarn dev
   ```

5. Start the backend server:

   ```bash
   cd backend
   python app.py
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. **Data Input**: Upload a CSV file containing passenger flow data. The file should follow the format shown in the example (4-12-23-SAMPLE-minute-level.csv).

2. **Simulation Settings**:

   - Configure basic operational parameters such as peak period, time settings, headway time, dwell time, and turnaround time.
   - Set advanced parameters including station distances, speeds, acceleration/deceleration rates, and train settings.

3. **Run Simulation**:

   - Start the simulation to see animated trains moving along the MRT-3 railway.
   - Use the simulation controls to play, pause, and reset the simulation.
   - Click on stations to view detailed information.

4. **Analyze Results**:
   - View comprehensive metrics in the analytics dashboard.
   - Explore visualizations including passenger heatmaps, OD matrices, time distribution charts, and more.
   - Save simulation results for future reference and comparison.

## CSV Format

The CSV file should contain passenger flow data with the following columns:

- DateTime: The timestamp for the data point
- Station-specific columns: Passenger counts for each station

Example:

```
Month,Day,Hour,Year,Holiday,Morning_Peak,Afternoon_Peak,Weekday,Weekend,DateTime,"1,2","1,3",...
4,12,7,2023,0,0,0,0,0,2023-04-12 07:00:00,2,6,3,1,9,16,9,5,14,6,4,2,...
```

## Project Structure

- `/frontend`: Next.js application with React components

  - `/src/components`: UI components including the MRT map and simulation controls
  - `/src/components/metrics`: Visualization components for simulation results
  - `/src/app`: Next.js app router structure
  - `/src/store`: Zustand state management

- `/backend`: Flask API server
  - `/simulation`: Core simulation engine
  - `/prisma`: Database schema and client
  - `/uploads`: Storage for uploaded CSV files

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- MRT-3 operations data
- shadcn UI for the component library
- Tabler Icons for the icon set
