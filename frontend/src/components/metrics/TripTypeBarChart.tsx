import React from "react";
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

interface TripTypeBarChartProps {
  height?: number | string;
  width?: number | string;
  selectedMetric: MetricType;
  onMetricChange: (value: MetricType) => void;
}

export const TripTypeBarChart: React.FC<TripTypeBarChartProps> = ({
  height = "400px",
  width = "100%",
  selectedMetric,
  onMetricChange,
}) => {
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

  // Process data for scheme type comparison with stacked trip types
  const prepareStackedData = () => {
    console.log(
      "Processing stacked trip type data from",
      passengerDemand.length,
      "entries"
    );

    // Data structure to hold aggregated values
    const data = {
      REGULAR: {
        DIRECT: { sum: 0, count: 0 },
        TRANSFER: { sum: 0, count: 0 },
      },
      "SKIP-STOP": {
        DIRECT: { sum: 0, count: 0 },
        TRANSFER: { sum: 0, count: 0 },
      },
    };

    // Verify we have entries with proper data
    if (passengerDemand.length > 0) {
      console.log("Sample entry:", passengerDemand[0]);
    }

    // Aggregate data
    passengerDemand.forEach((entry) => {
      const tripType = entry.TRIP_TYPE;
      const scheme = entry.SCHEME_TYPE;

      // Check if this is a valid entry with proper data
      if (!tripType || !scheme) {
        console.warn(
          "Found invalid entry missing TRIP_TYPE or SCHEME_TYPE:",
          entry
        );
        return; // Skip this entry
      }

      // Skip if not expected trip type or scheme
      if (
        (tripType !== "DIRECT" && tripType !== "TRANSFER") ||
        (scheme !== "REGULAR" && scheme !== "SKIP-STOP")
      ) {
        console.warn(
          `Skipping entry with unexpected tripType=${tripType} or scheme=${scheme}`
        );
        return;
      }

      // Ensure the data structure exists
      if (!data[scheme]) {
        data[scheme] = {
          DIRECT: { sum: 0, count: 0 },
          TRANSFER: { sum: 0, count: 0 },
        };
      }

      if (!data[scheme][tripType]) {
        data[scheme][tripType] = { sum: 0, count: 0 };
      }

      if (selectedMetric === "PASSENGER_COUNT") {
        data[scheme][tripType].sum += entry.PASSENGER_COUNT || 0;
        data[scheme][tripType].count += 1;
      } else {
        const value = entry[selectedMetric];
        if (typeof value === "number") {
          data[scheme][tripType].sum += value;
          data[scheme][tripType].count += 1;
        }
      }
    });

    console.log("Aggregated stacked data:", data);

    // Calculate final values
    const result = {
      REGULAR: {
        DIRECT:
          selectedMetric === "PASSENGER_COUNT"
            ? data.REGULAR.DIRECT.sum
            : data.REGULAR.DIRECT.count > 0
            ? data.REGULAR.DIRECT.sum / data.REGULAR.DIRECT.count
            : 0,
        TRANSFER:
          selectedMetric === "PASSENGER_COUNT"
            ? data.REGULAR.TRANSFER.sum
            : data.REGULAR.TRANSFER.count > 0
            ? data.REGULAR.TRANSFER.sum / data.REGULAR.TRANSFER.count
            : 0,
      },
      "SKIP-STOP": {
        DIRECT:
          selectedMetric === "PASSENGER_COUNT"
            ? data["SKIP-STOP"].DIRECT.sum
            : data["SKIP-STOP"].DIRECT.count > 0
            ? data["SKIP-STOP"].DIRECT.sum / data["SKIP-STOP"].DIRECT.count
            : 0,
        TRANSFER:
          selectedMetric === "PASSENGER_COUNT"
            ? data["SKIP-STOP"].TRANSFER.sum
            : data["SKIP-STOP"].TRANSFER.count > 0
            ? data["SKIP-STOP"].TRANSFER.sum / data["SKIP-STOP"].TRANSFER.count
            : 0,
      },
    };

    return result;
  };

  const stackedData = prepareStackedData();

  // Dynamic text color based on theme
  const isDarkMode =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const textColor = isDarkMode ? "#E0E0E0" : "#333333";
  const axisColor = isDarkMode ? "#AAAAAA" : "#666666";
  const legendColor = isDarkMode ? "#CCCCCC" : "#555555";

  const getOption = () => {
    const metricLabel =
      selectedMetric === "PASSENGER_COUNT"
        ? "Passenger Count"
        : "Time (minutes)";

    const formatValue = (value: number) => {
      if (selectedMetric === "PASSENGER_COUNT") {
        return value.toLocaleString();
      } else {
        return (value / 60).toFixed(2) + " min";
      }
    };

    const option = {
      title: {
        text: `Trip Distribution by Scheme Type (${metricLabel})`,
        left: "center",
        textStyle: {
          color: textColor,
          fontSize: 16,
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          const schemeName = params[0].axisValue;
          let total = 0;
          let result = `<div style="font-weight:bold">${schemeName} Scheme</div>`;

          // Calculate total for percentage
          params.forEach((param: any) => {
            total += param.value;
          });

          // Build tooltip content
          params.forEach((param: any) => {
            const value = param.value;
            const percentage =
              total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

            result += `<div style="display:flex;justify-content:space-between;gap:20px">
              <span style="color:${param.color}">${param.seriesName}:</span>
              <span>${formatValue(value)} (${percentage}%)</span>
            </div>`;
          });

          result += `<div style="margin-top:5px;border-top:1px solid #ccc;padding-top:5px">
            <span>Total: ${formatValue(total)}</span>
          </div>`;

          return result;
        },
      },
      legend: {
        data: ["Direct Trips", "Transfer Trips"],
        bottom: 0,
        textStyle: {
          color: legendColor,
        },
      },
      grid: {
        left: "5%",
        right: "5%",
        bottom: "15%",
        top: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: ["Regular", "Skip-Stop"],
        axisTick: { alignWithLabel: true },
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: "value",
        name: metricLabel,
        nameLocation: "middle",
        nameTextStyle: { color: textColor },
        nameGap: 50,
        axisLabel: {
          color: axisColor,
          formatter: (value: number) => {
            return selectedMetric === "PASSENGER_COUNT"
              ? value.toLocaleString()
              : (value / 60).toFixed(1);
          },
        },
        splitLine: { lineStyle: { color: isDarkMode ? "#444444" : "#EEEEEE" } },
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { lineStyle: { color: axisColor } },
      },
      series: [
        {
          name: "Direct Trips",
          type: "bar",
          stack: "total",
          emphasis: {
            focus: "series",
          },
          data: [stackedData.REGULAR.DIRECT, stackedData["SKIP-STOP"].DIRECT],
          itemStyle: {
            color: "#4CAF50", // Green for direct trips
          },
        },
        {
          name: "Transfer Trips",
          type: "bar",
          stack: "total",
          emphasis: {
            focus: "series",
          },
          data: [
            stackedData.REGULAR.TRANSFER,
            stackedData["SKIP-STOP"].TRANSFER,
          ],
          itemStyle: {
            color: "#FF5722", // Orange for transfer trips
          },
        },
      ],
    };

    return option;
  };

  return <ReactECharts option={getOption()} style={{ height, width }} />;
};
