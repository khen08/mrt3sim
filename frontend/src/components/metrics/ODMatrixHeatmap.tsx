import React, { useState } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePassengerDemandStore } from "@/store/passengerDemandStore";

type MetricType = "PASSENGER_COUNT" | "WAIT_TIME" | "TRAVEL_TIME";

interface ODMatrixHeatmapProps {
  height?: number | string;
}

export const ODMatrixHeatmap: React.FC<ODMatrixHeatmapProps> = ({
  height = "500px",
}) => {
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>("PASSENGER_COUNT");
  const [selectedScheme, setSelectedScheme] = useState<"REGULAR" | "SKIP-STOP">(
    "REGULAR"
  );

  const { passengerDemand, isLoading, error } = usePassengerDemandStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        Error loading data: {error}
      </div>
    );
  }

  if (!passengerDemand || passengerDemand.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No passenger demand data available
      </div>
    );
  }

  // Get unique station IDs
  const getUniqueStationIds = () => {
    const originIds = new Set<string>();
    const destIds = new Set<string>();

    passengerDemand.forEach((entry: any) => {
      originIds.add(String(entry.ORIGIN_STATION_ID));
      destIds.add(String(entry.DESTINATION_STATION_ID));
    });

    return {
      originIds: Array.from(originIds).sort(
        (a, b) => parseInt(a) - parseInt(b)
      ),
      destIds: Array.from(destIds).sort((a, b) => parseInt(a) - parseInt(b)),
    };
  };

  const { originIds, destIds } = getUniqueStationIds();

  // Process data for heatmap
  const prepareHeatmapData = () => {
    // Create a matrix for storing aggregated values
    const matrix: Record<
      string,
      Record<string, { sum: number; count: number }>
    > = {};

    // Initialize matrix cells
    originIds.forEach((origin) => {
      matrix[origin] = {};
      destIds.forEach((dest) => {
        matrix[origin][dest] = { sum: 0, count: 0 };
      });
    });

    // Aggregate data
    passengerDemand.forEach((entry: any) => {
      const origin = String(entry.ORIGIN_STATION_ID);
      const dest = String(entry.DESTINATION_STATION_ID);

      if (entry.SCHEME_TYPE === selectedScheme) {
        if (selectedMetric === "PASSENGER_COUNT") {
          matrix[origin][dest].sum += entry.PASSENGER_COUNT;
          matrix[origin][dest].count += 1;
        } else {
          const value = entry[selectedMetric];
          if (typeof value === "number" && value > 0) {
            matrix[origin][dest].sum += value;
            matrix[origin][dest].count += 1;
          }
        }
      }
    });

    // Convert to format required by ECharts: [origin index, dest index, value]
    const result: Array<[number, number, number]> = [];

    originIds.forEach((origin, originIdx) => {
      destIds.forEach((dest, destIdx) => {
        const cell = matrix[origin][dest];
        let value: number;

        if (selectedMetric === "PASSENGER_COUNT") {
          value = cell.sum;
        } else {
          const averageInSeconds = cell.count > 0 ? cell.sum / cell.count : 0;
          value = averageInSeconds / 60;
        }

        // Only include non-zero values
        if (value > 0) {
          result.push([originIdx, destIdx, value]);
        }
      });
    });

    return result;
  };

  const heatmapData = prepareHeatmapData();

  // Calculate min/max for visualMap
  const getMinMax = () => {
    if (heatmapData.length === 0) return { min: 0, max: 100 };

    const values = heatmapData.map((item) => item[2]);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  };

  const { min, max } = getMinMax();

  const getOption = () => {
    const option = {
      title: {
        text: `Origin-Destination Heatmap for ${
          selectedMetric === "PASSENGER_COUNT"
            ? "Passenger Count"
            : selectedMetric === "WAIT_TIME"
            ? "Average Wait Time"
            : "Average Travel Time"
        } (${selectedScheme})`,
        left: "center",
      },
      tooltip: {
        position: "top",
        formatter: (params: any) => {
          const originLabel = `Origin: Station ${originIds[params.data[0]]}`;
          const destLabel = `Destination: Station ${destIds[params.data[1]]}`;
          const valueLabelMinutes =
            selectedMetric === "PASSENGER_COUNT"
              ? `Passengers: ${params.data[2].toLocaleString()}`
              : `${
                  selectedMetric === "WAIT_TIME" ? "Wait Time" : "Travel Time"
                }: ${params.data[2].toFixed(2)} minutes`;
          return `${originLabel}<br/>${destLabel}<br/>${valueLabelMinutes}`;
        },
      },
      grid: {
        left: "15%",
        right: "10%",
        bottom: "15%",
        top: "15%",
      },
      xAxis: {
        type: "category",
        data: destIds.map((id) => `Station ${id}`),
        name: "Destination",
        nameLocation: "middle",
        nameGap: 40,
        splitArea: {
          show: true,
        },
        axisLabel: {
          interval: 0,
          rotate: 45,
        },
      },
      yAxis: {
        type: "category",
        data: originIds.map((id) => `Station ${id}`),
        name: "Origin",
        nameLocation: "middle",
        nameGap: 50,
        splitArea: {
          show: true,
        },
      },
      visualMap: {
        min: min,
        max: max,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: "5%",
        inRange: {
          color:
            selectedMetric === "PASSENGER_COUNT"
              ? ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"] // Green gradient for passenger counts
              : ["#ffffbf", "#fc8d59", "#e34a33", "#b30000"], // Red gradient for time metrics
        },
        formatter: (value: number) => {
          if (selectedMetric === "PASSENGER_COUNT") {
            return value.toFixed(0);
          } else {
            return value.toFixed(1) + "min";
          }
        },
      },
      series: [
        {
          name:
            selectedMetric === "PASSENGER_COUNT"
              ? "Passenger Count"
              : selectedMetric === "WAIT_TIME"
              ? "Average Wait Time"
              : "Average Travel Time",
          type: "heatmap",
          data: heatmapData,
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };

    return option;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Origin-Destination Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-4 mb-4">
          <div className="w-1/2">
            <label className="text-sm font-medium mb-1 block">Metric:</label>
            <Select
              value={selectedMetric}
              onValueChange={(value) => setSelectedMetric(value as MetricType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSENGER_COUNT">Passenger Count</SelectItem>
                <SelectItem value="WAIT_TIME">Average Wait Time</SelectItem>
                <SelectItem value="TRAVEL_TIME">Average Travel Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-1/2">
            <label className="text-sm font-medium mb-1 block">Scheme:</label>
            <Select
              value={selectedScheme}
              onValueChange={(value) =>
                setSelectedScheme(value as "REGULAR" | "SKIP-STOP")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select scheme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REGULAR">Regular</SelectItem>
                <SelectItem value="SKIP-STOP">Skip-Stop</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <ReactECharts option={getOption()} style={{ height }} />
      </CardContent>
    </Card>
  );
};
