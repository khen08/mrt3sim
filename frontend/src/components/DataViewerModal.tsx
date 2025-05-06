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
import { TabId } from "@/store/modalStore";
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

// --- Add Heatmap Imports and Types --- //
import { PassengerHeatmap } from "@/components/PassengerHeatmap"; // Import the heatmap component
import { API_BASE_URL, GET_PASSENGER_DEMAND_ENDPOINT } from "@/lib/constants"; // Import API constants

// Define HeatmapSeries type locally or import if exported from PassengerHeatmap.tsx
interface HeatmapDataPoint {
  x: string | number;
  y: number;
}
interface HeatmapSeries {
  id: string;
  data: HeatmapDataPoint[];
}
// -------------------------------------- //

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

// Props interface for DataViewerModal
interface DataViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataViewerModal({ isOpen, onClose }: DataViewerModalProps) {
  // Local state management instead of using Zustand
  const [activeTab, setActiveTab] = useState<TabId>("timetable");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [displayData, setDisplayData] = useState<any[]>([]);

  // Local table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Get simulation data from store
  const simulationResult = useSimulationStore(
    (state: any) => state.simulationResult
  );
  const loadedSimulationId = useSimulationStore(
    (state: any) => state.loadedSimulationId
  );
  const simulationName = useSimulationStore(
    (state: any) => state.simulationName
  );
  const activeSimulationSettings = useSimulationStore(
    (state) => state.activeSimulationSettings
  );

  // Check if we have data to display
  const hasData = useMemo(
    () =>
      loadedSimulationId !== null &&
      Array.isArray(simulationResult) &&
      simulationResult.length > 0,
    [loadedSimulationId, simulationResult]
  );

  // Total pages calculation
  const totalPages = useMemo(
    () => Math.ceil(totalItems / pageSize),
    [totalItems, pageSize]
  );

