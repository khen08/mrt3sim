import { memo } from "react";
import { Button } from "@/components/ui/button";
import { IconTable } from "@tabler/icons-react";
import { useUIStore } from "@/store/uiStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useModalStore } from "@/store/modalStore";

function DataViewerButtonComponent() {
  // Get the setter from the UI store
  const setDataViewerModalOpen = useUIStore(
    (state: any) => state.setDataViewerModalOpen
  );
  // Get the open action from the modal store
  const openModal = useModalStore((state) => state.actions.openModal);
  const loadedSimulationId = useSimulationStore(
    (state: any) => state.loadedSimulationId
  );
  const hasResults = !!useSimulationStore(
    (state: any) => state.simulationResult
  )?.length;

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
      onClick={() => {
        setDataViewerModalOpen(true);
        openModal();
      }}
      title="View detailed simulation data"
    >
      <IconTable className="mr-2 h-4 w-4" />
      View Simulation Data
    </Button>
  );
}

// Use memo to prevent re-renders when parent components update
export const DataViewerButton = memo(DataViewerButtonComponent);
