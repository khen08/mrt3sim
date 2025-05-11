import React from "react";
import ReactECharts from "echarts-for-react";
import {
  useMetricsStore,
  useCurrentProcessedMetrics,
} from "@/store/metricsStore";

interface JourneyTimeStackedBarProps {
  title?: string;
  height?: number | string;
  width?: number | string;
}

export const JourneyTimeStackedBar: React.FC<JourneyTimeStackedBarProps> = ({
  title = "Journey Time Composition",
  height = "400px",
  width = "100%",
}) => {
  const isLoading = useMetricsStore((state) => state.isLoading);
  const processedMetrics = useCurrentProcessedMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!processedMetrics) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No metrics data available
      </div>
    );
  }

  // Extract data for the stacked bar chart
  const schemes = ["REGULAR", "SKIP-STOP"] as const;

  const travelTimes = schemes.map(
    (scheme) =>
      processedMetrics.averageMetrics["Average Travel Time per Passenger"]?.[
        scheme
      ] || 0
  );

  const waitTimes = schemes.map(
    (scheme) =>
      processedMetrics.averageMetrics["Average Wait Time per Passenger"]?.[
        scheme
      ] || 0
  );

  // Dynamic text color based on theme
  const isDarkMode =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const textColor = isDarkMode ? "#E0E0E0" : "#333333";
  const axisColor = isDarkMode ? "#AAAAAA" : "#666666";
  const legendColor = isDarkMode ? "#CCCCCC" : "#555555";

  const option = {
    title: {
      text: title || "Journey Time Composition",
      left: "center",
      textStyle: {
        color: textColor,
        fontSize: 16,
      },
    },
    backgroundColor: isDarkMode ? "#000000" : "#ffffff",
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: (params: any) => {
        const schemeName = params[0].name;
        let result = `<div>${schemeName}</div>`;
        let total = 0;

        params.forEach((param: any) => {
          total += param.value;
          result += `<div style="display:flex;justify-content:space-between;gap:20px">
            <span style="font-weight:bold;color:${param.color}">${
            param.seriesName
          }:</span>
            <span>${param.value.toFixed(2)} seconds</span>
          </div>`;
        });

        result += `<div style="display:flex;justify-content:space-between;gap:20px;margin-top:8px;font-weight:bold">
          <span>Total:</span>
          <span>${total.toFixed(2)} seconds</span>
        </div>`;

        return result;
      },
    },
    legend: {
      data: ["Travel Time", "Wait Time"],
      bottom: 0,
      textStyle: {
        color: legendColor,
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: ["Regular", "Skip-Stop"],
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { lineStyle: { color: axisColor } },
    },
    yAxis: {
      type: "value",
      name: "Seconds",
      nameTextStyle: { color: textColor },
      nameLocation: "middle",
      nameGap: 40,
      axisLabel: { color: axisColor },
      splitLine: { lineStyle: { color: isDarkMode ? "#444444" : "#EEEEEE" } },
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { lineStyle: { color: axisColor } },
    },
    series: [
      {
        name: "Travel Time",
        type: "bar",
        stack: "total",
        emphasis: { focus: "series" },
        data: travelTimes,
        itemStyle: {
          color: "#4C9AFF",
        },
      },
      {
        name: "Wait Time",
        type: "bar",
        stack: "total",
        emphasis: { focus: "series" },
        data: waitTimes,
        itemStyle: {
          color: "#FF8F73",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height, width }} />;
};
