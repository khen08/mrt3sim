import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMetricsStore } from "@/store/metricsStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAPIStore } from "@/store/apiStore";
import { ComparativeBarChart } from "./ComparativeBarChart";
import { JourneyTimeStackedBar } from "./JourneyTimeStackedBar";
import { PassengerCountsChart } from "./PassengerCountsChart";
import { ODMatrixHeatmap } from "./ODMatrixHeatmap";
import { TimeDistributionBoxPlot } from "./TimeDistributionBoxPlot";
import { TimeSeriesPlot } from "./TimeSeriesPlot";
import { TripTypeBarChart } from "./TripTypeBarChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePassengerDemandStore } from "@/store/passengerDemandStore";
import PassengerHeatmapTab from "./PassengerHeatmapTab";

const MetricsTab: React.FC = () => {
  const loadedSimulationId = useSimulationStore(
    (state) => state.loadedSimulationId
  );
  const fetchMetrics = useMetricsStore((state) => state.fetchMetrics);
  const {
    isLoading: metricsLoading,
    error: metricsError,
    rawMetricsData,
  } = useMetricsStore();

  const {
    actions: passengerDemandActions,
    isLoading: demandLoading,
    error: demandError,
    passengerDemand,
  } = usePassengerDemandStore();

  // Fetch metrics and passenger demand when the component mounts
  useEffect(() => {
    if (loadedSimulationId) {
      console.log(
        `MetricsTab: Fetching data for simulation ID ${loadedSimulationId}`
      );

      // Fetch metrics data
      fetchMetrics(loadedSimulationId);

      // Fetch passenger demand data with force refresh
      passengerDemandActions.fetchPassengerDemand(loadedSimulationId, true);

      // Set station names for proper labels in visualizations
      const simStore = useSimulationStore.getState();
      if (simStore.simulationSettings?.stations) {
        // Map station configurations to id/name pairs
        // In the StationConfig type, stations might have numeric index rather than 'id'
        const stationData = simStore.simulationSettings.stations.map(
          (station, index) => ({
            // Use index+1 as id if not available in the station object
            id: index + 1,
            name: station.name,
          })
        );
        passengerDemandActions.setStationNames(stationData);
      }
    }
  }, [loadedSimulationId, fetchMetrics, passengerDemandActions]);

  // Log loaded passenger demand data for debugging
  useEffect(() => {
    if (passengerDemand && passengerDemand.length > 0) {
      // Count entries by scheme type
      const regularCount = passengerDemand.filter(
        (entry) => entry.SCHEME_TYPE === "REGULAR"
      ).length;
      const skipStopCount = passengerDemand.filter(
        (entry) => entry.SCHEME_TYPE === "SKIP-STOP"
      ).length;

      console.log(
        `MetricsTab: Loaded ${passengerDemand.length} passenger demand entries ` +
          `(${regularCount} REGULAR, ${skipStopCount} SKIP-STOP)`
      );

      // Show a sample entry to verify data structure
      console.log("Sample passenger demand entry:", passengerDemand[0]);
    }
  }, [passengerDemand]);

  const isLoading = metricsLoading || demandLoading;
  const error = metricsError || demandError;

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

  if (!rawMetricsData.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No metrics data available for this simulation.</p>
        <p className="text-sm mt-2">
          Please run a simulation that includes both REGULAR and SKIP-STOP
          schemes to view comparison metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden w-[1000px]">
      <Tabs defaultValue="comparison" className="w-full flex-1 overflow-auto">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="comparison">Scheme Comparison</TabsTrigger>
          <TabsTrigger value="journey">Journey Composition</TabsTrigger>
          <TabsTrigger value="passengers">Passenger Counts</TabsTrigger>
          <TabsTrigger value="passengerDemand">Passenger Demand</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="h-full overflow-auto">
          <Card className="w-full">
            <CardContent>
              <ComparativeBarChart height={350} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journey" className="h-full overflow-auto">
          <Card className="w-full">
            <CardContent>
              <JourneyTimeStackedBar height={350} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passengers" className="h-full overflow-auto">
          <Card className="w-full">
            <CardContent>
              <PassengerCountsChart
                title="Total Passengers Who Completed Their Journey by Scheme"
                height={350}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passengerDemand" className="h-full overflow-auto">
          <Tabs defaultValue="odMatrix" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="odMatrix">OD Matrix</TabsTrigger>
              <TabsTrigger value="timeDistribution">
                Time Distribution
              </TabsTrigger>
              <TabsTrigger value="timeSeries">Time Series</TabsTrigger>
              <TabsTrigger value="tripTypes">Trip Types</TabsTrigger>
            </TabsList>

            <TabsContent value="odMatrix" className="mt-4">
              <PassengerHeatmapTab />
            </TabsContent>

            <TabsContent value="timeDistribution" className="mt-4">
              <TimeDistributionBoxPlot height={400} />
            </TabsContent>

            <TabsContent value="timeSeries" className="mt-4">
              <TimeSeriesPlot height={400} />
            </TabsContent>

            <TabsContent value="tripTypes" className="mt-4">
              <TripTypeBarChart height={400} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MetricsTab;
