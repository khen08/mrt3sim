"use client";

import * as React from "react"; // Import React
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { IconLoader, IconTrash } from "@tabler/icons-react"; // Added IconTrash
import {
  columns,
  SimulationHistoryEntry,
} from "@/components/SimulationHistoryColumns"; // Re-add SimulationHistoryEntry here
import { DataTable } from "@/components/DataTable"; // Import the DataTable component
import {
  RowSelectionState,
  SortingState,
  PaginationState, // Import PaginationState
} from "@tanstack/react-table"; // Import RowSelectionState and SortingState
import { useToast } from "@/lib/toast"; // Import custom toast hook
import { useAPIStore } from "@/store/apiStore"; // Import the API store
import { useUIStore, initialHistorySorting } from "@/store/uiStore"; // Import the UI store and initialHistorySorting

interface SimulationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulations: SimulationHistoryEntry[]; // Array of simulation data (will be fetched later)
  onLoadSimulation: (simulationId: number) => void; // Function to handle loading a simulation
  isLoading?: boolean; // Optional loading state
  loadedSimulationId?: number | null; // Add prop to receive the currently loaded ID
  isSimulating?: boolean; // Add prop to know if a simulation is running
  onRefreshHistory?: () => void; // Add prop for refresh callback
}

export function SimulationHistoryModal({
  isOpen,
  onClose,
  simulations, // Use data passed from parent
  onLoadSimulation,
  isLoading = false,
  loadedSimulationId, // Destructure the new prop
  isSimulating = false, // Destructure the new prop with a default
  onRefreshHistory, // Destructure the new prop - *Note: deleteSimulations in apiStore now handles refresh*
}: SimulationHistoryModalProps) {
  // Select state and actions individually from uiStore to prevent infinite loops
  const historyRowSelection = useUIStore((state) => state.historyRowSelection);
  const setHistoryRowSelection = useUIStore(
    (state) => state.setHistoryRowSelection
  );
  const historySorting = useUIStore((state) => state.historySorting);
  const setHistorySorting = useUIStore((state) => state.setHistorySorting);
  const historyPagination = useUIStore((state) => state.historyPagination);
  const setHistoryPagination = useUIStore(
    (state) => state.setHistoryPagination
  );

  const [isDeleting, setIsDeleting] = React.useState(false);
  const { toast } = useToast();
  const { deleteSimulations } = useAPIStore(); // Get the delete action from the store

  // Override to ensure both simulations and pagination state are in sync
  React.useEffect(() => {
    // Force pageSize to 8 and reset to first page if pageSize doesn't match
    if (historyPagination.pageSize !== 8) {
      setHistoryPagination({
        pageIndex: 0,
        pageSize: 8,
      });
    }
  }, [historyPagination.pageSize, setHistoryPagination]);

  // Always slice data to display exactly 8 rows for current page
  const displayData = React.useMemo(() => {
    const startIndex = historyPagination.pageIndex * 8;
    // Add a page-specific id to each row to make selection work correctly across pages
    return simulations.slice(startIndex, startIndex + 8).map((sim, index) => ({
      ...sim,
      // Add a unique ID property that combines page and row index
      __uniquePageRowId: `page${historyPagination.pageIndex}_row${index}`,
    }));
  }, [simulations, historyPagination.pageIndex]);

  // Create a wrapper for pagination that fixes pageSize to 8
  const handlePaginationChange = React.useCallback(
    (updater: React.SetStateAction<PaginationState>) => {
      // Clear row selection when changing pages
      setHistoryRowSelection({});

      if (typeof updater === "function") {
        setHistoryPagination((prev) => {
          const updated = updater(prev);
          return { ...updated, pageSize: 8 }; // Force 8 rows
        });
      } else {
        setHistoryPagination({ ...updater, pageSize: 8 }); // Force 8 rows
      }
    },
    [setHistoryPagination, setHistoryRowSelection]
  );

  // Memoize columns definition to prevent re-creation on every render
  // Pass onLoadSimulation, loadedSimulationId, AND isSimulating into the columns definition
  const tableColumns = React.useMemo(
    () => columns(onLoadSimulation, loadedSimulationId ?? null, isSimulating), // Pass isSimulating here
    [onLoadSimulation, loadedSimulationId, isSimulating] // Add isSimulating to dependency array
  );

  // Get number of selected rows
  const selectedRowCount = Object.keys(historyRowSelection).length;

  const handleDeleteSelected = () => {
    handleDeleteSelectedSimulations();
  };

  // Function to handle the delete API call - Refactored to use apiStore
  const handleDeleteSelectedSimulations = async () => {
    const selectedIndices = Object.keys(historyRowSelection);

    // Create a map of all simulations with their unique IDs
    const simulationMap = React.useMemo(() => {
      const map = new Map();
      simulations.forEach((sim, index) => {
        const pageIndex = Math.floor(index / 8);
        const rowIndex = index % 8;
        const uniqueId = `page${pageIndex}_row${rowIndex}`;
        map.set(uniqueId, sim.SIMULATION_ID);
      });
      return map;
    }, [simulations]);

    // Map the selected unique IDs to their actual simulation IDs
    const selectedIds = selectedIndices
      .map((uniqueId) => {
        if (simulationMap.has(uniqueId)) {
          return simulationMap.get(uniqueId);
        } else {
          console.error("Invalid unique ID found in rowSelection:", uniqueId);
          return null;
        }
      })
      .filter((id): id is number => id !== null); // Filter out nulls and type guard

    if (selectedIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select simulations to delete.",
        variant: "warning",
      });
      return;
    }

    setIsDeleting(true);
    toast({
      title: "Deleting Simulations...",
      description: `Attempting to delete ${selectedIds.length} selected simulation(s).`,
      variant: "default", // Use default variant while processing
    });

    // Call the action from the apiStore
    const result = await deleteSimulations(selectedIds);

    if (result.success) {
      toast({
        title: "Deletion Successful",
        description: result.message,
        variant: "success",
      });
      // Clear selection using uiStore action
      setHistoryRowSelection({});
    } else {
      toast({
        title: "Deletion Failed",
        description: result.message,
        variant: "destructive",
      });
    }

    setIsDeleting(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Reset selection using uiStore action when closing
          setHistoryRowSelection({});
          onClose();
        } else {
          // Dialog handles its own opening state based on the isOpen prop
          // No need to explicitly call onClose() here when opening
        }
      }}
    >
      <DialogContent className="!max-w-fit max-h-[80vh] flex flex-col">
        {" "}
        {/* Adjusted width and height */}
        <DialogHeader>
          <DialogTitle>Simulation History</DialogTitle>
          <DialogDescription>
            Review past simulation runs, load their results, or select runs to
            delete.
          </DialogDescription>
        </DialogHeader>
        {/* Add Reset Sort Button */}
        {historySorting && historySorting.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistorySorting(initialHistorySorting)}
            className="mb-2 text-xs"
          >
            Reset Sort
          </Button>
        )}
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <IconLoader className="inline-block animate-spin mr-2" /> Loading
            history...
          </div>
        ) : simulations.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No simulation history found.
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              columns={tableColumns}
              data={displayData}
              // Pass state and setters from uiStore
              rowSelection={historyRowSelection}
              setRowSelection={setHistoryRowSelection}
              sorting={historySorting}
              setSorting={setHistorySorting}
              // --- Pass Pagination Props from uiStore ---
              pageIndex={historyPagination.pageIndex}
              pageSize={8} // Force 8 rows per page
              pageCount={Math.ceil(simulations.length / 8)}
              onPaginationChange={handlePaginationChange}
              // --- End Pagination Props ---
              hideRowsPerPage={true} // Hide the rows per page selector
              tableHeight="auto" // Set auto height to remove scrolling
            />
          </div>
        )}
        <DialogFooter className="sm:justify-between">
          {" "}
          {/* Adjust footer layout */}
          <div>
            {" "}
            {/* Left side for Delete button */}
            {selectedRowCount > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={
                  selectedRowCount === 0 ||
                  isDeleting ||
                  isLoading ||
                  isSimulating
                }
              >
                {isDeleting ? (
                  <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconTrash className="mr-2 h-4 w-4" />
                )}
                Delete ({selectedRowCount})
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {" "}
            {/* Refresh Button */}
            {onRefreshHistory && (
              <Button
                variant="outline"
                onClick={onRefreshHistory}
                disabled={isLoading || isSimulating}
              >
                <IconLoader className="h-4 w-4" />
                Refresh History
              </Button>
            )}
            {/* Right side for Close button */}
            <DialogClose asChild>
              <Button variant="outline">
                {" "}
                {/* Removed onClick={onClose} as DialogClose handles it */}
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SimulationHistoryModal;
