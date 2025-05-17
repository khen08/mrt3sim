"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from "lucide-react";
import { IconLoader2 } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
// import { SimulationRun } from "@/lib/bindings"; // Path will be corrected later
import { useState, useEffect } from "react";
import { SimulationConfigDialog } from "./SimulationConfigDialog";
import { useAPIStore } from "@/store/apiStore";
import { formatFileName } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulationStore";
import { toast } from "@/components/ui/use-toast";

// Type alias for clarity
type HistoryEntry = SimulationHistoryEntry;

// Custom compact header component for consistency with DataViewerModal
const CompactColumnHeader = ({
  column,
  title,
  alignment = "left",
}: {
  column: any;
  title: string;
  alignment?: "left" | "right" | "center";
}) => {
  return (
    <div
      onClick={column.getToggleSortingHandler()}
      className="flex items-center font-medium cursor-pointer w-full select-none justify-center"
    >
      <div className="flex items-center whitespace-nowrap">
        <span>{title}</span>
        {column.getIsSorted() && (
          <>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3 w-3 ml-1" />
            ) : (
              <ArrowDown className="h-3 w-3 ml-1" />
            )}
            {column.getSortIndex() > 0 && (
              <span className="text-[10px] font-medium ml-0.5 text-yellow-500">
                ({column.getSortIndex() + 1})
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const columns = (
  onLoadSimulation: (simulationId: number) => void,
  loadedSimulationId: number | null,
  isSimulating: boolean
): ColumnDef<HistoryEntry>[] => [
  // Selection Checkbox Column
  {
    id: "select",
    header: ({ table }) => (
      <div className="text-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="mx-auto"
        />
      </div>
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="mx-auto"
        onClick={(e) => {
          // Stop propagation to prevent row selection
          e.stopPropagation();
        }}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    enableResizing: true,
    minSize: 40,
    size: 40,
    maxSize: 60,
    meta: {
      alignment: "center",
    },
  },
  // Data Columns
  {
    accessorKey: "SIMULATION_ID",
    header: ({ column }) => (
      <div className="text-center">
        <CompactColumnHeader column={column} title="ID" alignment="center" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("SIMULATION_ID")}</div>
    ),
    enableResizing: true,
    minSize: 40,
    size: 60,
    maxSize: 80,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "NAME",
    header: ({ column }) => (
      <div className="text-center">
        <CompactColumnHeader column={column} title="Name" alignment="center" />
      </div>
    ),
    cell: ({ row }) => {
      const name = row.getValue("NAME") as string | null;
      return (
        <div
          className="truncate font-medium text-center"
          title={name ?? "Unnamed"}
        >
          {name || (
            <span className="italic text-muted-foreground">Unnamed</span>
          )}
        </div>
      );
    },
    enableResizing: true,
    size: 180,
    minSize: 120,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "CREATED_AT",
    header: ({ column }) => (
      <div className="text-center">
        <CompactColumnHeader
          column={column}
          title="Created"
          alignment="center"
        />
      </div>
    ),
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
      return <div className="text-center">{formattedDate}</div>;
    },
    enableResizing: true,
    size: 170,
    minSize: 150,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "PASSENGER_DATA_FILE",
    header: ({ column }) => (
      <div className="text-center">
        <CompactColumnHeader
          column={column}
          title="Input File"
          alignment="center"
        />
      </div>
    ),
    cell: ({ row }) => {
      const filename = row.getValue("PASSENGER_DATA_FILE") as string | null;
      if (filename) {
        const displayFilename = formatFileName(filename);
        return (
          <div className="truncate text-center" title={filename}>
            {displayFilename}
          </div>
        );
      } else {
        return (
          <span className="text-xs text-muted-foreground italic text-center">
            N/A (Train Only)
          </span>
        );
      }
    },
    enableResizing: true,
    size: 200,
    minSize: 150,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "TOTAL_RUN_TIME_SECONDS",
    header: ({ column }) => (
      <div className="text-center">
        <CompactColumnHeader
          column={column}
          title="Duration"
          alignment="center"
        />
      </div>
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("TOTAL_RUN_TIME_SECONDS"));
      const formatted = amount.toFixed(2) + "s";
      return <div className="text-center font-medium">{formatted}</div>;
    },
    enableResizing: true,
    size: 100,
    minSize: 80,
    meta: {
      alignment: "center",
    },
  },
  // Actions Column (Load Button)
  {
    id: "actions",
    header: () => <div className="text-center">Action</div>,
    cell: ({ row }) => {
      const simulation = row.original;
      const isCurrentlyLoaded = simulation.SIMULATION_ID === loadedSimulationId;
      const [showConfigDialog, setShowConfigDialog] = useState(false);
      const [config, setConfig] = useState<any>(null);
      const [isLoadingConfig, setIsLoadingConfig] = useState(false);
      const apiStore = useAPIStore();

      const handleShowConfig = async () => {
        // If already loading, do nothing
        if (isLoadingConfig) return;

        setIsLoadingConfig(true);

        try {
          // Visual feedback in UI immediately
          toast({
            title: "Loading Configuration",
            description: "Please wait while we prepare the simulation...",
            variant: "default",
          });

          // Direct call to API store - now has built-in retries
          const configData = await apiStore.fetchSimulationConfig(
            simulation.SIMULATION_ID
          );

          if (configData) {
            setConfig({
              ...configData,
              simulationId: simulation.SIMULATION_ID,
              passengerDataFile: simulation.PASSENGER_DATA_FILE,
              simulatePassengers: !!simulation.PASSENGER_DATA_FILE,
            });

            // Only show dialog after successfully loading
            setShowConfigDialog(true);
          } else {
            // Error already handled in API store with toast
            console.log(
              "Failed to load configuration - error handled in API store"
            );
          }
        } catch (error: any) {
          // Should not reach here since errors are handled in API store
          console.error("Unexpected error in handleShowConfig:", error);
        } finally {
          setIsLoadingConfig(false);
        }
      };

      const handleConfirmLoad = () => {
        setShowConfigDialog(false);
        // Force UI to show loading state immediately
        useSimulationStore.getState().setIsLoading(true);
        useSimulationStore.getState().setIsMapLoading(true);
        useSimulationStore.getState().setIsSimulating(true);
        // Immediate call without timeout to avoid issues
        onLoadSimulation(simulation.SIMULATION_ID);
      };

      return (
        <div className="text-center">
          <Button
            variant={isCurrentlyLoaded ? "secondary" : "cta"}
            size="sm"
            onClick={(e) => {
              // Stop event propagation to prevent row selection
              e.stopPropagation();
              handleShowConfig();
            }}
            // Ensure the button stays disabled while loading
            disabled={isCurrentlyLoaded || isSimulating || isLoadingConfig}
            aria-disabled={isCurrentlyLoaded || isSimulating || isLoadingConfig}
            className={`${
              isSimulating || isLoadingConfig ? "relative" : ""
            } min-w-[85px]`}
          >
            {isSimulating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-mrt-blue/20 backdrop-blur-[1px] rounded-md">
                <IconLoader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : isLoadingConfig ? (
              <div className="flex items-center justify-center">
                <IconLoader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                <span>Loading...</span>
              </div>
            ) : isCurrentlyLoaded ? (
              "Loaded"
            ) : (
              "Load"
            )}
          </Button>

          <SimulationConfigDialog
            isOpen={showConfigDialog}
            onClose={() => setShowConfigDialog(false)}
            onConfirm={handleConfirmLoad}
            config={config}
            isLoading={isLoadingConfig}
          />
        </div>
      );
    },
    enableResizing: true,
    size: 100,
    minSize: 90,
    meta: {
      alignment: "center",
    },
  },
];

// Also update the SimulationHistoryEntry interface if NAME is not already there
export interface SimulationHistoryEntry {
  SIMULATION_ID: number;
  NAME?: string | null;
  CREATED_AT: string;
  PASSENGER_DATA_FILE: string | null;
  TOTAL_RUN_TIME_SECONDS: number;
}
