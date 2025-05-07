import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMetricsStore } from "@/store/metricsStore";
import { useSimulationStore } from "@/store/simulationStore";
import { usePassengerDemandStore } from "@/store/passengerDemandStore";
import {
  useCurrentProcessedMetrics,
  useCurrentRawMetrics,
} from "@/store/metricsStore";
import { ComparativeBarChart } from "./ComparativeBarChart";
import { TimePeriodFilter } from "@/store/simulationStore";
import { JourneyTimeStackedBar } from "./JourneyTimeStackedBar";
import { PassengerCountsChart } from "./PassengerCountsChart";
import { PassengerHeatmapChart } from "./PassengerHeatmapChart";
import { TimeDistributionBoxPlot } from "./TimeDistributionBoxPlot";
import { TimeSeriesPlot } from "./TimeSeriesPlot";
import { TripTypeBarChart } from "./TripTypeBarChart";
import {
  IconChartBar,
  IconChartLine,
  IconChartDots3,
  IconUsers,
  IconArrowLeft,
  IconTable,
  IconStack2,
  IconTimeline,
  IconBoxMultiple,
  IconLoader2,
} from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BarChart3,
  LineChart,
  Users,
  PieChart,
  Map,
  ListFilter,
  Type,
  Clock,
} from "lucide-react";

type TimeDistMetricType = "WAIT_TIME" | "TRAVEL_TIME";
type TimeDistBreakdownType = "SCHEME_TYPE" | "TRIP_TYPE";
type TimeSeriesMetricType = "PASSENGER_COUNT" | "WAIT_TIME" | "TRAVEL_TIME";
type TripTypeMetricType = "PASSENGER_COUNT" | "WAIT_TIME" | "TRAVEL_TIME";
type HeatmapMetricType = "PASSENGER_COUNT" | "WAIT_TIME" | "TRAVEL_TIME";
type PassengerDemandSchemeType = "REGULAR" | "SKIP-STOP";

interface ChartGalleryItem {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  component: React.ReactNode;
  dataTestId?: string;
  width?: number;
  height?: number;
}

