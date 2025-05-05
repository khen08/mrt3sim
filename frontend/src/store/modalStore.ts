import { create } from "zustand";

export type TabId = "timetable" | "passengerDemand" | "metrics";

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

interface ModalState {
  // Modal state
  isModalOpen: boolean;
  activeTabId: TabId;
  searchQuery: string;

  // Pagination state (separate for each tab)
  pagination: Record<TabId, PaginationState>;

  // Loading state (separate for each tab)
  loading: Record<TabId, LoadingState>;

  // Data cache
  cachedData: Record<TabId, Record<number, any[]>>;

  // Actions
  openModal: () => void;
  closeModal: () => void;
  setActiveTab: (tabId: TabId) => void;
  setSearchQuery: (query: string) => void;

  // Pagination actions
  setPage: (tabId: TabId, page: number) => void;
  setPageSize: (tabId: TabId, size: number) => void;
  setTotalItems: (tabId: TabId, total: number) => void;

  // Loading state actions
  setLoading: (tabId: TabId, isLoading: boolean) => void;
  setError: (tabId: TabId, error: string | null) => void;

  // Data caching actions
  setCachedData: (tabId: TabId, page: number, data: any[]) => void;
  clearCache: (tabId?: TabId) => void;

  // Add a new combined action to handle search state changes in one update
  handleSearchChange: (query: string) => void;
}

const DEFAULT_PAGE_SIZE = 50;

const initialState = {
  // Initial state
  isModalOpen: false,
  activeTabId: "timetable" as TabId,
  searchQuery: "",

  // Initialize pagination state for each tab
  pagination: {
    timetable: { currentPage: 1, pageSize: DEFAULT_PAGE_SIZE, totalItems: 0 },
    passengerDemand: {
      currentPage: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalItems: 0,
    },
    metrics: { currentPage: 1, pageSize: DEFAULT_PAGE_SIZE, totalItems: 0 },
  },

  // Initialize loading state for each tab
  loading: {
    timetable: { isLoading: false, error: null },
    passengerDemand: { isLoading: false, error: null },
    metrics: { isLoading: false, error: null },
  },

  // Initialize empty data cache
  cachedData: {
    timetable: {},
    passengerDemand: {},
    metrics: {},
  },
};

// Create the store
export const useModalStore = create<ModalState>((set) => ({
  ...initialState,

  // Actions for modal state
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  // Set active tab
  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  // Actions for pagination
  setPage: (tabId, page) =>
    set((state) => ({
      pagination: {
        ...state.pagination,
        [tabId]: {
          ...state.pagination[tabId],
          currentPage: page,
        },
      },
    })),

  setPageSize: (tabId, size) =>
    set((state) => ({
      pagination: {
        ...state.pagination,
        [tabId]: {
          ...state.pagination[tabId],
          pageSize: size,
          // Reset to first page when changing page size
          currentPage: 1,
        },
      },
    })),

  setTotalItems: (tabId, total) =>
    set((state) => ({
      pagination: {
        ...state.pagination,
        [tabId]: {
          ...state.pagination[tabId],
          totalItems: total,
        },
      },
    })),

  // Actions for loading state
  setLoading: (tabId, isLoading) =>
    set((state) => ({
      loading: {
        ...state.loading,
        [tabId]: {
          ...state.loading[tabId],
          isLoading,
        },
      },
    })),

  setError: (tabId, error) =>
    set((state) => ({
      loading: {
        ...state.loading,
        [tabId]: {
          ...state.loading[tabId],
          error,
        },
      },
    })),

  // Actions for data caching
  setCachedData: (tabId, page, data) =>
    set((state) => ({
      cachedData: {
        ...state.cachedData,
        [tabId]: {
          ...state.cachedData[tabId],
          [page]: data,
        },
      },
    })),

  clearCache: (tabId) =>
    set((state) => {
      if (tabId) {
        return {
          cachedData: {
            ...state.cachedData,
            [tabId]: {},
          },
        };
      } else {
        return {
          cachedData: {
            timetable: {},
            passengerDemand: {},
            metrics: {},
          },
        };
      }
    }),

  // Optimized search handler in one atomic update
  handleSearchChange: (query: string) =>
    set((state) => {
      // First create a new cached data object with empty tabs
      const newCachedData = { ...state.cachedData };

      // Clear cached data for the current active tab
      newCachedData[state.activeTabId] = {};

      // Update all relevant state in one atomic operation
      return {
        searchQuery: query,
        cachedData: newCachedData,
        pagination: {
          ...state.pagination,
          [state.activeTabId]: {
            ...state.pagination[state.activeTabId],
            currentPage: 1, // Reset to first page
          },
        },
      };
    }),
}));

// Keep a constant empty array to prevent new references
const EMPTY_ARRAY: any[] = [];

// Primitive selectors
export const useModalIsOpen = () => useModalStore((state) => state.isModalOpen);
export const useActiveTabId = () => useModalStore((state) => state.activeTabId);
export const useSearchQuery = () => useModalStore((state) => state.searchQuery);

// Memoized object selectors with custom equality by returning the same object references
export const useCurrentPagination = () =>
  useModalStore((state) => state.pagination[state.activeTabId]);

export const useCurrentLoading = () =>
  useModalStore((state) => state.loading[state.activeTabId]);

// Optimize the selector to avoid creating new array references
export const useCurrentTabData = () =>
  useModalStore((state) => {
    const activeTabId = state.activeTabId;
    const currentPage = state.pagination[activeTabId].currentPage;
    const data = state.cachedData[activeTabId][currentPage];
    return data || EMPTY_ARRAY;
  });

// Export action functions directly to avoid calling getState in components
export const openModal = () => useModalStore.getState().openModal();
export const closeModal = () => useModalStore.getState().closeModal();
export const setActiveTab = (tabId: TabId) =>
  useModalStore.getState().setActiveTab(tabId);
export const handleSearchChange = (query: string) =>
  useModalStore.getState().handleSearchChange(query);
export const setPage = (tabId: TabId, page: number) =>
  useModalStore.getState().setPage(tabId, page);
export const setPageSize = (tabId: TabId, size: number) =>
  useModalStore.getState().setPageSize(tabId, size);
export const setTotalItems = (tabId: TabId, total: number) =>
  useModalStore.getState().setTotalItems(tabId, total);
export const setLoading = (tabId: TabId, isLoading: boolean) =>
  useModalStore.getState().setLoading(tabId, isLoading);
export const setError = (tabId: TabId, error: string | null) =>
  useModalStore.getState().setError(tabId, error);
export const setCachedData = (tabId: TabId, page: number, data: any[]) =>
  useModalStore.getState().setCachedData(tabId, page, data);
