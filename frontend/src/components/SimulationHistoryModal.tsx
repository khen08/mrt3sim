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
import { RowSelectionState, SortingState } from "@tanstack/react-table"; // Import RowSelectionState and SortingState
import { useToast } from "@/lib/toast"; // Import custom toast hook
import { useAPIStore } from "@/store/apiStore"; // Import the API store

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
  // State for row selection
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "CREATED_AT", desc: true }, // Default sort by creation date descending
  ]);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { toast } = useToast();
  const { deleteSimulations } = useAPIStore(); // Get the delete action from the store

  // Memoize columns definition to prevent re-creation on every render
  // Pass onLoadSimulation, loadedSimulationId, AND isSimulating into the columns definition
  const tableColumns = React.useMemo(
    () => columns(onLoadSimulation, loadedSimulationId ?? null, isSimulating), // Pass isSimulating here
    [onLoadSimulation, loadedSimulationId, isSimulating] // Add isSimulating to dependency array
  );

  // Get number of selected rows
  const selectedRowCount = Object.keys(rowSelection).length;

  const handleDeleteSelected = () => {
    handleDeleteSelectedSimulations();
  };

  // Function to handle the delete API call - Refactored to use apiStore
  const handleDeleteSelectedSimulations = async () => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedIds = selectedIndices
      .map((index) => {
        const simIndex = parseInt(index, 10);
        // Add boundary check
        if (simIndex >= 0 && simIndex < simulations.length) {
          return simulations[simIndex].SIMULATION_ID;
        } else {
          console.error("Invalid index found in rowSelection:", index);
          return null; // Or handle error appropriately
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
      setRowSelection({}); // Clear selection on success
      // No need to call onRefreshHistory here, apiStore action handles it
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
          setRowSelection({}); // Reset selection when closing
          onClose();
        } else {
          // Dialog handles its own opening state based on the isOpen prop
          // No need to explicitly call onClose() here when opening
        }
      }}
    >
      <DialogContent className="!max-w-fit min-w-[800px]">
        {" "}
        {/* Adjusted width */}
        <DialogHeader>
          <DialogTitle>Simulation History</DialogTitle>
          <DialogDescription>
            Review past simulation runs, load their results, or select runs to
            delete.
          </DialogDescription>
        </DialogHeader>
        {/* Wrap table in ScrollArea for responsiveness */}
        {/* <ScrollArea className="h-[400px] w-full pr-4"> */}
        {/* Replaced old Table with DataTable */}
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
          <DataTable
            columns={tableColumns}
            data={simulations}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            sorting={sorting}
            setSorting={setSorting}
          />
        )}
        {/* </ScrollArea> */}
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
