import { create } from "zustand";
import { SortingState, PaginationState } from "@tanstack/react-table"; // Import types
import { filter, sort, paginate } from "@/store/modalStoreUtils"; // Assume utility functions exist
import { useSimulationStore } from "./simulationStore"; // To get simulationResult
import { useAPIStore } from "@/store/apiStore"; // To get fetch functions
import { useMemo } from "react";
import { PEAK_HOURS } from "@/lib/constants"; // Import peak hour constants
import { parseTime } from "@/lib/timeUtils"; // Import time parsing utility

export type TabId =
  | "timetable"
  | "passengerDemand"
  | "metrics"
  | "metricsSummary";

export type PeakHourFilter = "ALL" | "AM" | "PM";

// Define the full data structure (adjust 'any' as needed)
// Example for timetable, others might differ
interface TimetableEntry {
  MOVEMENT_ID?: number;
  SCHEME_TYPE?: string;
  TRAIN_ID: number;
  TRAIN_SERVICE_TYPE?: string;
  STATION_ID: number;
  DIRECTION: "NORTHBOUND" | "SOUTHBOUND";
  TRAIN_STATUS: string;
  ARRIVAL_TIME: string | null;
  DEPARTURE_TIME: string | null;
  TRAVEL_TIME_SECONDS?: number;
  // Add other potential fields
}

type RawData = Record<TabId, any[]>; // Store raw data per tab

// Structure to store tab-specific UI state
interface TabState {
  searchQuery: string;
  sorting: SortingState;
  pagination: PaginationState;
  peakHourFilter: PeakHourFilter;
}

// Type for the state part of ModalState
interface ModalStateProperties {
  isModalOpen: boolean;
  activeTabId: TabId;
  rawData: RawData;
  isLoading: Record<TabId, boolean>;
  error: Record<TabId, string | null>;
  // Track state per tab
  tabState: Record<TabId, TabState>;
  lastLoadedSimulationId: number | null; // Track the simulation ID associated with current data
}

