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
import { API_BASE_URL } from "@/lib/constants"; // Import base URL

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
  onRefreshHistory, // Destructure the new prop
}: SimulationHistoryModalProps) {
  // State for row selection
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  // State for sorting
  const [sorting, setSorting] = React.useState<SortingState>([]);
  // Add state for delete loading
  const [isDeleting, setIsDeleting] = React.useState(false);
  // Use custom toast
  const { toast } = useToast();

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

  // Function to handle the delete API call
  const handleDeleteSelectedSimulations = async () => {
    const selectedIds = Object.keys(rowSelection).map(
      (index) => simulations[parseInt(index)].SIMULATION_ID
    );

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
      variant: "info",
    });

    try {
      const response = await fetch(`${API_BASE_URL}/delete_history`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ simulationId: selectedIds }), // Match backend expected key
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP Error ${response.status}`);
      }

      toast({
        title: "Deletion Successful",
        description:
          result.message || `${selectedIds.length} simulation(s) deleted.`,
        variant: "success",
      });

      setRowSelection({}); // Clear selection
      if (onRefreshHistory) {
        onRefreshHistory(); // Refresh the list in the parent
      }
    } catch (error: any) {
      console.error("Failed to delete simulations:", error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete selected simulations.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
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
