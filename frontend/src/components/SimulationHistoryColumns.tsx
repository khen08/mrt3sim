"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// import { SimulationRun } from "@/lib/bindings"; // Path will be corrected later

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
    header: ({ column }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group"
        >
          ID
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 h-7 w-7"
          onClick={() => {
            console.log("View details for:", row.original.SIMULATION_ID);
          }}
        >
          <Search className="h-4 w-4" />
        </Button>
        <div className="w-[50px] text-center font-medium">
          {row.getValue("SIMULATION_ID")}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "NAME", // Assuming backend saves it as NAME
    header: ({ column }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group"
        >
          Name
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const name = row.getValue("NAME") as string | null;
      return (
        <div
          className="w-[180px] truncate font-medium"
          title={name ?? "Unnamed"}
        >
          {name || (
            <span className="italic text-muted-foreground">Unnamed</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "CREATED_AT",
    header: ({ column }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group"
        >
          Created
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const dateStr = row.getValue("CREATED_AT") as string;
      let formattedDate = "Invalid Date";
      try {
        formattedDate = new Date(dateStr).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (e) {}
      return <div className="w-[170px]">{formattedDate}</div>;
    },
  },
  {
    accessorKey: "PASSENGER_DATA_FILE",
    header: "Input File",
    cell: ({ row }) => {
      const filename = row.getValue("PASSENGER_DATA_FILE") as string | null;
      if (filename) {
        return (
          <div className="truncate max-w-[200px]" title={filename}>
            {filename}
          </div>
        );
      } else {
        return (
          <span className="text-xs text-muted-foreground italic">
            N/A (Train Only)
          </span>
        );
      }
    },
  },
  {
    accessorKey: "START_TIME",
    header: ({ column }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group"
        >
          Simulation Start Time
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const dateTimeStr = row.getValue("START_TIME") as string;
      const timePart = dateTimeStr.split(" ")[1] || "--:--:--";
      return <div className="w-[140px] font-mono text-center">{timePart}</div>;
    },
  },
  {
    accessorKey: "END_TIME",
    header: ({ column }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group"
        >
          Simulation End Time
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const dateTimeStr = row.getValue("END_TIME") as string;
      const timePart = dateTimeStr.split(" ")[1] || "--:--:--";
      return <div className="w-[140px] font-mono text-center">{timePart}</div>;
    },
  },
  {
    accessorKey: "TOTAL_RUN_TIME_SECONDS",
    header: ({ column }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-right w-full justify-end"
        >
          Duration
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
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
            variant={isCurrentlyLoaded ? "secondary" : "cta"}
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

// Also update the SimulationHistoryEntry interface if NAME is not already there
export interface SimulationHistoryEntry {
  SIMULATION_ID: number;
  NAME?: string | null; // Add NAME property
  CREATED_AT: string;
  PASSENGER_DATA_FILE: string;
  START_TIME: string;
  END_TIME: string;
  TOTAL_RUN_TIME_SECONDS: number;
}
