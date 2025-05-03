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
import { RowSelectionState } from "@tanstack/react-table"; // Import RowSelectionState

interface SimulationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulations: SimulationHistoryEntry[]; // Array of simulation data (will be fetched later)
  onLoadSimulation: (simulationId: number) => void; // Function to handle loading a simulation
  isLoading?: boolean; // Optional loading state
}

export function SimulationHistoryModal({
  isOpen,
  onClose,
  simulations, // Use data passed from parent
  onLoadSimulation,
  isLoading = false,
}: SimulationHistoryModalProps) {
  // State for row selection
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Memoize columns definition to prevent re-creation on every render
  // Pass onLoadSimulation into the columns definition
  const tableColumns = React.useMemo(
    () => columns(onLoadSimulation),
    [onLoadSimulation]
  );

  // Get number of selected rows
  const selectedRowCount = Object.keys(rowSelection).length;

  const handleDeleteSelected = () => {
    const selectedIds = Object.keys(rowSelection).map(
      (index) => simulations[parseInt(index)].SIMULATION_ID
    );
    console.log("TODO: Implement delete logic for IDs:", selectedIds);
    // Reset selection after (potential) delete action
    setRowSelection({});
    // Here you would call the API endpoint to delete simulations
    // Example: deleteSimulations(selectedIds).then(() => { refreshHistory(); onClose(); });
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
                disabled={true} // Keep disabled until delete logic is ready
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Delete ({selectedRowCount})
              </Button>
            )}
          </div>
          <div>
            {" "}
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