interface ModalActions {
  openModal: (initialTab?: TabId) => void;
  closeModal: () => void;
  setActiveTabId: (tabId: TabId) => void;
  setRawData: (tabId: TabId, data: any[]) => void;
  setIsLoading: (tabId: TabId, loading: boolean) => void;
  setError: (tabId: TabId, error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (
    sortingUpdater: SortingState | ((old: SortingState) => SortingState)
  ) => void;
  setPagination: (
    paginationUpdater:
      | PaginationState
      | ((old: PaginationState) => PaginationState)
  ) => void;
  setPeakHourFilter: (filter: PeakHourFilter) => void;
  resetViewState: () => void;
  resetData: () => void; // New action to reset data but keep UI state
  setLastLoadedSimulationId: (id: number | null) => void;
}

interface ModalState extends ModalStateProperties {
  actions: ModalActions;
}

const DEFAULT_PAGE_SIZE = 50;

const initialPagination: PaginationState = {
  pageIndex: 0, // 0-based index
  pageSize: DEFAULT_PAGE_SIZE,
};

const initialPaginationState: PaginationState = { pageIndex: 0, pageSize: 10 };

// Initial state for a single tab
const createInitialTabState = (): TabState => ({
  searchQuery: "",
  sorting: [],
  pagination: initialPaginationState,
  peakHourFilter: "ALL",
});

const initialStateProperties: ModalStateProperties = {
  isModalOpen: false,
  activeTabId: "timetable",
  rawData: {
    timetable: [],
    passengerDemand: [],
    metrics: [],
    metricsSummary: [],
  },
  isLoading: {
    timetable: false,
    passengerDemand: false,
    metrics: false,
    metricsSummary: false,
  },
  error: {
    timetable: null,
    passengerDemand: null,
    metrics: null,
    metricsSummary: null,
  },
  // Initialize state for each tab
  tabState: {
    timetable: createInitialTabState(),
    passengerDemand: createInitialTabState(),
    metrics: createInitialTabState(),
    metricsSummary: createInitialTabState(),
  },
  lastLoadedSimulationId: null,
};

// Create the store
export const useModalStore = create<ModalState>((set, get) => ({
  ...initialStateProperties,
  actions: {
    openModal: (initialTab: TabId = "timetable") => {
      // Just open the modal but don't reset the tab's state
      set({ isModalOpen: true, activeTabId: initialTab });

      const simulationId = useSimulationStore.getState().loadedSimulationId;
      if (simulationId) {
        const apiStore = useAPIStore.getState();
        // Only fetch if we don't already have data
        const currentTabData = get().rawData[initialTab] || [];
        if (currentTabData.length === 0) {
          // Set loading state for the specific tab
          set((state) => ({
            isLoading: {
              ...state.isLoading,
              [initialTab]: true,
            },
          }));

          if (initialTab === "timetable") apiStore.fetchTimetable(simulationId);
          if (initialTab === "passengerDemand")
            apiStore.fetchPassengerDemand(simulationId);
          if (initialTab === "metrics")
            apiStore.fetchSimulationMetrics(simulationId);
        }
      }
    },
    closeModal: () => {
      // Just close the modal without resetting any state
      set({ isModalOpen: false });
    },
    setActiveTabId: (tabId: TabId) => {
      // First check if we're already on this tab to avoid unnecessary re-renders
      if (get().activeTabId === tabId) return;

      // Now switch the active tab
      set({ activeTabId: tabId });

      const simulationId = useSimulationStore.getState().loadedSimulationId;
      if (simulationId) {
        // Check if data already exists for this tab and avoid fetching if it does
        const currentRawData = get().rawData[tabId] || [];
        const isCurrentlyLoading = get().isLoading[tabId];

        if (currentRawData.length === 0 && !isCurrentlyLoading) {
          // Only set loading state if we actually need to fetch
          set((state) => ({
            isLoading: {
              ...state.isLoading,
              [tabId]: true,
            },
            error: {
              ...state.error,
              [tabId]: null, // Clear any previous errors
            },
          }));

          const apiStore = useAPIStore.getState();
          if (tabId === "timetable") apiStore.fetchTimetable(simulationId);
          if (tabId === "passengerDemand")
            apiStore.fetchPassengerDemand(simulationId);
          if (tabId === "metrics")
            apiStore.fetchSimulationMetrics(simulationId);
        }
      }
    },
    setRawData: (tabId: TabId, data: any[]) => {
      // Update data and clear loading/error state for this specific tab
      set((state) => ({
        rawData: { ...state.rawData, [tabId]: data },
        isLoading: {
          ...state.isLoading,
          [tabId]: false,
        },
        error: {
          ...state.error,
          [tabId]: null,
        },
      }));
    },
    setIsLoading: (tabId: TabId, loading: boolean) => {
      // Set loading state for a specific tab
      set((state) => ({
        isLoading: {
          ...state.isLoading,
          [tabId]: loading,
        },
      }));
    },
    setError: (tabId: TabId, error: string | null) => {
      // Set error state for a specific tab and clear its loading state
      set((state) => ({
        error: {
          ...state.error,
          [tabId]: error,
        },
        isLoading: {
          ...state.isLoading,
          [tabId]: false,
        },
      }));
    },
    setSearchQuery: (query: string) =>
      set((state) => {
        const activeTabId = state.activeTabId;
        const currentTabState = state.tabState[activeTabId];
        const newTabState = {
          ...currentTabState,
          searchQuery: query,
          pagination: { ...currentTabState.pagination, pageIndex: 0 },
        };

        return {
          tabState: {
            ...state.tabState,
            [activeTabId]: newTabState,
          },
        };
      }),
    setSorting: (sortingUpdater) =>
      set((state) => {
        const activeTabId = state.activeTabId;
        const currentTabState = state.tabState[activeTabId];
        const newSorting =
          typeof sortingUpdater === "function"
            ? sortingUpdater(currentTabState.sorting)
            : sortingUpdater;

        return {
          tabState: {
            ...state.tabState,
            [activeTabId]: {
              ...currentTabState,
              sorting: newSorting,
            },
          },
        };
      }),
    setPagination: (paginationUpdater) =>
      set((state) => {
        const activeTabId = state.activeTabId;
        const currentTabState = state.tabState[activeTabId];
        const newPagination =
          typeof paginationUpdater === "function"
            ? paginationUpdater(currentTabState.pagination)
            : paginationUpdater;

        return {
          tabState: {
            ...state.tabState,
            [activeTabId]: {
              ...currentTabState,
              pagination: newPagination,
            },
          },
        };
      }),
    setPeakHourFilter: (filter: PeakHourFilter) =>
      set((state) => {
        const activeTabId = state.activeTabId;
        const currentTabState = state.tabState[activeTabId];

        return {
          tabState: {
            ...state.tabState,
            [activeTabId]: {
              ...currentTabState,
              peakHourFilter: filter,
              pagination: { ...currentTabState.pagination, pageIndex: 0 },
            },
          },
        };
      }),
    resetViewState: () => {
      // Reset only the active tab's view state
      const activeTabId = get().activeTabId;
      set((state) => ({
        tabState: {
          ...state.tabState,
          [activeTabId]: createInitialTabState(),
        },
        // Clear error but NOT loading state for the active tab
        error: {
          ...state.error,
          [activeTabId]: null,
        },
      }));
    },
    resetData: () => {
      // Reset both data and all tab states
      set({
        rawData: {
          timetable: [],
          passengerDemand: [],
          metrics: [],
          metricsSummary: [],
        },
        tabState: {
          timetable: createInitialTabState(),
          passengerDemand: createInitialTabState(),
          metrics: createInitialTabState(),
          metricsSummary: createInitialTabState(),
        },
        isLoading: {
          timetable: false,
          passengerDemand: false,
          metrics: false,
          metricsSummary: false,
        },
        error: {
          timetable: null,
          passengerDemand: null,
          metrics: null,
          metricsSummary: null,
        },
      });
    },
    setLastLoadedSimulationId: (id: number | null) => {
      // If the simulation ID changes, we should reset our data
      const currentId = get().lastLoadedSimulationId;
      if (id !== currentId) {
        // Clear data when simulation changes
        get().actions.resetData();
      }
      set({ lastLoadedSimulationId: id });
    },
  },
}));

// Filter function for peak hours
const filterByPeakHours = (data: any[], peakFilter: PeakHourFilter): any[] => {
  if (peakFilter === "ALL") return data;

  const peakRange = PEAK_HOURS[peakFilter === "AM" ? "AM" : "PM"];
  const startSeconds = parseTime(peakRange.start);
  const endSeconds = parseTime(peakRange.end);

  return data.filter((entry) => {
    // For timetable data, check DEPARTURE_TIME only
    if (entry.DEPARTURE_TIME) {
      const entrySeconds = parseTime(entry.DEPARTURE_TIME);
      return entrySeconds >= startSeconds && entrySeconds <= endSeconds;
    }
    return true; // Include entries without time data
  });
};

// --- Custom hook for convenience ---
export const useDataViewer = () => {
  // Use selectors for better performance
  const activeTabId = useModalStore((state) => state.activeTabId);
  const rawData = useModalStore((state) => state.rawData[activeTabId] || []);
  const isLoading = useModalStore((state) => state.isLoading[activeTabId]);
  const error = useModalStore((state) => state.error[activeTabId]);
  const isModalOpen = useModalStore((state) => state.isModalOpen);
  const tabState = useModalStore((state) => state.tabState[activeTabId]);
  const actions = useModalStore((state) => state.actions);

  // Memoize filtered and processed data to prevent unnecessary recalculations
  const filteredData = useMemo(() => {
    // Apply peak hour filter to timetable data
    const peakHourFiltered =
      activeTabId === "timetable"
        ? filterByPeakHours(rawData, tabState.peakHourFilter)
        : rawData;

    // Then apply search filter
    if (!tabState.searchQuery) return peakHourFiltered;
    return filter(peakHourFiltered, tabState.searchQuery);
  }, [rawData, activeTabId, tabState.peakHourFilter, tabState.searchQuery]);

  const sortedData = useMemo(() => {
    return sort(filteredData, tabState.sorting);
  }, [filteredData, tabState.sorting]);

  const currentPageData = useMemo(() => {
    return paginate(
      sortedData,
      tabState.pagination.pageIndex,
      tabState.pagination.pageSize
    );
  }, [sortedData, tabState.pagination.pageIndex, tabState.pagination.pageSize]);

  const pageCount = useMemo(() => {
    return Math.ceil(sortedData.length / tabState.pagination.pageSize);
  }, [sortedData.length, tabState.pagination.pageSize]);

  const totalItems = useMemo(() => sortedData.length, [sortedData]);

  return {
    // Base state
    isModalOpen,
    activeTabId,
    isLoading,
    error,

    // Tab-specific state
    searchQuery: tabState.searchQuery,
    sorting: tabState.sorting,
    pagination: tabState.pagination,
    peakHourFilter: tabState.peakHourFilter,

    // Computed data
    currentPageData,
    pageCount,
    totalItems,
    filteredData,
    hasData: rawData.length > 0,

    // Actions
    ...actions,
  };
};

// Optional: export individual actions if needed elsewhere
// export const openModal = useModalStore.getState().openModal;
// export const closeModal = useModalStore.getState().closeModal;
// ... etc
