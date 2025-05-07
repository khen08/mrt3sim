import { useEffect, useMemo } from "react";
import * as React from "react";
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
import { TabId } from "@/store/modalStore";
import { useSimulationStore } from "@/store/simulationStore";
import { DataTable } from "@/components/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconClock,
  IconUsers,
  IconChartBar,
  IconSearch,
  IconLoader2,
} from "@tabler/icons-react";
import {
  RowSelectionState,
  Column,
  Row,
  ColumnDef,
  PaginationState,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useDataViewer, useModalStore } from "@/store/modalStore";
import { MetricsTab, MetricsSummaryTab } from "./metrics";
import { useAPIStore } from "@/store/apiStore";

// Updated Timetable columns definition with the specified fields
const timetableColumns: ColumnDef<any>[] = [
  {
    accessorKey: "SCHEME_TYPE",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-left w-full justify-start"
        >
          Scheme Type
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 120,
    minSize: 100,
    maxSize: 150,
  },
  {
    accessorKey: "TRAIN_ID",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-right w-full justify-end"
        >
          Train ID
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 100,
    minSize: 80,
    maxSize: 120,
  },
  {
    accessorKey: "TRAIN_SERVICE_TYPE",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-left w-full justify-start"
        >
          Train Service Type
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 150,
    minSize: 120,
    maxSize: 180,
  },
  {
    accessorKey: "STATION_ID",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-right w-full justify-end"
        >
          Station ID
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 100,
    minSize: 80,
    maxSize: 120,
  },
  {
    accessorKey: "DIRECTION",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-left w-full justify-start"
        >
          Direction
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 120,
    minSize: 100,
    maxSize: 150,
  },
  {
    accessorKey: "TRAIN_STATUS",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-left w-full justify-start"
        >
          Train Status
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 120,
    minSize: 100,
    maxSize: 150,
  },
  {
    accessorKey: "ARRIVAL_TIME",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-right w-full justify-end"
        >
          Arrival Time
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 120,
    minSize: 100,
    maxSize: 150,
  },
  {
    accessorKey: "DEPARTURE_TIME",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-right w-full justify-end"
        >
          Departure Time
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 140,
    minSize: 120,
    maxSize: 160,
  },
  {
    accessorKey: "TRAVEL_TIME_SECONDS",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-right w-full justify-end"
        >
          Travel Time (s)
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    cell: ({ row }: { row: Row<any> }) => {
      const value = row.getValue("TRAVEL_TIME_SECONDS");
      return <div>{value ? `${value}s` : "N/A"}</div>;
    },
    size: 130,
    minSize: 110,
    maxSize: 150,
  },
];

// Metrics placeholder columns
const metricsColumns: ColumnDef<any>[] = [
  {
    accessorKey: "metric",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-left w-full justify-start"
        >
          Metric
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    size: 200,
    minSize: 180,
    maxSize: 300,
  },
  {
    accessorKey: "value",
    header: ({ column }: { column: Column<any, unknown> }) => {
      const sortIndex = column.getSortIndex();
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={column.getToggleSortingHandler()}
          className="p-0 hover:bg-transparent group text-right w-full justify-end"
        >
          Value
          {sortDirection && sortIndex !== -1 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground group-hover:text-accent-foreground">
              ({sortIndex + 1})
            </span>
          )}
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-1 h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 group-hover:text-accent-foreground" />
          )}
        </Button>
      );
    },
    cell: ({ row }: { row: Row<any> }) => {
      const value = row.getValue("value");
      // For numeric values, add right alignment and formatting
      if (typeof value === "number") {
        return <div className="text-right">{value.toLocaleString()}</div>;
      }
      return <div className="text-right">{String(value)}</div>;
    },
    size: 300,
    minSize: 200,
    maxSize: 500,
  },
];

// Props interface for DataViewerModal
interface DataViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataViewerModal({ isOpen, onClose }: DataViewerModalProps) {
  // Use the custom hook to get state and actions
  const {
    // State & Computed Values
    activeTabId,
    isLoading,
    error,
    searchQuery,
    sorting,
    pagination,
    currentPageData,
    pageCount,
    totalItems,

    // Actions
    setActiveTabId,
    setSearchQuery,
    setSorting,
    setPagination,
    resetViewState,
  } = useDataViewer();

  // Get simulation info (still needed for header)
  const loadedSimulationId = useSimulationStore(
    (state) => state.loadedSimulationId
  );
  const simulationName = useSimulationStore((state) => state.simulationName);

  // Check if we have *any* raw data for the current tab (to distinguish from loading)
  const { rawData } = useModalStore.getState(); // Get raw data directly for check
  const hasAnyDataForTab = useMemo(() => {
    const currentRawData = rawData[activeTabId] || [];
    return currentRawData.length > 0;
  }, [activeTabId, rawData]);

  // Check if we have data to display (based on computed page data)
  const hasDisplayData = useMemo(
    () => currentPageData.length > 0,
    [currentPageData]
  );

