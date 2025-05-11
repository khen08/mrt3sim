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
  IconDownload,
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
import { PEAK_HOURS } from "@/lib/constants";
import { useHasMetrics } from "@/store/metricsStore";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from "xlsx";

// Custom compact header component for better overflow handling
const CompactColumnHeader = ({
  column,
  title,
  alignment = "left",
}: {
  column: Column<any, unknown>;
  title: string;
  alignment?: "left" | "right" | "center";
}) => {
  const sortIndex = column.getSortIndex();
  const sortDirection = column.getIsSorted();

  return (
    <div
      onClick={column.getToggleSortingHandler()}
      className={`flex items-center font-medium cursor-pointer w-full select-none ${
        alignment === "right"
          ? "justify-end"
          : alignment === "center"
          ? "justify-center"
          : "justify-start"
      }`}
    >
      <div className="flex items-center whitespace-nowrap">
        <span>{title}</span>
        {column.getIsSorted() && (
          <>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3 w-3 ml-1" />
            ) : (
              <ArrowDown className="h-3 w-3 ml-1" />
            )}
            {column.getSortIndex() > 0 && (
              <span className="text-[10px] font-medium ml-0.5 text-yellow-500">
                ({column.getSortIndex() + 1})
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Updated Timetable columns definition with the specified fields
const timetableColumns: ColumnDef<any>[] = [
  {
    accessorKey: "SCHEME_TYPE",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <CompactColumnHeader column={column} title="Scheme Type" />
    ),
    size: 120,
    minSize: 120,
    maxSize: 120,
    meta: {
      alignment: "left",
    },
  },
  {
    accessorKey: "TRAIN_ID",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Train ID"
        alignment="center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("TRAIN_ID")}</div>
    ),
    size: 80,
    minSize: 80,
    maxSize: 80,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "TRAIN_SERVICE_TYPE",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Train Service Type"
        alignment="center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("TRAIN_SERVICE_TYPE")}</div>
    ),
    size: 140,
    minSize: 140,
    maxSize: 140,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "STATION_ID",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Station ID"
        alignment="center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("STATION_ID")}</div>
    ),
    size: 100,
    minSize: 100,
    maxSize: 100,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "DIRECTION",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Direction"
        alignment="center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("DIRECTION")}</div>
    ),
    size: 120,
    minSize: 120,
    maxSize: 120,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "TRAIN_STATUS",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Train Status"
        alignment="center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("TRAIN_STATUS")}</div>
    ),
    size: 120,
    minSize: 120,
    maxSize: 120,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "ARRIVAL_TIME",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Arrival Time"
        alignment="center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("ARRIVAL_TIME")}</div>
    ),
    size: 120,
    minSize: 120,
    maxSize: 120,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "DEPARTURE_TIME",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Departure Time"
        alignment="center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("DEPARTURE_TIME")}</div>
    ),
    size: 140,
    minSize: 140,
    maxSize: 140,
    meta: {
      alignment: "center",
    },
  },
  {
    accessorKey: "TRAVEL_TIME_SECONDS",
    header: ({ column }) => (
      <CompactColumnHeader
        column={column}
        title="Travel Time (s)"
        alignment="center"
      />
    ),
    cell: ({ row }) => {
      const value = row.getValue("TRAVEL_TIME_SECONDS");
      return <div className="text-center">{value ? `${value}s` : "N/A"}</div>;
    },
    size: 120,
    minSize: 120,
    maxSize: 120,
    meta: {
      alignment: "center",
    },
  },
];

