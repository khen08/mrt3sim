import React from "react";
import ReactECharts from "echarts-for-react";
import {
  useMetricsStore,
  useCurrentProcessedMetrics,
} from "@/store/metricsStore";

interface ComparativeBarChartProps {
  title?: string;
  height?: number | string;
  width?: number | string;
}

export const ComparativeBarChart: React.FC<ComparativeBarChartProps> = ({
  title = "Scheme Comparison",
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

  // Extract average metrics for chart
  const metrics = [
    "Average Travel Time per Passenger",
    "Average Wait Time per Passenger",
    "Average Total Journey Time per Passenger",
  ];

  const regularData = metrics.map(
    (metric) => processedMetrics.averageMetrics[metric]?.REGULAR || 0
  );

  const skipStopData = metrics.map(
    (metric) => processedMetrics.averageMetrics[metric]?.["SKIP-STOP"] || 0
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
      text: "Scheme Performance",
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
        const dataIndex = params[0].dataIndex;
        const metricName = metrics[dataIndex];
        let result = `<div>${metricName}</div>`;

        params.forEach((param: any) => {
          result += `<div style="display:flex;justify-content:space-between;gap:20px">
            <span style="font-weight:bold;color:${param.color}">${
            param.seriesName
          }:</span>
            <span>${param.value.toFixed(2)} seconds</span>
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
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: ["Travel Time", "Wait Time", "Total Journey Time"],
      axisLabel: {
        color: axisColor,
        rotate: 0,
        interval: 0,
      },
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
        name: "Regular",
        type: "bar",
        data: regularData,
        itemStyle: {
          color: "#0066CC",
        },
      },
      {
        name: "Skip-Stop",
        type: "bar",
        data: skipStopData,
        itemStyle: {
          color: "#9E2B25",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height, width }} />;
};
