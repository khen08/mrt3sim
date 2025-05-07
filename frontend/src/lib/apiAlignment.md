# API Endpoint Alignment

This document outlines the alignment between the frontend API endpoints and the backend routes defined in routes.py.

## API Endpoints

| Frontend Constant                          | Backend Route                         | Method | Description                                         | Status     |
| ------------------------------------------ | ------------------------------------- | ------ | --------------------------------------------------- | ---------- |
| `GET_DEFAULT_SETTINGS_ENDPOINT`            | `/get_default_settings`               | GET    | Fetch default simulation settings                   | Aligned ✅ |
| `RUN_SIMULATION_ENDPOINT`                  | `/simulations`                        | POST   | Create and run a new simulation                     | Aligned ✅ |
| `UPLOAD_CSV_ENDPOINT`                      | `/upload_csv`                         | POST   | Upload passenger data CSV file                      | Aligned ✅ |
| `GET_TIMETABLE_ENDPOINT`                   | `/simulations/{id}/timetable`         | GET    | Get timetable for a specific simulation             | Aligned ✅ |
| `GET_SIMULATION_HISTORY_ENDPOINT`          | `/simulations`                        | GET    | Get list of past simulations                        | Aligned ✅ |
| `GET_SIMULATION_CONFIG_ENDPOINT`           | `/simulations/{id}/config`            | GET    | Get configuration for a specific simulation         | Aligned ✅ |
| `GET_PASSENGER_DEMAND_ENDPOINT`            | `/simulations/{id}/passenger_demand`  | GET    | Get passenger demand data for a specific simulation | Aligned ✅ |
| `DELETE_SIMULATION_ENDPOINT`               | `/simulations/{id}`                   | DELETE | Delete a specific simulation                        | Aligned ✅ |
| `DELETE_BULK_SIMULATIONS_ENDPOINT`         | `/simulations`                        | DELETE | Delete multiple simulations                         | Aligned ✅ |
| `GET_AGGREGATED_PASSENGER_DEMAND_ENDPOINT` | `/simulations/{id}/aggregated_demand` | GET    | Get aggregated passenger demand for a simulation    | Aligned ✅ |
| `GET_SIMULATION_METRICS_ENDPOINT`          | `/simulations/{id}/metrics`           | GET    | Get metrics for a specific simulation               | Aligned ✅ |

## Zustand Store Best Practices

The code has been updated to follow Zustand best practices:

1. **Consistent getState() Usage**: Updated to consistently use `useXXXStore.getState()` to access store state.

2. **Proper Type Definitions**: Added more specific type definitions, particularly for `SimulationHistoryEntry`.

3. **Better API Error Handling**: Improved error handling and consistent error reporting.

4. **Consistent Store Access**: Used the `get()` function to access the store's own methods rather than reimporting the store.

## Key Updates

1. Updated `apiStore.ts` to follow consistent patterns for accessing state across multiple stores.

2. Ensured all API endpoints are correctly aligned with backend routes.

3. Improved error handling for API responses.

4. Updated type definitions for better type safety.

5. Improved store access patterns using Zustand's recommended approaches.

6. Removed redundant constant definitions in `constants.ts`.

These updates ensure that the frontend code is properly aligned with the backend API routes and follows best practices for state management with Zustand.
