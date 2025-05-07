import React, { useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  usePassengerDemandStore,
  PassengerDemandEntry,
} from "@/store/passengerDemandStore";

type MetricType = "WAIT_TIME" | "TRAVEL_TIME";
type BreakdownType = "SCHEME_TYPE" | "TRIP_TYPE";

interface TimeDistributionBoxPlotProps {
  height?: number | string;
  width?: number | string;
  selectedMetric: MetricType;
  onMetricChange: (value: MetricType) => void;
  breakdownBy: BreakdownType;
  onBreakdownChange: (value: BreakdownType) => void;
}

export const TimeDistributionBoxPlot: React.FC<
  TimeDistributionBoxPlotProps
> = ({
  height = "400px",
  width = "100%",
  selectedMetric,
  onMetricChange,
  breakdownBy,
  onBreakdownChange,
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

  // Process data for box plot
  const prepareBoxPlotData = () => {
    console.log(
      "Preparing box plot data from",
      passengerDemand.length,
      "entries"
    );

    // Verify we have entries with proper data
    if (passengerDemand.length > 0) {
      console.log("Sample entry:", passengerDemand[0]);
    }

    const result: Record<string, number[]> = {};

    if (breakdownBy === "SCHEME_TYPE") {
      result["REGULAR"] = [];
      result["SKIP-STOP"] = [];

      passengerDemand.forEach((entry: PassengerDemandEntry) => {
        // Skip invalid entries
        if (!entry.SCHEME_TYPE || !entry[selectedMetric]) {
          return;
        }

        const scheme = entry.SCHEME_TYPE;
        const value = entry[selectedMetric];

        if (
          typeof value === "number" &&
          (scheme === "REGULAR" || scheme === "SKIP-STOP")
        ) {
          result[scheme].push(value / 60); // Convert to minutes
        }
      });
    } else if (breakdownBy === "TRIP_TYPE") {
      result["DIRECT"] = [];
      result["TRANSFER"] = [];

      passengerDemand.forEach((entry: PassengerDemandEntry) => {
        // Skip invalid entries
        if (!entry.TRIP_TYPE || !entry[selectedMetric]) {
          return;
        }

        const tripType = entry.TRIP_TYPE;
        const value = entry[selectedMetric];

        if (
          typeof value === "number" &&
          (tripType === "DIRECT" || tripType === "TRANSFER")
        ) {
          result[tripType].push(value / 60); // Convert to minutes
        }
      });
    }

    // Sort data for accurate box plot calculations
    Object.keys(result).forEach((key) => {
      result[key].sort((a, b) => a - b);
    });

    // Log the results
    Object.keys(result).forEach((key) => {
      console.log(`${key} data points: ${result[key].length}`);
    });

    return result;
  };

  const calculateBoxPlotData = (values: number[]) => {
    if (values.length === 0) return [0, 0, 0, 0, 0];

    // Calculate min, max, median, Q1, Q3
    const min = values[0];
    const max = values[values.length - 1];

    const medianIndex = Math.floor(values.length / 2);
    const median =
      values.length % 2 === 0
        ? (values[medianIndex - 1] + values[medianIndex]) / 2
        : values[medianIndex];

    const q1Index = Math.floor(values.length / 4);
    const q1 =
      values.length % 4 === 0
        ? (values[q1Index - 1] + values[q1Index]) / 2
        : values[q1Index];

    const q3Index = Math.floor((values.length * 3) / 4);
    const q3 =
      values.length % 4 === 0
        ? (values[q3Index - 1] + values[q3Index]) / 2
        : values[q3Index];

    return [min, q1, median, q3, max];
  };

  const boxPlotData = prepareBoxPlotData();

  const getOption = () => {
    const categories = Object.keys(boxPlotData);
    const boxPlotValues = categories.map((cat) =>
      calculateBoxPlotData(boxPlotData[cat])
    );

    // Dynamic text color based on theme
    const isDarkMode =
      typeof window !== "undefined" &&
      document.documentElement.classList.contains("dark");
    const textColor = isDarkMode ? "#E0E0E0" : "#333333"; // Light gray for dark mode
    const axisColor = isDarkMode ? "#AAAAAA" : "#666666";

    const option = {
      title: {
        text: `Time Distribution (Box Plot)`,
        left: "center",
        textStyle: {
          color: textColor,
          fontSize: 16,
        },
      },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const data = params.data;
          return `
            <div>${params.name}</div>
            <div>Min: ${data[0].toFixed(2)}min</div>
            <div>Q1: ${data[1].toFixed(2)}min</div>
            <div>Median: ${data[2].toFixed(2)}min</div>
            <div>Q3: ${data[3].toFixed(2)}min</div>
            <div>Max: ${data[4].toFixed(2)}min</div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLabel: {
          color: axisColor,
          interval: 0,
        },
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: "value",
        name: "Minutes",
        nameTextStyle: { color: textColor },
        nameLocation: "middle",
        nameGap: 40,
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: isDarkMode ? "#444444" : "#EEEEEE" } },
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { lineStyle: { color: axisColor } },
      },
      grid: {
        left: "10%",
        right: "10%",
        bottom: "15%",
        top: "15%",
      },
      series: [
        {
          name: selectedMetric === "WAIT_TIME" ? "Wait Time" : "Travel Time",
          type: "boxplot",
          data: boxPlotValues,
          itemStyle: {
            color: (params: any) => {
              const colors = ["#0066CC", "#9E2B25", "#00CC66", "#CC6600"];
              return colors[params.dataIndex % colors.length];
            },
          },
        },
      ],
    };

    return option;
  };

  return <ReactECharts option={getOption()} style={{ height, width }} />;
};
