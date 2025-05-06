import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSimulationStore } from "@/store/simulationStore";
import { useAPIStore } from "@/store/apiStore"; // <-- Import apiStore
import { useFileStore } from "@/store/fileStore"; // To get filename if needed

export function SimulationNameDialog() {
  const {
    simulationName,
    setSimulationName,
    isSimulationNameDialogOpen,
    setSimulationNameDialogOpen,
    // Get necessary state for the API call
    simulatePassengers,
    simulationInput,
    simulationSettings,
    nextRunFilename,
  } = useSimulationStore();
  const { _executeRunSimulation } = useAPIStore(); // <-- Get the helper action
  const uploadedFileName = useFileStore((state: any) => state.uploadedFileName); // For context

  const [nameInput, setNameInput] = useState(simulationName);

  // Sync local input state with global store when dialog opens
  useEffect(() => {
    if (isSimulationNameDialogOpen) {
      setNameInput(simulationName || "Untitled Simulation");
    }
  }, [isSimulationNameDialogOpen, simulationName]);

  const handleClose = () => {
    setSimulationNameDialogOpen(false);
  };

  const handleSubmit = async () => {
    // <-- Make async
    if (nameInput.trim() === "") {
      // Optionally add validation feedback
      return;
    }
    // Update the global simulation name state
    setSimulationName(nameInput.trim());
    handleClose();

    // --- Trigger the actual simulation run --- //
    if (simulationSettings) {
      // Ensure settings are loaded
      let payloadFilename: string | null = null;
      if (simulatePassengers) {
        payloadFilename = nextRunFilename ?? simulationInput.filename;
      }
      // Call the internal helper from apiStore
      await _executeRunSimulation(
        payloadFilename,
        simulationSettings,
        nameInput.trim()
      );
    } else {
      // Handle error: settings not available
      console.error("Cannot run simulation: Settings not loaded.");
      // Optionally show a toast notification
    }
    // --- End Trigger --- //
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNameInput(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <AlertDialog open={isSimulationNameDialogOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Name Your Simulation Run</AlertDialogTitle>
          <AlertDialogDescription>
            Provide a name for this simulation run. This will help you identify
            it later in the history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="simulation-name">Simulation Name</Label>
          <Input
            id="simulation-name"
            value={nameInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown} // Handle Enter key
            placeholder="e.g., AM Peak - Skip Stop Test"
            className="mt-2"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={!nameInput.trim()}
          >
            Confirm & Run
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
