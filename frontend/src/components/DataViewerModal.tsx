import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModalStore, TabId } from "@/store/modalStore";
import { useSimulationStore } from "@/store/simulationStore";
import { DataTable } from "@/components/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconClock,
  IconUsers,
  IconChartBar,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import {
  SortingState,
  RowSelectionState,
  Column,
  Row,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Updated Timetable columns definition with the specified fields
const timetableColumns = [
  {
    accessorKey: "MOVEMENT_ID",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Movement ID
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "SCHEME_TYPE",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Scheme Type
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "TRAIN_ID",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Train ID
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "TRAIN_SERVICE_TYPE",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Train Service Type
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "STATION_ID",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Station ID
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "DIRECTION",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Direction
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "TRAIN_STATUS",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Train Status
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "ARRIVAL_TIME",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Arrival Time
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "DEPARTURE_TIME",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Departure Time
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
  },
  {
    accessorKey: "TRAVEL_TIME_SECONDS",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent"
      >
        Travel Time
        {column.getIsSorted() === "asc" ? (
          <IconArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === "desc" ? (
          <IconArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <div className="ml-2 h-3 w-3" />
        )}
      </Button>
    ),
    cell: ({ row }: { row: Row<any> }) => {
      const value = row.getValue("TRAVEL_TIME_SECONDS");
      return <div>{value ? `${value}s` : "N/A"}</div>;
    },
  },
];

// Passenger Demand columns definition
const passengerDemandColumns = [
  {
    accessorKey: "Route",
    header: "Route",
  },
  {
    accessorKey: "Passengers",
    header: "Passengers",
  },
  {
    accessorKey: "Demand Time",
    header: "Demand Time",
  },
  {
    accessorKey: "Boarding Time",
    header: "Boarding Time",
  },
  {
    accessorKey: "Wait Time (s)",
    header: "Wait Time (s)",
  },
  {
    accessorKey: "Travel Time (s)",
    header: "Travel Time (s)",
  },
];

// Metrics placeholder columns
const metricsColumns = [
  {
    accessorKey: "metric",
    header: "Metric",
  },
  {
    accessorKey: "value",
    header: "Value",
  },
];

export function DataViewerModal() {
  // Use selective state from Zustand stores with selectors
  const isModalOpen = useModalStore((state) => state.isModalOpen);
  const closeModal = useModalStore((state) => state.closeModal);
  const activeTabId = useModalStore((state) => state.activeTabId);
  const setActiveTab = useModalStore((state) => state.setActiveTab);
  const searchQuery = useModalStore((state) => state.searchQuery);
  const handleSearchChange = useModalStore((state) => state.handleSearchChange);

  // Current pagination
  const currentPage = useModalStore(
    (state) => state.pagination[state.activeTabId].currentPage
  );
  const pageSize = useModalStore(
    (state) => state.pagination[state.activeTabId].pageSize
  );
  const totalItems = useModalStore(
    (state) => state.pagination[state.activeTabId].totalItems
  );

  // Loading state
  const isLoading = useModalStore(
    (state) => state.loading[state.activeTabId].isLoading
  );
  const error = useModalStore(
    (state) => state.loading[state.activeTabId].error
  );

  // Data access
  const cachedData = useModalStore((state) => state.cachedData);

  // Actions
  const setPage = useModalStore((state) => state.setPage);
  const setPageSize = useModalStore((state) => state.setPageSize);
  const setTotalItems = useModalStore((state) => state.setTotalItems);
  const setLoading = useModalStore((state) => state.setLoading);
  const setError = useModalStore((state) => state.setError);
  const setCachedData = useModalStore((state) => state.setCachedData);

  // Simulation data
  const simulationResult = useSimulationStore(
    (state) => state.simulationResult
  );
  const loadedSimulationId = useSimulationStore(
    (state) => state.loadedSimulationId
  );

  // Local state for table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Memoized table columns
  const memoizedTimetableColumns = useMemo(() => timetableColumns, []);

  // Calculate total pages based on items and page size
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset selection and update total items when tab changes or modal opens
  useEffect(() => {
    setRowSelection({});

    if (isModalOpen && activeTabId === "timetable" && simulationResult) {
      // Set total items for timetable tab
      setTotalItems("timetable", simulationResult.length);
    }
  }, [activeTabId, isModalOpen, simulationResult, setTotalItems]);

  // Check if we have data to display
  const hasData = useMemo(
    () =>
      loadedSimulationId !== null &&
      Array.isArray(simulationResult) &&
      simulationResult.length > 0,
    [loadedSimulationId, simulationResult]
  );

  // Get the current tab data with memoization
  const getCurrentTabData = useMemo(() => {
    if (!hasData || isLoading) return [];
    return cachedData[activeTabId][currentPage] || [];
  }, [hasData, isLoading, cachedData, activeTabId, currentPage]);

  // Add a stable effect handler for loading data
  const loadTabData = useCallback(() => {
    // Skip if no data or already loading
    if (!hasData || isLoading) return;

    // Skip if data is already cached
    if (cachedData[activeTabId][currentPage]?.length > 0) return;

    // Set loading state
    setLoading(activeTabId, true);

    try {
      let filteredData = [];
      // Get the base data for the current tab
      switch (activeTabId) {
        case "timetable":
          filteredData = simulationResult || [];
          break;
        case "passengerDemand":
        case "metrics":
          filteredData = []; // Replace with actual data for other tabs
          break;
        default:
          filteredData = [];
      }

      // Apply search filtering
      if (searchQuery.trim()) {
        filteredData = filteredData.filter((row) => {
          return Object.values(row).some((value) => {
            if (value === null || value === undefined) return false;
            return String(value)
              .toLowerCase()
              .includes(searchQuery.toLowerCase());
          });
        });
      }

      // Apply pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, filteredData.length);
      const paginatedData = filteredData.slice(startIndex, endIndex);

      // Update state after processing
      setCachedData(activeTabId, currentPage, paginatedData);
      setTotalItems(activeTabId, filteredData.length);
      setLoading(activeTabId, false);
    } catch (err) {
      setError(activeTabId, String(err));
      setLoading(activeTabId, false);
    }
  }, [
    hasData,
    activeTabId,
    currentPage,
    pageSize,
    searchQuery,
    simulationResult,
    cachedData,
    isLoading,
    setLoading,
    setCachedData,
    setTotalItems,
    setError,
  ]);

  // Effect to trigger data loading
  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Callback for changing page - memoized
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setPage(activeTabId, newPage);
      }
    },
    [activeTabId, totalPages, setPage]
  );

  // Callback for changing page size - memoized
  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(activeTabId, newSize);
    },
    [activeTabId, setPageSize]
  );

  // Render loading skeleton for table
  const renderSkeleton = useCallback(
    () => (
      <div className="space-y-2">
        {Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    ),
    [pageSize]
  );

  // Render pagination controls
  const renderPagination = useCallback(
    () => (
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            {getCurrentTabData.length > 0
              ? `${(currentPage - 1) * pageSize + 1}-${Math.min(
                  currentPage * pageSize,
                  totalItems
                )}`
              : "0"}{" "}
            of {totalItems} items
          </p>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => handlePageSizeChange(Number(value))}
          >
            <SelectTrigger className="max-w-fit">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            <IconChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous Page</span>
          </Button>

          <div className="text-sm">
            Page {currentPage} of {totalPages || 1}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            <IconChevronRight className="h-4 w-4" />
            <span className="sr-only">Next Page</span>
          </Button>
        </div>
      </div>
    ),
    [
      currentPage,
      pageSize,
      totalItems,
      totalPages,
      getCurrentTabData.length,
      handlePageChange,
      handlePageSizeChange,
      isLoading,
    ]
  );

  return (
    <Dialog
      open={isModalOpen}
      onOpenChange={(open) => {
        if (!open) closeModal();
      }}
    >
      <DialogContent className="!max-w-fit w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Simulation Data Viewer</DialogTitle>
          <DialogDescription>
            View the detailed data for{" "}
            {loadedSimulationId
              ? `Simulation #${loadedSimulationId}`
              : "the current simulation"}
          </DialogDescription>
        </DialogHeader>

        {!hasData ? (
          <div className="py-12 text-center text-muted-foreground">
            No simulation data available. Please load a simulation first.
          </div>
        ) : (
          <Tabs
            defaultValue="timetable"
            value={activeTabId}
            onValueChange={(value) => setActiveTab(value as TabId)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="timetable" className="flex items-center">
                <IconClock className="mr-2 h-4 w-4" />
                <span>Timetable</span>
              </TabsTrigger>
              <TabsTrigger
                value="passengerDemand"
                className="flex items-center"
              >
                <IconUsers className="mr-2 h-4 w-4" />
                <span>Passenger Demand</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center">
                <IconChartBar className="mr-2 h-4 w-4" />
                <span>Metrics</span>
              </TabsTrigger>
            </TabsList>

            {/* Search Input */}
            <div className="relative my-4">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <IconSearch className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="text"
                placeholder="Search data..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>

            <TabsContent
              value="timetable"
              className="pt-2 flex-1 overflow-hidden flex flex-col"
            >
              {isLoading ? (
                renderSkeleton()
              ) : error ? (
                <div className="py-8 text-center text-red-500">
                  Error loading data: {error}
                </div>
              ) : getCurrentTabData.length === 0 &&
                searchQuery.trim() !== "" ? (
                <div className="py-8 text-center text-muted-foreground">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <DataTable
                    columns={memoizedTimetableColumns}
                    data={getCurrentTabData}
                    sorting={sorting}
                    setSorting={setSorting}
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    stickyHeader={true}
                  />
                  {renderPagination()}
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="passengerDemand"
              className="pt-2 flex-1 flex flex-col"
            >
              <DataTable
                columns={passengerDemandColumns}
                data={[]} // This would be replaced with actual passenger demand data
                sorting={sorting}
                setSorting={setSorting}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                stickyHeader={true}
              />
            </TabsContent>

            <TabsContent value="metrics" className="pt-2 flex-1 flex flex-col">
              <DataTable
                columns={metricsColumns}
                data={[]} // This would be replaced with actual metrics data
                sorting={sorting}
                setSorting={setSorting}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                stickyHeader={true}
              />
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
