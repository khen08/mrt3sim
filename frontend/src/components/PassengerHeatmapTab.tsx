import React, { useMemo, useState } from "react";
import {
  useSimulationStore,
  TimePeriodFilter,
  AggregatedDemandEntry,
} from "@/store/simulationStore";
import PassengerHeatmap from "@/components/PassengerHeatmap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLoader2, IconInfoCircle } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the expected structure for ECharts heatmap data items
interface EchartsHeatmapDataItem {
  value: [number, number, number]; // [originIndex, destinationIndex, passengerCount]
  originName: string;
  destinationName: string;
}

const stationNames: { [key: string]: string } = {
  "1": "North Ave",
  "2": "Quezon Ave",
  "3": "Kamuning",
  "4": "Cubao",
  "5": "Santolan",
  "6": "Ortigas",
  "7": "Shaw",
  "8": "Boni",
  "9": "Guadalupe",
  "10": "Buendia",
  "11": "Ayala",
  "12": "Magallanes",
  "13": "Taft Ave",
};

const stationOrder = Object.keys(stationNames).sort(
  (a, b) => parseInt(a) - parseInt(b)
); // "1" to "13"

// Helper to get index for ECharts data (0-indexed)
const getStationIndex = (stationId: string): number => {
  return stationOrder.indexOf(stationId);
};

const PassengerHeatmapTab: React.FC = () => {
  const {
    aggregatedPassengerDemand,
    selectedTimePeriod,
    setSelectedTimePeriod,
    isAggregatedDemandLoading,
    activeSimulationSettings,
  } = useSimulationStore();

  const currentScheme = activeSimulationSettings?.schemeType || "REGULAR";

  const echartsHeatmapData = useMemo(() => {
    if (!aggregatedPassengerDemand || isAggregatedDemandLoading) {
      return [];
    }

    const periodData = aggregatedPassengerDemand[selectedTimePeriod];
    if (!periodData) return [];

    const schemeData = periodData[currentScheme];
    if (!schemeData || schemeData.length === 0) return [];

    const transformedData: EchartsHeatmapDataItem[] = [];

    schemeData.forEach((entry: AggregatedDemandEntry) => {
      const [originId, destinationId] = entry.ROUTE.split("-");

      // Ensure IDs are valid and present in stationOrder
      if (
        stationOrder.includes(originId) &&
        stationOrder.includes(destinationId) &&
        originId !== destinationId
      ) {
        const originIndex = getStationIndex(originId);
        const destinationIndex = getStationIndex(destinationId);
        const passengerCount = entry.PASSENGER_COUNT;

        transformedData.push({
          value: [originIndex, destinationIndex, passengerCount],
          originName: stationNames[originId] || `Station ${originId}`,
          destinationName:
            stationNames[destinationId] || `Station ${destinationId}`,
        });
      }
    });

    // ECharts heatmap doesn't require pre-filling all cells with 0 if all possible OD pairs are not in schemeData.
    // It will simply not render cells for missing data points.
    // However, if you want to ensure all cells are explicitly represented (even with 0),
    // you would iterate through all stationOrder pairs and add 0-value entries if not found in schemeData.
    // For now, we only plot actual data points.

    return transformedData;
  }, [
    aggregatedPassengerDemand,
    selectedTimePeriod,
    currentScheme,
    isAggregatedDemandLoading,
  ]);

  const handleTimePeriodChange = (value: string) => {
    setSelectedTimePeriod(value as TimePeriodFilter);
  };

  if (isAggregatedDemandLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <IconLoader2 className="h-12 w-12 animate-spin text-mrt-blue" />
        <p className="ml-4 text-lg">Loading Heatmap Data...</p>
      </div>
    );
  }

  if (!aggregatedPassengerDemand || echartsHeatmapData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Alert className="max-w-md">
          <IconInfoCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            Aggregated passenger demand data is not available for the selected
            period or scheme, or the simulation did not generate this data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Card className="h-full w-[800px] flex flex-col">
      <CardHeader>
        <CardTitle>Passenger Demand Heatmap</CardTitle>
        <div className="flex space-x-4 mt-4">
          <div>
            <label
              htmlFor="time-period-select"
              className="text-sm font-medium mr-2"
            >
              Time Period:
            </label>
            <Select
              onValueChange={handleTimePeriodChange}
              defaultValue={selectedTimePeriod}
            >
              <SelectTrigger id="time-period-select" className="w-[180px]">
                <SelectValue placeholder="Select Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_SERVICE">Full Service</SelectItem>
                <SelectItem value="AM_PEAK">AM Peak</SelectItem>
                <SelectItem value="PM_PEAK">PM Peak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto pt-4">
        {/* Use the new ECharts component and pass necessary props */}
        <PassengerHeatmap
          data={echartsHeatmapData}
          stationOrder={stationOrder}
          stationNames={stationNames}
        />
      </CardContent>
    </Card>
  );
};

export default PassengerHeatmapTab;