  // Handle tab changes
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabId);
    setCurrentPage(1);
    setRowSelection({});
  }, []);

  // Handle search input changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  // Filter and paginate data when dependencies change
  useEffect(() => {
    if (!hasData || !simulationResult) {
      setFilteredData([]);
      setDisplayData([]);
      setTotalItems(0);
      return;
    }

    setIsLoading(true);

    try {
      let dataToFilter: any[] = [];

      // Get data based on active tab
      if (activeTab === "timetable") {
        dataToFilter = simulationResult || [];
      } else if (activeTab === "passengerDemand") {
        dataToFilter = []; // Would be replaced with actual passenger demand data
      } else if (activeTab === "metrics") {
        dataToFilter = []; // Would be replaced with actual metrics data
      }

      // Apply search filter
      let filtered = dataToFilter;
      if (searchQuery.trim()) {
        const lowercaseQuery = searchQuery.toLowerCase();
        filtered = dataToFilter.filter((row) => {
          return Object.values(row).some((value) => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(lowercaseQuery);
          });
        });
      }

      // Update filtered data and total count
      setFilteredData(filtered);
      setTotalItems(filtered.length);

      // Apply pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, filtered.length);
      setDisplayData(filtered.slice(startIndex, endIndex));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    hasData,
    simulationResult,
    activeTab,
    searchQuery,
    currentPage,
    pageSize,
  ]);

  // Reset component when simulation result changes
  useEffect(() => {
    if (isOpen && simulationResult) {
      setActiveTab("timetable");
      setCurrentPage(1);
      setSearchQuery("");
      setRowSelection({});
    }
  }, [isOpen, simulationResult]);

  // Handle page change
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
      }
    },
    [totalPages]
  );

  // Handle page size change
  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  // Memoize components to prevent unnecessary re-renders
  const renderSkeleton = useMemo(
    () => (
      <div className="space-y-2">
        {Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    ),
    [pageSize]
  );

  const renderPagination = useMemo(
    () => (
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">Rows per page:</p>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => handlePageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize.toString()} />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
          >
            <IconChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            <span className="text-sm">
              {currentPage} of {totalPages || 1}
            </span>
            {isLoading ? (
              <span className="ml-2">
                <Skeleton className="h-4 w-4 rounded-full" />
              </span>
            ) : (
              <span className="text-sm text-muted-foreground ml-2">
                ({totalItems} items)
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            <IconChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ),
    [
      currentPage,
      pageSize,
      totalItems,
      totalPages,
      handlePageChange,
      handlePageSizeChange,
      isLoading,
    ]
  );

  // Memoized column definitions
  const memoizedTimetableColumns = useMemo(() => timetableColumns, []);
  const passengerDemandColumnsMemo = useMemo(() => passengerDemandColumns, []);
  const metricsColumnsMemo = useMemo(() => metricsColumns, []);

  // --- Add Heatmap State --- //
  const [heatmapData, setHeatmapData] = useState<HeatmapSeries[]>([]);
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);
  // ------------------------ //

  // Fetch and process passenger demand data for the heatmap
  useEffect(() => {
    if (isOpen && loadedSimulationId !== null) {
      const fetchHeatmapData = async () => {
        console.log(
          "[HEATMAP DEBUG] Starting fetchHeatmapData for sim ID:",
          loadedSimulationId
        );
        setIsHeatmapLoading(true);
        setHeatmapError(null);
        setHeatmapData([]); // Clear previous data

        try {
          const apiUrl = GET_PASSENGER_DEMAND_ENDPOINT(loadedSimulationId);
          console.log("[HEATMAP DEBUG] Fetching from URL:", apiUrl);
          const response = await fetch(apiUrl);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error ${response.status}`);
          }
          const rawDemandData = await response.json();
          console.log("[HEATMAP DEBUG] Raw API Response:", rawDemandData);

          if (!Array.isArray(rawDemandData)) {
            throw new Error("Invalid data format received from API");
          }

          // --- Transform raw data into HeatmapSeries[] format --- //
          const transformedData: Record<string, Record<string, number>> = {};
          const stationNames: Record<number, string> = {};
          if (activeSimulationSettings?.stations) {
            activeSimulationSettings.stations.forEach((s, index) => {
              stationNames[index + 1] = s.name;
            });
          }

          rawDemandData.forEach((entry: any) => {
            // Use the correct keys from the API response
            const route = entry.Route;
            const count = entry.Passengers || 0;

            // Parse origin/destination IDs from the 'Route' string
            if (route && typeof route === "string" && route.includes("-")) {
              const [originIdStr, destIdStr] = route.split("-");
              const originId = parseInt(originIdStr, 10);
              const destId = parseInt(destIdStr, 10);

              if (!isNaN(originId) && !isNaN(destId)) {
                const originName = stationNames[originId] || `Stn ${originId}`;
                const destName = stationNames[destId] || `Stn ${destId}`;

                if (!transformedData[originName]) {
                  transformedData[originName] = {};
                }
                transformedData[originName][destName] =
                  (transformedData[originName][destName] || 0) + count;
              } else {
                console.warn(
                  "[HEATMAP DEBUG] Could not parse origin/destination IDs from route:",
                  route
                );
              }
            } else {
              // Log if the route key is missing or invalid
              console.warn(
                "[HEATMAP DEBUG] Invalid or missing 'Route' key in raw data entry:",
                entry
              );
            }
          });

          console.log(
            "[HEATMAP DEBUG] Intermediate Transformed Data:",
            transformedData
          );

          const heatmapSeries: HeatmapSeries[] = Object.entries(
            transformedData
          ).map(([originName, destinations]) => ({
            id: originName,
            data: Object.entries(destinations).map(([destName, count]) => ({
              x: destName,
              y: count,
            })),
          }));
          // ----------------------------------------------------- //

          console.log("[HEATMAP DEBUG] Final HeatmapSeries:", heatmapSeries);
          setHeatmapData(heatmapSeries);
        } catch (error: any) {
          console.error("Error fetching heatmap data:", error);
          console.log("[HEATMAP DEBUG] Error caught:", error);
          setHeatmapError(`Failed to load heatmap data: ${error.message}`);
        } finally {
          setIsHeatmapLoading(false);
        }
      };

      fetchHeatmapData();
    }
  }, [isOpen, loadedSimulationId, activeSimulationSettings]); // Add activeSimulationSettings as dependency for station names

  return (
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

        {!hasData ? (
          <div className="py-12 text-center text-muted-foreground">
            No simulation data available. Please load a simulation first.
          </div>
        ) : (
          <Tabs
            defaultValue="timetable"
            value={activeTab}
            onValueChange={handleTabChange}
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
                renderSkeleton
              ) : error ? (
                <div className="py-8 text-center text-red-500">
                  Error loading data: {error}
                </div>
              ) : displayData.length === 0 && searchQuery.trim() !== "" ? (
                <div className="py-8 text-center text-muted-foreground">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <DataTable
                    columns={memoizedTimetableColumns}
                    data={displayData}
                    sorting={sorting}
                    setSorting={setSorting}
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    stickyHeader={true}
                  />
                  {renderPagination}
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="passengerDemand"
              className="pt-2 flex-1 flex flex-col overflow-hidden"
            >
              {/* Conditional rendering for heatmap */}
              {isHeatmapLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Skeleton className="h-[400px] w-[80%]" />
                </div>
              ) : heatmapError ? (
                <div className="py-8 text-center text-red-500">
                  Error loading heatmap data: {heatmapError}
                </div>
              ) : heatmapData.length > 0 ? (
                // Render heatmap if data is available
                <div className="flex-1 min-h-0">
                  {" "}
                  {/* Ensure flex container takes space */}
                  <PassengerHeatmap data={heatmapData} />
                </div>
              ) : (
                // Show message if no data and no error
                <div className="py-8 text-center text-muted-foreground">
                  No passenger demand data available for heatmap.
                </div>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="pt-2 flex-1 flex flex-col">
              <DataTable
                columns={metricsColumnsMemo}
                data={[]} // Empty data for now
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
