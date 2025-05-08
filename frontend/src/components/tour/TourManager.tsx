"use client";

import { useEffect, useState } from "react";
import { useTourStore } from "@/store/tourStore";
import { useSimulationStore } from "@/store/simulationStore";
import TourSpeechBubble from "./TourSpeechBubble";

// This component is responsible for managing the tour state
// based on the application state
const TourManager: React.FC = () => {
  const {
    isActive,
    startTour,
    setHasSimulation,
    hasCompletedSection1,
    getActiveSection1Steps,
  } = useTourStore();

  // Add a delay tracking state to prevent premature tour display
  const [canShowSection2, setCanShowSection2] = useState(false);

  // Check if there's an active simulation
  const simulationResult = useSimulationStore(
    (state: any) => state.simulationResult
  );
  const isLoading = useSimulationStore((state: any) => state.isLoading);
  const isSimulating = useSimulationStore((state: any) => state.isSimulating);
  const isMapLoading = useSimulationStore((state: any) => state.isMapLoading);

  // Get simulatePassengers state to watch for changes
  const simulatePassengers = useSimulationStore(
    (state: any) => state.simulatePassengers
  );

  // We have a simulation if there's simulation result data
  const hasSimulation = !!simulationResult;

  // Determine if ANY loading state is active
  const isAnyLoading = isLoading || isSimulating || isMapLoading;

  // Reset canShowSection2 flag whenever loading starts
  useEffect(() => {
    if (isAnyLoading) {
      setCanShowSection2(false);
    }
  }, [isAnyLoading]);

  // When simulation status changes, update the tour store
  useEffect(() => {
    if (hasSimulation && !isAnyLoading) {
      // Only set the simulation state if we're fully loaded
      setHasSimulation(true);

      // Set a delay before we can show section 2
      // This helps with both auto-transition and manual clicks
      const timer = setTimeout(() => {
        setCanShowSection2(true);
      }, 800); // Longer delay to ensure UI is fully rendered

      return () => clearTimeout(timer);
    }
  }, [hasSimulation, isAnyLoading, setHasSimulation]);

  // When the simulation finishes loading, check if we need to start section 2 of the tour
  useEffect(() => {
    if (
      hasCompletedSection1 &&
      hasSimulation &&
      !isAnyLoading &&
      canShowSection2
    ) {
      // Now we can safely start section 2
      setHasSimulation(true);
    }
  }, [
    hasCompletedSection1,
    hasSimulation,
    isAnyLoading,
    canShowSection2,
    setHasSimulation,
  ]);

  // Only render the speech bubble if we're not in a loading state or we're showing section 1
  const shouldShowTour =
    isActive && (!isAnyLoading || useTourStore.getState().currentSection === 1);

  return shouldShowTour ? <TourSpeechBubble /> : null;
};

export default TourManager;
