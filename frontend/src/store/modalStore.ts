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
  isLoading: boolean;
  error: string | null;
  // Track state per tab
  tabState: Record<TabId, TabState>;
  lastLoadedSimulationId: number | null; // Track the simulation ID associated with current data
}

interface ModalActions {
  openModal: (initialTab?: TabId) => void;
  closeModal: () => void;
  setActiveTabId: (tabId: TabId) => void;
  setRawData: (tabId: TabId, data: any[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
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
  isLoading: false,
  error: null,
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
          set({ isLoading: true });

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
      // Just switch active tab without resetting its state
      set({ activeTabId: tabId });

      const simulationId = useSimulationStore.getState().loadedSimulationId;
      if (simulationId) {
        const currentRawData = get().rawData[tabId] || [];
        if (currentRawData.length === 0 && !get().isLoading) {
          set({ isLoading: true });
          const apiStore = useAPIStore.getState();
          if (tabId === "timetable") apiStore.fetchTimetable(simulationId);
          if (tabId === "passengerDemand")
            apiStore.fetchPassengerDemand(simulationId);
          if (tabId === "metrics")
            apiStore.fetchSimulationMetrics(simulationId);
        }
      }
    },
    setRawData: (tabId: TabId, data: any[]) =>
      set((state) => ({
        rawData: { ...state.rawData, [tabId]: data },
        isLoading: false,
        error: null,
      })),
    setIsLoading: (loading: boolean) => set({ isLoading: loading }),
    setError: (error: string | null) => set({ error, isLoading: false }),
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
        error: null,
        isLoading: false,
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
        error: null,
        isLoading: false,
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
    // For timetable data, check arrival or departure time
    if (entry.ARRIVAL_TIME || entry.DEPARTURE_TIME) {
      const timeToCheck = entry.ARRIVAL_TIME || entry.DEPARTURE_TIME;
      const entrySeconds = parseTime(timeToCheck);
      return entrySeconds >= startSeconds && entrySeconds <= endSeconds;
    }
    return true; // Include entries without time data
  });
};

// --- Custom hook for convenience ---
export const useDataViewer = () => {
  const store = useModalStore();
  const actions = store.actions;

  const filteredData = useMemo(() => {
    // Get the current raw data for the active tab
    const currentRawData = store.rawData[store.activeTabId] || [];
    const activeTabState = store.tabState[store.activeTabId];

    // Apply peak hour filter to timetable data
    const peakHourFiltered =
      store.activeTabId === "timetable"
        ? filterByPeakHours(currentRawData, activeTabState.peakHourFilter)
        : currentRawData;

    // Then apply search filter
    if (!activeTabState.searchQuery) return peakHourFiltered;
    return filter(peakHourFiltered, activeTabState.searchQuery);
  }, [store.rawData, store.activeTabId, store.tabState]);

  const sortedData = useMemo(() => {
    const activeTabState = store.tabState[store.activeTabId];
    return sort(filteredData, activeTabState.sorting);
  }, [filteredData, store.activeTabId, store.tabState]);

  const currentPageData = useMemo(() => {
    const activeTabState = store.tabState[store.activeTabId];
    return paginate(
      sortedData,
      activeTabState.pagination.pageIndex,
      activeTabState.pagination.pageSize
    );
  }, [sortedData, store.activeTabId, store.tabState]);

  const pageCount = useMemo(() => {
    const activeTabState = store.tabState[store.activeTabId];
    return Math.ceil(sortedData.length / activeTabState.pagination.pageSize);
  }, [sortedData, store.activeTabId, store.tabState]);

  const totalItems = useMemo(() => sortedData.length, [sortedData]);

  const activeTabState = store.tabState[store.activeTabId];

  return {
    // Base state
    isModalOpen: store.isModalOpen,
    activeTabId: store.activeTabId,
    isLoading: store.isLoading,
    error: store.error,

    // Tab-specific state
    searchQuery: activeTabState.searchQuery,
    sorting: activeTabState.sorting,
    pagination: activeTabState.pagination,
    peakHourFilter: activeTabState.peakHourFilter,

    // Computed data
    currentPageData,
    pageCount,
    totalItems,
    filteredData,

    // Actions
    ...actions,
  };
};

// Optional: export individual actions if needed elsewhere
// export const openModal = useModalStore.getState().openModal;
// export const closeModal = useModalStore.getState().closeModal;
// ... etc
