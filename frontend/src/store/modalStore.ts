import { create } from "zustand";
import { SortingState, PaginationState } from "@tanstack/react-table"; // Import types
import { filter, sort, paginate } from "@/store/modalStoreUtils"; // Assume utility functions exist
import { useSimulationStore } from "./simulationStore"; // To get simulationResult

export type TabId = "timetable" | "passengerDemand" | "metrics";

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

interface ModalState {
  // Modal state
  isModalOpen: boolean;
  activeTabId: TabId;

  // Data state
  rawData: RawData; // Store the full, raw data per tab
  isLoading: boolean;
  error: string | null;

  // View state
  searchQuery: string;
  sorting: SortingState;
  pagination: PaginationState;

  // Actions
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
  resetViewState: () => void; // Reset search, sort, pagination

  // Selectors (accessible via get() or directly if returned)
  getFilteredData: () => any[];
  getSortedData: () => any[];
  getCurrentPageData: () => any[];
  getPageCount: () => number;
  getTotalItems: () => number;
}

const DEFAULT_PAGE_SIZE = 50;

const initialPagination: PaginationState = {
  pageIndex: 0, // 0-based index
  pageSize: DEFAULT_PAGE_SIZE,
};

const initialState = {
  isModalOpen: false,
  activeTabId: "timetable" as TabId,
  rawData: {
    // Initialize with empty arrays
    timetable: [],
    passengerDemand: [],
    metrics: [],
  },
  isLoading: false,
  error: null,
  searchQuery: "",
  sorting: [] as SortingState,
  pagination: initialPagination,
};

// Create the store
export const useModalStore = create<ModalState>((set, get) => {
  // --- Helper function to safely get current raw data ---
  const getCurrentRawData = () => {
    const { activeTabId, rawData } = get();
    return rawData[activeTabId] || [];
  };

  // --- Memoized Selectors ---
  // These are defined here to access get() and recompute automatically on state change
  const getFilteredData = () => {
    const data = getCurrentRawData();
    const query = get().searchQuery;
    // console.log(`Filtering ${data.length} items with query: "${query}"`);
    return filter(data, query); // Use utility function
  };

  const getSortedData = () => {
    const data = getFilteredData(); // Use filtered data
    const currentSorting = get().sorting;
    // console.log(`Sorting ${data.length} items with state:`, currentSorting);
    return sort(data, currentSorting); // Use utility function
  };

  const getCurrentPageData = () => {
    const data = getSortedData(); // Use sorted data
    const { pageIndex, pageSize } = get().pagination;
    // console.log(`Paginating ${data.length} items: Page ${pageIndex}, Size ${pageSize}`);
    return paginate(data, pageIndex, pageSize); // Use utility function
  };

  const getTotalItems = () => {
    // Count after filtering and sorting (before pagination)
    return getSortedData().length;
  };

  const getPageCount = () => {
    const total = getTotalItems();
    const { pageSize } = get().pagination;
    return Math.ceil(total / pageSize);
  };

  // --- State and Actions ---
  return {
    ...initialState,

    // Actions
    openModal: (initialTab = "timetable") => {
      set({
        isModalOpen: true,
        activeTabId: initialTab,
        // Optionally reset view state on open, or keep it persistent
        // ...initialState // Uncomment to fully reset on open
      });
      // Potentially trigger initial data fetch here if rawData is empty for the tab
      const simState = useSimulationStore.getState();
      const currentData = get().rawData[initialTab];
      if (
        initialTab === "timetable" &&
        (!currentData || currentData.length === 0) &&
        simState.simulationResult
      ) {
        get().setRawData(initialTab, simState.simulationResult);
      }
      // TODO: Add logic to fetch passenger demand / metrics if needed
    },
    closeModal: () => set({ isModalOpen: false }),

    setActiveTabId: (tabId) => {
      set((state) => ({
        activeTabId: tabId,
        pagination: { ...state.pagination, pageIndex: 0 }, // Reset page index on tab change
        searchQuery: "", // Optionally reset search on tab change
        sorting: [], // Optionally reset sorting on tab change
        error: null, // Clear errors
        isLoading: false, // Reset loading
      }));
      // Potentially trigger data fetch if needed for the new tab
      const simState = useSimulationStore.getState();
      const currentData = get().rawData[tabId];
      if (
        tabId === "timetable" &&
        (!currentData || currentData.length === 0) &&
        simState.simulationResult
      ) {
        get().setRawData(tabId, simState.simulationResult);
      }
    },

    setRawData: (tabId, data) => {
      set((state) => ({
        rawData: {
          ...state.rawData,
          [tabId]: data || [], // Ensure it's always an array
        },
        isLoading: false, // Assume loading finished when data is set
        error: null,
      }));
    },

    setIsLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error: error, isLoading: false }),

    setSearchQuery: (query) => {
      set((state) => ({
        searchQuery: query,
        pagination: { ...state.pagination, pageIndex: 0 }, // Reset page index
      }));
    },

    setSorting: (sortingUpdater) => {
      set((state) => ({
        sorting:
          typeof sortingUpdater === "function"
            ? sortingUpdater(state.sorting)
            : sortingUpdater,
        pagination: { ...state.pagination, pageIndex: 0 }, // Reset page index
      }));
    },

    setPagination: (paginationUpdater) => {
      set((state) => ({
        pagination:
          typeof paginationUpdater === "function"
            ? paginationUpdater(state.pagination)
            : paginationUpdater,
      }));
    },

    resetViewState: () => {
      set({
        searchQuery: "",
        sorting: [],
        pagination: initialPagination,
        error: null,
        isLoading: false,
      });
    },

    // Expose selectors directly on the store object
    getFilteredData,
    getSortedData,
    getCurrentPageData,
    getPageCount,
    getTotalItems,
  };
});

// --- Custom hook for convenience ---
export const useDataViewer = () => {
  const state = useModalStore();

  // Return state and computed values needed by the component
  return {
    // State
    isModalOpen: state.isModalOpen,
    activeTabId: state.activeTabId,
    isLoading: state.isLoading,
    error: state.error,
    searchQuery: state.searchQuery,
    sorting: state.sorting,
    pagination: state.pagination,

    // Computed/Selected Data
    currentPageData: state.getCurrentPageData(),
    pageCount: state.getPageCount(),
    totalItems: state.getTotalItems(),

    // Actions (bound)
    openModal: state.openModal,
    closeModal: state.closeModal,
    setActiveTabId: state.setActiveTabId,
    setSearchQuery: state.setSearchQuery,
    setSorting: state.setSorting,
    setPagination: state.setPagination,
    resetViewState: state.resetViewState,
    // Add fetchDataForTab if/when implemented
  };
};

// Optional: export individual actions if needed elsewhere
// export const openModal = useModalStore.getState().openModal;
// export const closeModal = useModalStore.getState().closeModal;
// ... etc