  // Reset view state when the modal is closed or simulation changes
  useEffect(() => {
    if (!isOpen) {
      // Reset view state when modal closes
      // Delay slightly to avoid visual glitch if store updates before animation
      // setTimeout(resetViewState, 150);
    } else {
      // Reset view state if simulation ID changes while modal is open
      resetViewState();
      setRowSelection({}); // Also reset local row selection
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loadedSimulationId]); // Depend on isOpen and loadedSimulationId

  // Event Handlers using store actions
  const handleTabChange = (value: string) => {
    setActiveTabId(value as TabId);
    setRowSelection({}); // Reset local row selection on tab change
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Pagination handler remains similar but uses the store action
  const handlePaginationChange = (
    updater: React.SetStateAction<PaginationState>
  ) => {
    setPagination(updater); // Directly use the store's setter
  };

  // Components using store state
  const renderSkeleton = useMemo(
    () => (
      <div className="space-y-2">
        {Array.from({
          length: pagination.pageSize > 10 ? 10 : pagination.pageSize,
        }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    ),
    [pagination.pageSize]
  );

  // --- Re-add local state for row selection ---
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Memoized column definitions
  const memoizedTimetableColumns = useMemo(
    (): ColumnDef<any>[] => timetableColumns,
    []
  );
  const metricsColumnsMemo = useMemo(
    (): ColumnDef<any>[] => metricsColumns,
    []
  );

  // Get API actions
  const fetchSimulationMetrics = useAPIStore(
    (state) => state.fetchSimulationMetrics
  );

  // Fetch metrics data when tab is selected
  useEffect(() => {
    if (isOpen && activeTabId === "metrics" && loadedSimulationId !== null) {
      // Check if we already have metrics data
      const currentMetricsData = rawData["metrics"] || [];
      if (currentMetricsData.length === 0 && !isLoading) {
        // Only fetch if we don't have data and aren't already loading
        fetchSimulationMetrics(loadedSimulationId);
      }
    }
  }, [
    isOpen,
    activeTabId,
    loadedSimulationId,
    rawData,
    isLoading,
    fetchSimulationMetrics,
  ]);

  return (
    // Use store action for closing
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-fit w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Simulation Data Viewer</DialogTitle>
          <DialogDescription>
            Viewing data for:{" "}
            <strong>{simulationName || "Unnamed Simulation"}</strong>
            {loadedSimulationId !== null ? ` (ID: ${loadedSimulationId})` : ""}
          </DialogDescription>
        </DialogHeader>

        {loadedSimulationId === null ? (
          <div className="py-12 text-center text-muted-foreground">
            No simulation data available. Please load or run a simulation first.
          </div>
        ) : (
          <Tabs
            // Use state/action from store
            value={activeTabId}
            onValueChange={handleTabChange}
            className="w-full flex flex-col flex-1 overflow-hidden" // Added flex classes
          >
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              {" "}
              {/* Changed from grid-cols-3 to grid-cols-4 */}
              <TabsTrigger value="timetable" className="flex items-center">
                <IconClock className="mr-2 h-4 w-4" />
                <span>Timetable</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center">
                <IconChartBar className="mr-2 h-4 w-4" />
                <span>Metrics</span>
              </TabsTrigger>
              <TabsTrigger value="metricsSummary" className="flex items-center">
                <IconChartBar className="mr-2 h-4 w-4" />
                <span>Metrics Summary</span>
              </TabsTrigger>
            </TabsList>

            {/* Search Input & Reset Sort Button Container */}
            {activeTabId === "timetable" && (
              <div className="relative my-4 flex items-center gap-2 flex-shrink-0">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <IconSearch className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  placeholder="Search data..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 pr-4 flex-grow"
                />
                {/* Add Reset Sort Button for DataViewerModal */}
                {sorting && sorting.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSorting([])} // Reset to empty array for no sort
                    className="text-xs h-9 ml-2 flex-shrink-0"
                  >
                    Reset Sort
                  </Button>
                )}
              </div>
            )}

            {/* Tab Content Area - Add relative positioning for overlay */}
            <div className="relative flex-1 overflow-hidden flex flex-col min-h-0 h-[50vh]">
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Loading data...
                  </p>
                </div>
              )}

              {/* Tab Content (will be visually behind overlay when loading) */}
              <TabsContent
                value="timetable"
                className="pt-2 flex-1 overflow-hidden flex flex-col h-full mt-0" // Added h-full and mt-0
              >
                {isLoading ? (
                  renderSkeleton
                ) : error ? (
                  <div className="py-8 text-center text-red-500">
                    Error: {error}
                  </div>
                ) : !hasAnyDataForTab ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No data loaded for this tab.
                  </div>
                ) : currentPageData.length === 0 &&
                  searchQuery.trim() !== "" ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No results found for "{searchQuery}"
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col h-full">
                    {" "}
                    {/* Allow table to grow */}
                    <DataTable
                      columns={memoizedTimetableColumns}
                      data={currentPageData} // Use computed page data
                      sorting={sorting} // Use store state
                      setSorting={setSorting} // Use store action
                      rowSelection={rowSelection} // Keep local row selection
                      setRowSelection={setRowSelection}
                      pageIndex={pagination.pageIndex} // Use store state
                      pageSize={pagination.pageSize} // Use store state
                      pageCount={pageCount} // Use computed value
                      onPaginationChange={handlePaginationChange} // Use wrapper handler
                      tableHeight="350px" // Add fixed height for scrolling
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="metrics"
                className="pt-2 flex-1 overflow-hidden flex flex-col h-full mt-0"
              >
                <MetricsTab />
              </TabsContent>

              <TabsContent
                value="metricsSummary"
                className="pt-2 flex-1 overflow-auto h-full mt-0"
              >
                <MetricsSummaryTab />
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter className="flex-shrink-0">
          {" "}
          {/* Prevent footer shrinking */}
          <DialogClose asChild>
            {/* Use store action for closing */}
            <Button onClick={onClose}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
