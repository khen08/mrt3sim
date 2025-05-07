import React from "react";
import ReactECharts from "echarts-for-react";
import { useMetricsStore } from "@/store/metricsStore";

interface PassengerCountsChartProps {
  title?: string;
  height?: number | string;
}

export const PassengerCountsChart: React.FC<PassengerCountsChartProps> = ({
  title = "Total Passengers Who Completed Their Journey by Scheme",
  height = "400px",
}) => {
  const { processedMetrics, isLoading } = useMetricsStore();

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

  // Extract passenger counts
  const regularCount =
    processedMetrics.basicMetrics["Total Passengers"]?.REGULAR || 0;
  const skipStopCount =
    processedMetrics.basicMetrics["Total Passengers"]?.["SKIP-STOP"] || 0;

  const option = {
    title: {
      text: title,
      left: "center",
      textStyle: {
        fontSize: 16,
      },
      subtext:
        "Represents passengers who successfully completed their journeys",
      subtextStyle: {
        fontSize: 12,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: (params: any) => {
        return `${
          params[0].name
        }: ${params[0].value.toLocaleString()} passengers`;
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "25%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: ["Regular", "Skip-Stop"],
      axisLabel: {
        interval: 0,
      },
    },
    yAxis: {
      type: "value",
      name: "Passenger Count",
      nameLocation: "middle",
      nameGap: 60,
    },
    series: [
      {
        type: "bar",
        data: [
          {
            value: regularCount,
            itemStyle: { color: "#0066CC" },
          },
          {
            value: skipStopCount,
            itemStyle: { color: "#9E2B25" },
          },
        ],
        label: {
          show: true,
          position: "top",
          formatter: "{c}",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height }} />;
};
