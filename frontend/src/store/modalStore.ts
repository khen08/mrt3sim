import { create } from "zustand";
import { useAPIStore } from "./apiStore";

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
}

const DEFAULT_PAGE_SIZE = 50;

export const useModalStore = create<ModalState>((set) => ({
  // Initial state
  isModalOpen: false,
  activeTabId: "timetable",
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

  // Actions for modal state
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
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
}));
