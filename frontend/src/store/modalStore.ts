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

// Type for the state part of ModalState
interface ModalStateProperties {
  isModalOpen: boolean;
  activeTabId: TabId;
  rawData: RawData;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  sorting: SortingState;
  pagination: PaginationState;
  peakHourFilter: PeakHourFilter;
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
  searchQuery: "",
  sorting: [],
  pagination: initialPaginationState,
  peakHourFilter: "ALL", // Default to ALL
  lastLoadedSimulationId: null,
};

// Create the store
export const useModalStore = create<ModalState>((set, get) => ({
  ...initialStateProperties,
  actions: {
    openModal: (initialTab: TabId = "timetable") => {
      // Don't reset view state - keep existing data
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
      set({ isModalOpen: false });
      // Don't reset data on close - we'll keep it cached
    },
    setActiveTabId: (tabId: TabId) => {
      // When switching tabs, only reset the search, sorting, and pagination
      // Don't reset data or filter settings
      set({
        activeTabId: tabId,
        searchQuery: "",
        sorting: [],
        pagination: initialPaginationState,
      });
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
      set({
        searchQuery: query,
        pagination: { ...get().pagination, pageIndex: 0 },
      }),
    setSorting: (sortingUpdater) =>
      set((state) => ({
        sorting:
          typeof sortingUpdater === "function"
            ? sortingUpdater(state.sorting)
            : sortingUpdater,
      })),
    setPagination: (paginationUpdater) =>
      set((state) => ({
        pagination:
          typeof paginationUpdater === "function"
            ? paginationUpdater(state.pagination)
            : paginationUpdater,
      })),
    setPeakHourFilter: (filter: PeakHourFilter) =>
      set({
        peakHourFilter: filter,
        pagination: { ...get().pagination, pageIndex: 0 }, // Reset to first page when filter changes
      }),
    resetViewState: () => {
      // Only resets the view UI state, not the raw data
      set({
        searchQuery: "",
        sorting: [],
        pagination: initialPaginationState,
        peakHourFilter: "ALL",
        error: null,
        isLoading: false,
      });
    },
    resetData: () => {
      // Reset both view state and data
      set({
        rawData: {
          timetable: [],
          passengerDemand: [],
          metrics: [],
          metricsSummary: [],
        },
        searchQuery: "",
        sorting: [],
        pagination: initialPaginationState,
        peakHourFilter: "ALL",
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
    // First apply peak hour filter
    const currentRawData = store.rawData[store.activeTabId] || [];
    const peakHourFiltered =
      store.activeTabId === "timetable"
        ? filterByPeakHours(currentRawData, store.peakHourFilter)
        : currentRawData;

    // Then apply search filter
    if (!store.searchQuery) return peakHourFiltered;
    return filter(peakHourFiltered, store.searchQuery);
  }, [
    store.rawData,
    store.activeTabId,
    store.searchQuery,
    store.peakHourFilter, // Add dependency on peak hour filter
  ]);

  const sortedData = useMemo(() => {
    return sort(filteredData, store.sorting);
  }, [filteredData, store.sorting]);

  const currentPageData = useMemo(() => {
    return paginate(
      sortedData,
      store.pagination.pageIndex,
      store.pagination.pageSize
    );
  }, [sortedData, store.pagination]);

  const pageCount = useMemo(() => {
    return Math.ceil(sortedData.length / store.pagination.pageSize);
  }, [sortedData, store.pagination.pageSize]);

  const totalItems = useMemo(() => sortedData.length, [sortedData]);

  return {
    activeTabId: store.activeTabId,
    isLoading: store.isLoading,
    error: store.error,
    searchQuery: store.searchQuery,
    sorting: store.sorting,
    pagination: store.pagination,
    peakHourFilter: store.peakHourFilter, // Expose the filter
    currentPageData,
    pageCount,
    totalItems,
    ...actions, // Spread all actions
  };
};

// Optional: export individual actions if needed elsewhere
// export const openModal = useModalStore.getState().openModal;
// export const closeModal = useModalStore.getState().closeModal;
// ... etc
