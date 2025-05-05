import { memo } from "react";
import { Button } from "@/components/ui/button";
import { IconTable } from "@tabler/icons-react";
import { useUIStore } from "@/store/uiStore";
import { useSimulationStore } from "@/store/simulationStore";
import { cn } from "@/lib/utils";

function DataViewerButtonComponent() {
  // Get the setter from the UI store
  const setDataViewerModalOpen = useUIStore(
    (state) => state.setDataViewerModalOpen
  );
  const loadedSimulationId = useSimulationStore(
    (state) => state.loadedSimulationId
  );
  const hasResults = !!useSimulationStore((state) => state.simulationResult)
    ?.length;

  // Check if there's data to view
  const hasData = hasResults || loadedSimulationId !== null;

  // Don't render anything if no data is available
  if (!hasData) {
    return null;
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start text-left"
      onClick={() => setDataViewerModalOpen(true)}
      title="View detailed simulation data"
    >
      <IconTable className="mr-2 h-4 w-4" />
      View Simulation Data
    </Button>
  );
}

// Use memo to prevent re-renders when parent components update
export const DataViewerButton = memo(DataViewerButtonComponent);
