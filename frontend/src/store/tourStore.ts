import { create } from "zustand";
import { useSimulationStore } from "./simulationStore";

export interface TourStep {
  id: string;
  title: string;
  content: string;
  image: string;
  target?: string; // CSS selector for the element to highlight
  placement?: "top" | "right" | "bottom" | "left" | "center";
}

interface TourState {
  isActive: boolean;
  currentSection: 1 | 2; // 1 = Pre-Simulation, 2 = Post-Simulation
  currentStepIndex: number;
  hasCompletedSection1: boolean;
  hasCompletedSection2: boolean;
  section1Steps: TourStep[];
  section2Steps: TourStep[];

  // Actions
  startTour: (section?: 1 | 2) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  setHasSimulation: (hasSimulation: boolean) => void;
  resetTour: () => void;
  // Function to get active section steps based on simulatePassengers state
  getActiveSection1Steps: () => TourStep[];
}

// Define the tour steps for each section
const section1Steps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to MRT-3 Simulator!",
    content:
      "Hi there! I'm Marty, your MRT-3 simulation guide! This tool helps you simulate, analyze and optimize Manila's metro rail operations using real system data. Let me show you how to get started!",
    image: "/greet.png",
    placement: "center",
  },
  {
    id: "data-input",
    title: "Data Input (Optional)",
    content:
      "If you enable 'Simulate Passenger Flow' in the settings, you'll need to upload passenger demand data for the MRT-3 system. This is optional - you can also run train-only simulations without passenger data. When enabled, the simulator accepts CSV files with time-based passenger counts for each station.",
    image: "/yapping.png",
    target: ".csv-upload-area", // Target the upload component
    placement: "right",
  },
  {
    id: "simulation-settings",
    title: "Simulation Settings",
    content:
      "Configure your simulation parameters in the sidebar. Adjust train frequency (headway), capacity, and operating schedules. You can set service periods with specific train counts and even implement skip-stop patterns to improve efficiency. Don't forget to name your simulation before clicking 'Run Simulation'!",
    image: "/yapping-2.png",
    target: ".simulation-settings", // Target the settings component
    placement: "right",
  },
];

const section2Steps: TourStep[] = [
  {
    id: "map-overview",
    title: "Map Overview",
    content:
      "Your simulation is running! The map shows trains moving along the MRT-3 line with real-time positions. Northbound trains are green, southbound are yellow. Click on any train or station to view detailed information including schedules, passenger loads, and status updates.",
    image: "/grin.png",
    target: ".mrt-map-container", // Target the map container
    placement: "left",
  },
  {
    id: "simulation-controls",
    title: "Simulation Controls",
    content:
      "Control your simulation using these tools. You can pause/resume, adjust the simulation speed, or jump to specific times. Watch how trains operate according to the timetable you've configured and observe passenger flows throughout the system.",
    image: "/yapping.png",
    target: ".simulation-controller", // Target the controls container
    placement: "top",
  },
  {
    id: "analysis-results",
    title: "Data Analysis Tools",
    content:
      "Click 'View Simulation Data' to explore detailed metrics, timetables, and performance data for your simulation. You can analyze key measurements like passenger wait times, train occupancy levels, and system throughput to identify bottlenecks and opportunities for improvement.",
    image: "/yapping-2.png",
    target: ".data-viewer-button", // Target the data viewer button
    placement: "right",
  },
  {
    id: "history-management",
    title: "History & Data Management",
    content:
      "Access your saved simulations through the 'Simulation History' button. You can compare different scenarios, reload previous simulations, or export the results for further analysis. This makes it easy to track improvements across multiple simulation runs.",
    image: "/grin.png",
    target: ".history-button", // Target the history button
    placement: "right",
  },
  {
    id: "completion",
    title: "Ready to Optimize!",
    content:
      "Great job! You're now ready to create and analyze MRT-3 simulations. Experiment with different parameters to find optimal operating conditions. If you need this tour again, just click the train icon in the sidebar header. Happy simulating!",
    image: "/yippie.png",
    placement: "center",
  },
];

export const useTourStore = create<TourState>((set, get) => ({
  isActive: false,
  currentSection: 1,
  currentStepIndex: 0,
  hasCompletedSection1: false,
  hasCompletedSection2: false,
  section1Steps,
  section2Steps,

  // Function to get active steps based on simulatePassengers state
  getActiveSection1Steps: () => {
    const simulatePassengers = useSimulationStore.getState().simulatePassengers;

    if (simulatePassengers) {
      // If passenger simulation is enabled, include all steps
      return section1Steps;
    } else {
      // If passenger simulation is disabled, skip the data input step
      return [section1Steps[0], section1Steps[2]];
    }
  },

  startTour: (section = 1) =>
    set({
      isActive: true,
      currentSection: section,
      currentStepIndex: 0,
    }),

  endTour: () =>
    set((state) => ({
      isActive: false,
      hasCompletedSection1:
        state.currentSection === 1 ? true : state.hasCompletedSection1,
      hasCompletedSection2:
        state.currentSection === 2 ? true : state.hasCompletedSection2,
    })),

  nextStep: () =>
    set((state) => {
      const steps =
        state.currentSection === 1
          ? state.getActiveSection1Steps()
          : state.section2Steps;

      // If at the last step of section 1, mark section 1 as completed
      if (
        state.currentSection === 1 &&
        state.currentStepIndex === steps.length - 1
      ) {
        return {
          isActive: false,
          hasCompletedSection1: true,
        };
      }

      // If at the last step of section 2, mark section 2 as completed
      if (
        state.currentSection === 2 &&
        state.currentStepIndex === steps.length - 1
      ) {
        return {
          isActive: false,
          hasCompletedSection2: true,
        };
      }

      // Otherwise, go to the next step
      return {
        currentStepIndex: Math.min(
          state.currentStepIndex + 1,
          steps.length - 1
        ),
      };
    }),

  prevStep: () =>
    set((state) => ({
      currentStepIndex: Math.max(state.currentStepIndex - 1, 0),
    })),

  goToStep: (index) =>
    set((state) => {
      const steps =
        state.currentSection === 1
          ? state.getActiveSection1Steps()
          : state.section2Steps;
      return {
        currentStepIndex: Math.min(Math.max(index, 0), steps.length - 1),
      };
    }),

  setHasSimulation: (hasSimulation) =>
    set((state) => {
      // If we have a simulation and section 1 was just completed,
      // automatically start section 2
      if (
        hasSimulation &&
        state.hasCompletedSection1 &&
        !state.hasCompletedSection2
      ) {
        return {
          isActive: true,
          currentSection: 2,
          currentStepIndex: 0,
        };
      }
      return {};
    }),

  resetTour: () =>
    set({
      hasCompletedSection1: false,
      hasCompletedSection2: false,
      isActive: false,
      currentStepIndex: 0,
      currentSection: 1,
    }),
}));
