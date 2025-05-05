import { memo } from "react";
import { Button } from "@/components/ui/button";
import { IconTable } from "@tabler/icons-react";
import { useModalStore } from "@/store/modalStore";

function DataViewerButtonComponent() {
  // Only get what's needed to avoid unnecessary re-renders
  const openModal = useModalStore((state) => state.openModal);

  return (
    <Button
      variant="outline"
      className="w-full justify-start"
      onClick={openModal}
    >
      <IconTable className="mr-2 h-4 w-4" />
      <span>Data Viewer</span>
    </Button>
  );
}

// Use memo to prevent re-renders when parent components update
export const DataViewerButton = memo(DataViewerButtonComponent);
