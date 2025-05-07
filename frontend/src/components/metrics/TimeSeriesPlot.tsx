import React, { useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  usePassengerDemandStore,
  PassengerDemandEntry,
} from "@/store/passengerDemandStore";

type MetricType = "PASSENGER_COUNT" | "WAIT_TIME" | "TRAVEL_TIME";

interface TimeSeriesPlotProps {
  height?: number | string;
  width?: number | string;
  selectedMetric: MetricType;
  onMetricChange: (value: MetricType) => void;
}

export const TimeSeriesPlot: React.FC<TimeSeriesPlotProps> = ({
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

  // Process data for time series
  const prepareTimeSeriesData = () => {
    console.log(
      "Preparing time series data from",
      passengerDemand.length,
      "entries"
    );

    // Verify we have entries with proper data
    if (passengerDemand.length > 0) {
      console.log("Sample entry:", passengerDemand[0]);
    }

    // Group data by hour and scheme
    const hourlyData: Record<
      string,
      Record<string, { sum: number; count: number }>
    > = {};

    passengerDemand.forEach((entry: PassengerDemandEntry) => {
      // Skip entries without arrival time or scheme
      if (!entry.ARRIVAL_TIME_AT_ORIGIN || !entry.SCHEME_TYPE) {
        console.warn(
          "Skipping entry with missing arrival time or scheme type:",
          entry
        );
        return;
      }

      // Parse arrival time
      let arrivalTime;
      try {
        // Handle time-only strings (like "22:02:00") by adding a base date
        const timeStr = entry.ARRIVAL_TIME_AT_ORIGIN;

        // Handle different time formats
        if (timeStr.includes("T") || timeStr.includes("-")) {
          // This is likely a full ISO date string like "2023-05-20T22:02:00"
          arrivalTime = new Date(timeStr);
        } else if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
          // Time-only format like "22:02:00" - add today's date
          const [hours, minutes, seconds] = timeStr.split(":").map(Number);
          arrivalTime = new Date();
          arrivalTime.setHours(hours, minutes, seconds, 0);
        } else {
          // Try to parse as-is as fallback
          arrivalTime = new Date(timeStr);
        }

        // Check if date is valid
        if (isNaN(arrivalTime.getTime())) {
          console.warn("Invalid arrival time:", entry.ARRIVAL_TIME_AT_ORIGIN);
          return;
        }
      } catch (e) {
        console.warn(
          "Error parsing arrival time:",
          entry.ARRIVAL_TIME_AT_ORIGIN,
          e
        );
        return;
      }

      const hour = arrivalTime.getHours().toString().padStart(2, "0") + ":00";
      const scheme = entry.SCHEME_TYPE;

      // Initialize the hour object if it doesn't exist
      if (!hourlyData[hour]) {
        hourlyData[hour] = {};
      }

      // Initialize the scheme data if it doesn't exist for this hour
      if (!hourlyData[hour][scheme]) {
        hourlyData[hour][scheme] = { sum: 0, count: 0 };
      }

      if (selectedMetric === "PASSENGER_COUNT") {
        hourlyData[hour][scheme].sum += entry.PASSENGER_COUNT || 0;
        hourlyData[hour][scheme].count += 1;
      } else {
        const value = entry[selectedMetric];
        if (typeof value === "number") {
          hourlyData[hour][scheme].sum += value;
          hourlyData[hour][scheme].count += 1;
        }
      }
    });

    // Log the hourly data for debugging
    console.log("Hourly data:", hourlyData);

    // Convert to arrays sorted by hour
    const hours = Object.keys(hourlyData).sort();

    const regularData = hours.map((hour) => {
      // Safely access the data with fallbacks
      const hourData = hourlyData[hour]["REGULAR"] || { sum: 0, count: 0 };
      if (selectedMetric === "PASSENGER_COUNT") {
        return hourData.sum;
      } else {
        return hourData.count > 0 ? hourData.sum / hourData.count / 60 : 0;
      }
    });

    const skipStopData = hours.map((hour) => {
      // Safely access the data with fallbacks
      const hourData = hourlyData[hour]["SKIP-STOP"] || { sum: 0, count: 0 };
      if (selectedMetric === "PASSENGER_COUNT") {
        return hourData.sum;
      } else {
        return hourData.count > 0 ? hourData.sum / hourData.count / 60 : 0;
      }
    });

    // Log the processed data for debugging
    console.log("Hours:", hours);
    console.log("Regular data:", regularData);
    console.log("Skip-stop data:", skipStopData);

    return { hours, regularData, skipStopData };
  };

  const { hours, regularData, skipStopData } = prepareTimeSeriesData();

  // Dynamic text color based on theme
  const isDarkMode =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const textColor = isDarkMode ? "#E0E0E0" : "#333333";
  const axisColor = isDarkMode ? "#AAAAAA" : "#666666";
  const legendColor = isDarkMode ? "#CCCCCC" : "#555555";

  const getOption = () => {
    const option = {
      title: {
        text: "Time Series Analysis",
        left: "center",
        textStyle: {
          color: textColor,
          fontSize: 16,
        },
      },
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          let result = `<div>${params[0].axisValue}</div>`;

          params.forEach((param: any) => {
            const value =
              selectedMetric === "PASSENGER_COUNT"
                ? param.value.toLocaleString()
                : param.value.toFixed(2) + "min";

            result += `<div style="display:flex;justify-content:space-between;gap:20px">
              <span style="font-weight:bold;color:${param.color}">${param.seriesName}:</span>
              <span>${value}</span>
            </div>`;
          });

          return result;
        },
      },
      legend: {
        data: ["Regular", "Skip-Stop"],
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
        data: hours,
        name: "Hour of Day",
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: { color: textColor },
        axisLabel: {
          color: axisColor,
          interval: Math.max(0, Math.ceil(hours.length / 12) - 1), // Show fewer labels if many hours
          rotate: 45,
        },
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: "value",
        name:
          selectedMetric === "PASSENGER_COUNT"
            ? "Passenger Count"
            : "Time (minutes)",
        nameLocation: "middle",
        nameTextStyle: { color: textColor },
        nameGap: 50,
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: isDarkMode ? "#444444" : "#EEEEEE" } },
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { lineStyle: { color: axisColor } },
      },
      series: [
        {
          name: "Regular",
          type: "line",
          data: regularData,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: {
            width: 3,
          },
          itemStyle: {
            color: "#0066CC",
          },
        },
        {
          name: "Skip-Stop",
          type: "line",
          data: skipStopData,
          symbol: "triangle",
          symbolSize: 8,
          lineStyle: {
            width: 3,
          },
          itemStyle: {
            color: "#9E2B25",
          },
        },
      ],
    };

    return option;
  };

  return <ReactECharts option={getOption()} style={{ height, width }} />;
};
