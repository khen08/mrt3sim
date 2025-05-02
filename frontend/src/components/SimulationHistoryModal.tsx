"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IconLoader } from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area"; // Added for scrollable table

// Define the structure for a single simulation history entry based on provided columns
interface SimulationHistoryEntry {
  SIMULATION_ID: number;
  CREATED_AT: string; // Format: YYYY-MM-DD HH:MM:SS
  PASSENGER_DATA_FILE: string;
  START_TIME: string; // Format: YYYY-MM-DD HH:MM:SS
  END_TIME: string; // Format: YYYY-MM-DD HH:MM:SS
  TOTAL_RUN_TIME_SECONDS: number;
}

interface SimulationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulations: SimulationHistoryEntry[]; // Array of simulation data (will be fetched later)
  onLoadSimulation: (simulationId: number) => void; // Function to handle loading a simulation
  isLoading?: boolean; // Optional loading state
}

// --- Sample Data (Remove once backend integration is ready) ---
const sampleSimulations: SimulationHistoryEntry[] = [
  {
    SIMULATION_ID: 123,
    CREATED_AT: "2024-07-28 10:30:15",
    PASSENGER_DATA_FILE: "sample_passenger_flow_v1.csv",
    START_TIME: "2024-07-28 05:00:00",
    END_TIME: "2024-07-28 22:00:00",
    TOTAL_RUN_TIME_SECONDS: 123.456,
  },
  {
    SIMULATION_ID: 124,
    CREATED_AT: "2024-07-29 11:05:45",
    PASSENGER_DATA_FILE: "peak_hour_test.csv",
    START_TIME: "2024-07-29 06:00:00",
    END_TIME: "2024-07-29 10:00:00",
    TOTAL_RUN_TIME_SECONDS: 45.123,
  },
  {
    SIMULATION_ID: 125,
    CREATED_AT: "2024-07-30 14:20:00",
    PASSENGER_DATA_FILE: "full_day_scenario.csv",
    START_TIME: "2024-07-30 04:30:00",
    END_TIME: "2024-07-30 23:00:00",
    TOTAL_RUN_TIME_SECONDS: 180.987,
  },
];
// --- End Sample Data ---

export function SimulationHistoryModal({
  isOpen,
  onClose,
  simulations = sampleSimulations, // Use sample data for now
  onLoadSimulation,
  isLoading = false,
}: SimulationHistoryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        {" "}
        {/* Increased width */}
        <DialogHeader>
          <DialogTitle>Simulation History</DialogTitle>
          <DialogDescription>
            Review past simulation runs and load their configuration and
            results.
          </DialogDescription>
        </DialogHeader>
        {/* Wrap table in ScrollArea for responsiveness */}
        <ScrollArea className="h-[400px] w-full pr-4">
          {" "}
          {/* Fixed height and padding */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead className="w-[150px]">Created</TableHead>
                <TableHead>Input File</TableHead>
                <TableHead className="w-[150px]">Sim Start</TableHead>
                <TableHead className="w-[150px]">Sim End</TableHead>
                <TableHead className="w-[100px] text-right">Duration</TableHead>
                <TableHead className="w-[80px] text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <IconLoader className="inline-block animate-spin mr-2" />{" "}
                    Loading history...
                  </TableCell>
                </TableRow>
              ) : simulations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No simulation history found.
                  </TableCell>
                </TableRow>
              ) : (
                simulations.map((sim) => (
                  <TableRow key={sim.SIMULATION_ID}>
                    <TableCell className="font-medium">
                      {sim.SIMULATION_ID}
                    </TableCell>
                    <TableCell>{sim.CREATED_AT}</TableCell>
                    <TableCell
                      className="truncate max-w-[200px]"
                      title={sim.PASSENGER_DATA_FILE}
                    >
                      {sim.PASSENGER_DATA_FILE}
                    </TableCell>
                    <TableCell>{sim.START_TIME}</TableCell>
                    <TableCell>{sim.END_TIME}</TableCell>
                    <TableCell className="text-right">
                      {sim.TOTAL_RUN_TIME_SECONDS.toFixed(2)}s
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLoadSimulation(sim.SIMULATION_ID)}
                      >
                        Load
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SimulationHistoryModal;