// Metrics placeholder columns
const metricsColumns: ColumnDef<any>[] = [
  {
    accessorKey: "metric",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <CompactColumnHeader column={column} title="Metric" />
    ),
    size: 200,
    minSize: 180,
    maxSize: 300,
    meta: {
      alignment: "left",
    },
  },
  {
    accessorKey: "value",
    header: ({ column }: { column: Column<any, unknown> }) => (
      <CompactColumnHeader column={column} title="Value" alignment="right" />
    ),
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
    meta: {
      alignment: "right",
    },
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
    peakHourFilter,
    filteredData,

    // Actions
    setActiveTabId,
    setSearchQuery,
    setSorting,
    setPagination,
    setPeakHourFilter,
    resetViewState,
  } = useDataViewer();

  // Get simulation info (still needed for header)
  const loadedSimulationId = useSimulationStore(
    (state) => state.loadedSimulationId
  );
  const simulationName = useSimulationStore((state) => state.simulationName);

  // Initialize toast
  const { toast } = useToast();

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
      // Don't reset the view state when modal closes
      // We want to preserve state between modal openings
    } else if (loadedSimulationId) {
      // Reset row selection on simulation ID change
      setRowSelection({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loadedSimulationId]); // Depend on isOpen and loadedSimulationId

  // Event Handlers using store actions
  const handleTabChange = (value: string) => {
    setActiveTabId(value as TabId);
    // Reset local row selection on tab change
    setRowSelection({});
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

  // Check if simulation has passenger data and metrics
  const hasMetrics = useHasMetrics();

  // Check if we're simulating passengers
  const simulatePassengers = useSimulationStore(
    (state) => state.simulatePassengers
  );

  // Fetch metrics data when tab is selected
  useEffect(() => {
    if (
      isOpen &&
      activeTabId === "metrics" &&
      loadedSimulationId !== null &&
      simulatePassengers
    ) {
      // Check if we already have metrics data and if we know this simulation has no metrics
      if (hasMetrics === false) {
        // Don't fetch if we know there are no metrics
        return;
      }

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
    simulatePassengers,
    hasMetrics,
  ]);

  // If metrics tabs are selected but we know there are no metrics, switch to timetable tab
  useEffect(() => {
    if (
      (activeTabId === "metrics" || activeTabId === "metricsSummary") &&
      hasMetrics === false &&
      isOpen
    ) {
      setActiveTabId("timetable");
    }
  }, [activeTabId, hasMetrics, isOpen, setActiveTabId]);

  // Helper function to export table data to Excel with optimal column widths
  const exportToExcel = (data: any[], fileName: string) => {
    if (!data || data.length === 0) return;

    // Create a workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Get all column keys
    const columns = Object.keys(data[0]);

    // Calculate maximum width for each column based on content
    const columnWidths: Record<string, number> = {};

    // Start with column headers
    columns.forEach((col) => {
      columnWidths[col] = col.length + 2; // Add padding
    });

    // Check all data for max width
    data.forEach((row) => {
      columns.forEach((col) => {
        const cellValue = row[col]?.toString() || "";
        // Set width to max of current width or cell content length plus padding
        columnWidths[col] = Math.max(columnWidths[col], cellValue.length + 2);
      });
    });

    // Define column widths (need to convert to XLSX column width)
    const wscols = columns.map((col) => ({ wch: columnWidths[col] }));

    // Set column widths in the worksheet
    worksheet["!cols"] = wscols;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Timetable");

    // Write to a file and trigger download
    XLSX.writeFile(workbook, fileName);
  };

  // Handle export with scheme type filter
  const handleExportCsv = (schemeType: string) => {
    // Get raw timetable data directly from the store
    const { rawData } = useModalStore.getState();
    const allTimetableData = rawData["timetable"] || [];

    // Debug the data to understand what's available
    console.log(`Total timetable records: ${allTimetableData.length}`);

    // Exit early if no data at all
    if (!allTimetableData || allTimetableData.length === 0) {
      toast({
        title: "Export Failed",
        description: "No timetable data available to export",
        variant: "destructive",
      });
      return;
    }

    // Check what scheme types actually exist in the data
    const schemeTypes = new Set<string>();
    allTimetableData.forEach((row) => {
      if (row.SCHEME_TYPE) {
        schemeTypes.add(row.SCHEME_TYPE);
      }
    });
    console.log("Available scheme types:", [...schemeTypes]);

    // Apply scheme type filter if specific type is selected
    let dataToExport = allTimetableData;
    if (schemeType !== "ALL") {
      // Try case-insensitive matching for better results
      const normalizedSchemeType = schemeType.toLowerCase();
      dataToExport = allTimetableData.filter(
        (row) =>
          row.SCHEME_TYPE &&
          row.SCHEME_TYPE.toLowerCase() === normalizedSchemeType
      );

      // If no exact match, try partial match
      if (dataToExport.length === 0) {
        dataToExport = allTimetableData.filter(
          (row) =>
            row.SCHEME_TYPE &&
            row.SCHEME_TYPE.toLowerCase().includes(normalizedSchemeType)
        );
      }

      // If still empty, try matching on different fields
      if (dataToExport.length === 0) {
        dataToExport = allTimetableData.filter(
          (row) =>
            row.TRAIN_SERVICE_TYPE &&
            row.TRAIN_SERVICE_TYPE.toLowerCase().includes(normalizedSchemeType)
        );
      }

      // If filtered data is empty, show a specific error
      if (dataToExport.length === 0) {
        toast({
          title: "Export Failed",
          description: `No ${schemeType} scheme data found. Available types: ${
            [...schemeTypes].join(", ") || "none"
          }`,
          variant: "destructive",
        });
        return;
      }
    }

    // Generate filename with scheme type and date
    const date = new Date().toISOString().split("T")[0];
    const filename = `timetable_${schemeType.toLowerCase()}_${date}.xlsx`;

    // Log export information
    console.log(`Exporting ${dataToExport.length} records to ${filename}`);

    // Export to Excel
    exportToExcel(dataToExport, filename);

    toast({
      title: "Export Successful",
      description: `${dataToExport.length} records exported to ${filename}`,
      variant: "default",
    });
  };

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
            <TabsList
              className={`grid w-full ${
                hasMetrics === false ? "grid-cols-1" : "grid-cols-3"
              } flex-shrink-0`}
            >
              <TabsTrigger value="timetable" className="flex items-center">
                <IconClock className="mr-2 h-4 w-4" />
                <span>Timetable</span>
              </TabsTrigger>

              {/* Only show metrics tabs if passenger data exists */}
              {hasMetrics !== false && (
                <>
                  <TabsTrigger value="metrics" className="flex items-center">
                    <IconChartBar className="mr-2 h-4 w-4" />
                    <span>Metrics</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="metricsSummary"
                    className="flex items-center"
                  >
                    <IconChartBar className="mr-2 h-4 w-4" />
                    <span>Metrics Summary</span>
                  </TabsTrigger>
                </>
              )}
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

                {/* Add Peak Hour Filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium whitespace-nowrap">
                    Peak Filter:
                  </span>
                  <div className="flex border rounded-md overflow-hidden">
                    <Button
                      type="button"
                      variant={peakHourFilter === "ALL" ? "default" : "outline"}
                      size="sm"
                      className="rounded-none px-3"
                      onClick={() => setPeakHourFilter("ALL")}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant={peakHourFilter === "AM" ? "default" : "outline"}
                      size="sm"
                      className="rounded-none border-l px-3"
                      onClick={() => setPeakHourFilter("AM")}
                    >
                      AM
                    </Button>
                    <Button
                      type="button"
                      variant={peakHourFilter === "PM" ? "default" : "outline"}
                      size="sm"
                      className="rounded-none border-l px-3"
                      onClick={() => setPeakHourFilter("PM")}
                    >
                      PM
                    </Button>
                  </div>
                </div>

                {/* Reset Sort Button */}
                {sorting && sorting.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSorting([])}
                    className="text-xs h-9 ml-2 flex-shrink-0"
                  >
                    Reset Sort
                  </Button>
                )}

                {/* Download Dropdown Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 ml-2 flex-shrink-0"
                    >
                      <IconDownload className="h-4 w-4 mr-1" />
                      Export to Excel
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExportCsv("ALL")}>
                      All Timetable Data
                    </DropdownMenuItem>

                    {/* Dynamic menu items based on available scheme types */}
                    {(() => {
                      // Get raw timetable data directly from the store
                      const { rawData } = useModalStore.getState();
                      const allTimetableData = rawData["timetable"] || [];

                      // Find unique scheme types
                      const schemeTypes = new Set<string>();
                      allTimetableData.forEach((row) => {
                        if (row.SCHEME_TYPE) {
                          schemeTypes.add(row.SCHEME_TYPE);
                        }
                      });

                      // Generate menu items for each scheme type
                      return [...schemeTypes].map((type) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => handleExportCsv(type)}
                        >
                          {type} Scheme
                        </DropdownMenuItem>
                      ));
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Tab Content Area - Add relative positioning for overlay */}
            <div className="relative flex-1 overflow-hidden flex flex-col min-h-0 h-[50vh]">
              {/* Loading Overlay - Only show for timetable tab, not metrics tabs */}
              {isLoading && activeTabId === "timetable" && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
                  <IconLoader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <TextShimmer
                    as="p"
                    className="text-sm text-muted-foreground"
                    duration={1.5}
                  >
                    Loading data...
                  </TextShimmer>
                </div>
              )}

              {/* Tab Content (will be visually behind overlay when loading) */}
              <TabsContent
                value="timetable"
                className="pt-2 flex-1 overflow-hidden flex flex-col h-full mt-0"
              >
                {isLoading ? (
                  // Use placeholder div while loading overlay is active, instead of skeleton
                  <div className="flex-1 flex items-center justify-center">
                    {/* Spinner is now in the overlay */}
                  </div>
                ) : error ? (
                  <div className="py-8 text-center text-red-500">
                    Error: {error}
                  </div>
                ) : !hasAnyDataForTab ? (
                  // Show spinner and message when not loading but no data exists yet
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                    <TextShimmer
                      as="p"
                      className="text-sm text-muted-foreground"
                      duration={1.5}
                    >
                      Waiting for simulation data...
                    </TextShimmer>
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
                    <div className="relative flex-1 overflow-hidden">
                      {isLoading && !hasAnyDataForTab ? (
                        renderSkeleton
                      ) : hasDisplayData ? (
                        <>
                          <DataTable
                            columns={memoizedTimetableColumns}
                            data={currentPageData}
                            sorting={sorting}
                            setSorting={setSorting}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            pageIndex={pagination.pageIndex}
                            pageSize={pagination.pageSize}
                            pageCount={pageCount}
                            onPaginationChange={handlePaginationChange}
                            hideRowsPerPage={false}
                            hideRowSelectionCount={true}
                            tableHeight="350px"
                          />

                          {/* Add filter info when a peak filter is active */}
                          {peakHourFilter !== "ALL" && (
                            <div className="text-xs text-muted-foreground p-2 text-center bg-muted/30 rounded-md mt-2">
                              <span className="font-medium">
                                {peakHourFilter} Peak Filter Active:
                              </span>{" "}
                              {peakHourFilter === "AM"
                                ? `Showing ${totalItems} records between ${PEAK_HOURS.AM.start} and ${PEAK_HOURS.AM.end}`
                                : `Showing ${totalItems} records between ${PEAK_HOURS.PM.start} and ${PEAK_HOURS.PM.end}`}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-4 text-center text-muted-foreground">
                          No data available. Try changing your filters or
                          loading simulation data.
                        </div>
                      )}
                    </div>
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