const MetricsTab: React.FC = () => {
  const loadedSimulationId = useSimulationStore(
    (state) => state.loadedSimulationId
  );
  const {
    fetchMetrics,
    isLoading: metricsLoading,
    error: metricsError,
    rawMetricsData,
  } = useMetricsStore();
  const currentRawMetrics = useCurrentRawMetrics();
  const currentProcessedMetrics = useCurrentProcessedMetrics();
  const {
    actions: passengerDemandActions,
    isLoading: demandLoading,
    error: demandError,
    passengerDemand,
  } = usePassengerDemandStore();

  const [selectedChartKey, setSelectedChartKey] = useState<string | null>(null);
  const [timeDistMetric, setTimeDistMetric] =
    useState<TimeDistMetricType>("WAIT_TIME");
  const [timeDistBreakdown, setTimeDistBreakdown] =
    useState<TimeDistBreakdownType>("SCHEME_TYPE");
  const [timeSeriesMetric, setTimeSeriesMetric] =
    useState<TimeSeriesMetricType>("PASSENGER_COUNT");
  const [tripTypeMetric, setTripTypeMetric] =
    useState<TripTypeMetricType>("PASSENGER_COUNT");
  const [selectedHeatmapMetric, setSelectedHeatmapMetric] =
    useState<HeatmapMetricType>("PASSENGER_COUNT");
  const [selectedHeatmapScheme, setSelectedHeatmapScheme] =
    useState<PassengerDemandSchemeType>("REGULAR");

  // Get necessary state/setters from simulationStore for the heatmap selector
  const selectedTimePeriod = useSimulationStore(
    (state) => state.selectedTimePeriod
  );
  const setSelectedTimePeriod = useSimulationStore(
    (state) => state.setSelectedTimePeriod
  );

  // Fetch metrics and passenger demand when the component mounts or simulation ID changes
  useEffect(() => {
    if (loadedSimulationId) {
      console.log(
        `MetricsTab: Fetching data for simulation ID ${loadedSimulationId}`
      );
      // Fetch metrics (Zustand store will handle caching internally later)
      fetchMetrics(loadedSimulationId);
      // Fetch passenger demand (Zustand store already has caching)
      passengerDemandActions.fetchPassengerDemand(loadedSimulationId);

      const simStore = useSimulationStore.getState();
      if (simStore.simulationSettings?.stations) {
        const stationData = simStore.simulationSettings.stations.map(
          (station, index) => ({
            id: index + 1,
            name: station.name,
          })
        );
        passengerDemandActions.setStationNames(stationData);
      }
    }
  }, [loadedSimulationId, fetchMetrics, passengerDemandActions]);

  const isLoading = metricsLoading || demandLoading;
  const error = metricsError || demandError;

  const chartGalleryItems = useMemo<ChartGalleryItem[]>(
    () => [
      {
        key: "schemeComparison",
        title: "Scheme Performance",
        description:
          "Compare average time metrics (wait, travel, total journey) between Regular and Skip-Stop schemes.",
        icon: IconChartBar,
        component: <ComparativeBarChart height={400} width={1000} />,
        dataTestId: "scheme-comparison-card",
      },
      {
        key: "journeyComposition",
        title: "Journey Time Breakdown",
        description:
          "View the composition of total journey time (wait vs. travel) for each scheme.",
        icon: IconStack2,
        component: <JourneyTimeStackedBar height={400} width={1000} />,
        dataTestId: "journey-composition-card",
      },
      {
        key: "passengerCounts",
        title: "Passenger Throughput",
        description:
          "Total passengers who completed their journey, by operational scheme.",
        icon: IconUsers,
        component: (
          <PassengerCountsChart
            title="Total Passengers by Scheme"
            height={400}
            width={1000}
          />
        ),
        dataTestId: "passenger-counts-card",
      },
      {
        key: "odMatrix",
        title: "O-D Passenger Heatmap",
        description:
          "Visualize passenger demand between origin and destination stations.",
        icon: Map,
        component: (
          <PassengerHeatmapChart
            height={450}
            width={1000}
            selectedMetric={selectedHeatmapMetric}
            selectedScheme={selectedHeatmapScheme}
          />
        ),
        dataTestId: "od-matrix-card",
      },
      {
        key: "timeDistribution",
        title: "Time Distribution (Box Plot)",
        description:
          "Distribution of wait and travel times by scheme or trip type.",
        icon: IconBoxMultiple,
        component: (
          <TimeDistributionBoxPlot
            height={400}
            width={1000}
            selectedMetric={timeDistMetric}
            onMetricChange={setTimeDistMetric}
            breakdownBy={timeDistBreakdown}
            onBreakdownChange={setTimeDistBreakdown}
          />
        ),
        dataTestId: "time-distribution-card",
      },
      {
        key: "timeSeries",
        title: "Time Series Analysis",
        description:
          "View passenger count, average wait, or travel time over the simulation period.",
        icon: IconTimeline,
        component: (
          <TimeSeriesPlot
            height={400}
            width={1000}
            selectedMetric={timeSeriesMetric}
            onMetricChange={setTimeSeriesMetric}
          />
        ),
        dataTestId: "time-series-card",
      },
      {
        key: "tripTypes",
        title: "Trip Type Metrics",
        description:
          "Compare metrics for direct vs. transfer trips under different schemes.",
        icon: IconChartDots3,
        component: (
          <TripTypeBarChart
            height={400}
            width={1000}
            selectedMetric={tripTypeMetric}
            onMetricChange={setTripTypeMetric}
          />
        ),
        dataTestId: "trip-types-card",
      },
    ],
    [
      timeDistMetric,
      timeDistBreakdown,
      timeSeriesMetric,
      tripTypeMetric,
      selectedHeatmapMetric,
      selectedHeatmapScheme,
    ]
  );

  const selectedChart = chartGalleryItems.find(
    (item) => item.key === selectedChartKey
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <span className="ml-3">Loading metrics data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        <span>Error: {error}</span>
      </div>
    );
  }

  if (!currentRawMetrics && !passengerDemand && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No metrics data available for this simulation.</p>
        <p className="text-sm mt-2">
          Please ensure the simulation has run and generated metrics.
        </p>
      </div>
    );
  }

  // Check if there's any data to display at all for the gallery.
  // This can be refined to check specific data needed for each chart later.
  const canDisplayMetrics =
    (currentRawMetrics && currentRawMetrics.length > 0) ||
    (passengerDemand && passengerDemand.length > 0);

  if (!canDisplayMetrics && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No metrics or passenger demand data available to display charts.</p>
        <p className="text-sm mt-2">
          Ensure the simulation has run successfully and generated output.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 w-full">
      {selectedChart ? (
        <div className="flex flex-col h-full">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedChartKey(null)}
              className="mr-4"
            >
              <IconArrowLeft className="mr-2 h-4 w-4" />
              Back to Gallery
            </Button>
            <div className="flex items-center gap-4">
              {selectedChart.key === "timeDistribution" && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium shrink-0">
                      Metric:
                    </label>
                    <Select
                      value={timeDistMetric}
                      onValueChange={
                        setTimeDistMetric as (value: string) => void
                      }
                    >
                      <SelectTrigger className="w-[150px] h-8 text-sm">
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WAIT_TIME">Wait Time</SelectItem>
                        <SelectItem value="TRAVEL_TIME">Travel Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium shrink-0">
                      Breakdown by:
                    </label>
                    <Select
                      value={timeDistBreakdown}
                      onValueChange={
                        setTimeDistBreakdown as (value: string) => void
                      }
                    >
                      <SelectTrigger className="w-[150px] h-8 text-sm">
                        <SelectValue placeholder="Select breakdown" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SCHEME_TYPE">Scheme Type</SelectItem>
                        <SelectItem value="TRIP_TYPE">Trip Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {selectedChart.key === "timeSeries" && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium shrink-0">
                    Metric:
                  </label>
                  <Select
                    value={timeSeriesMetric}
                    onValueChange={
                      setTimeSeriesMetric as (value: string) => void
                    }
                  >
                    <SelectTrigger className="w-[180px] h-8 text-sm">
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PASSENGER_COUNT">
                        Passenger Count
                      </SelectItem>
                      <SelectItem value="WAIT_TIME">
                        Average Wait Time
                      </SelectItem>
                      <SelectItem value="TRAVEL_TIME">
                        Average Travel Time
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedChart.key === "tripTypes" && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium shrink-0">
                    Metric:
                  </label>
                  <Select
                    value={tripTypeMetric}
                    onValueChange={setTripTypeMetric as (value: string) => void}
                  >
                    <SelectTrigger className="w-fit h-8 text-sm">
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PASSENGER_COUNT">
                        Passenger Count
                      </SelectItem>
                      <SelectItem value="WAIT_TIME">
                        Average Wait Time
                      </SelectItem>
                      <SelectItem value="TRAVEL_TIME">
                        Average Travel Time
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedChart.key === "odMatrix" && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium shrink-0">
                      Time Period:
                    </label>
                    <Select
                      value={selectedTimePeriod}
                      onValueChange={(value) =>
                        setSelectedTimePeriod(value as TimePeriodFilter)
                      }
                    >
                      <SelectTrigger className="w-[160px] h-8 text-sm">
                        <SelectValue placeholder="Select Time Period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL_SERVICE">
                          Full Service
                        </SelectItem>
                        <SelectItem value="AM_PEAK">AM Peak</SelectItem>
                        <SelectItem value="PM_PEAK">PM Peak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium shrink-0">
                      Metric:
                    </label>
                    <Select
                      value={selectedHeatmapMetric}
                      onValueChange={(v) =>
                        setSelectedHeatmapMetric(v as HeatmapMetricType)
                      }
                    >
                      <SelectTrigger className="w-fit h-8 text-sm">
                        <SelectValue placeholder="Select Metric" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASSENGER_COUNT">
                          Passenger Count
                        </SelectItem>
                        <SelectItem value="WAIT_TIME">
                          Average Wait Time (min)
                        </SelectItem>
                        <SelectItem value="TRAVEL_TIME">
                          Average Travel Time (min)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium shrink-0">
                      Scheme:
                    </label>
                    <Select
                      value={selectedHeatmapScheme}
                      onValueChange={(v) =>
                        setSelectedHeatmapScheme(v as PassengerDemandSchemeType)
                      }
                    >
                      <SelectTrigger className="w-fit h-8 text-sm">
                        <SelectValue placeholder="Select Scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REGULAR">Regular</SelectItem>
                        <SelectItem value="SKIP-STOP">Skip-Stop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex-grow overflow-y-auto pt-0">
            {selectedChart.component}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Metrics & Analysis Gallery
            </h1>
            <p className="text-muted-foreground">
              Select a chart to view detailed insights from the simulation.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 overflow-y-auto flex-grow pb-4">
            {chartGalleryItems.map((item) => (
              <Card
                key={item.key}
                className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full"
                onClick={() => setSelectedChartKey(item.key)}
                data-testid={item.dataTestId}
              >
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-center mb-2">
                    <item.icon className="h-6 w-6 mr-3 text-primary" />
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MetricsTab;
