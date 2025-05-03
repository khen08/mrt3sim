"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

// Define the structure for a single simulation history entry
export interface SimulationHistoryEntry {
  SIMULATION_ID: number;
  CREATED_AT: string;
  PASSENGER_DATA_FILE: string;
  START_TIME: string;
  END_TIME: string;
  TOTAL_RUN_TIME_SECONDS: number;
}

// Type alias for clarity
type HistoryEntry = SimulationHistoryEntry;

export const columns = (
  onLoadSimulation: (simulationId: number) => void,
  loadedSimulationId: number | null,
  isSimulating: boolean
): ColumnDef<HistoryEntry>[] => [
  // Selection Checkbox Column
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  // Data Columns
  {
    accessorKey: "SIMULATION_ID",
    header: "ID",
    cell: ({ row }) => (
      <div className="w-[60px] font-medium">
        {row.getValue("SIMULATION_ID")}
      </div>
    ),
  },
  {
    accessorKey: "CREATED_AT",
    header: "Created",
    cell: ({ row }) => (
      <div className="w-[150px]">{row.getValue("CREATED_AT")}</div>
    ),
  },
  {
    accessorKey: "PASSENGER_DATA_FILE",
    header: "Input File",
    cell: ({ row }) => (
      <div
        className="truncate max-w-[200px]"
        title={row.getValue("PASSENGER_DATA_FILE")}
      >
        {row.getValue("PASSENGER_DATA_FILE")}
      </div>
    ),
  },
  {
    accessorKey: "START_TIME",
    header: "Sim Start",
    cell: ({ row }) => (
      <div className="w-[150px]">{row.getValue("START_TIME")}</div>
    ),
  },
  {
    accessorKey: "END_TIME",
    header: "Sim End",
    cell: ({ row }) => (
      <div className="w-[150px]">{row.getValue("END_TIME")}</div>
    ),
  },
  {
    accessorKey: "TOTAL_RUN_TIME_SECONDS",
    header: () => <div className="text-right">Duration</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("TOTAL_RUN_TIME_SECONDS"));
      const formatted = amount.toFixed(2) + "s";
      return (
        <div className="w-[100px] text-right font-medium">{formatted}</div>
      );
    },
  },
  // Actions Column (Load Button)
  {
    id: "actions",
    header: () => <div className="text-center">Action</div>,
    cell: ({ row }) => {
      const simulation = row.original;
      const isCurrentlyLoaded = simulation.SIMULATION_ID === loadedSimulationId;

      return (
        <div className="w-[80px] text-center">
          <Button
            variant={isCurrentlyLoaded ? "secondary" : "outline"}
            size="sm"
            onClick={() => onLoadSimulation(simulation.SIMULATION_ID)}
            disabled={isCurrentlyLoaded || isSimulating}
          >
            {isCurrentlyLoaded ? "Loaded" : "Load"}
          </Button>
        </div>
      );
    },
  },
];
