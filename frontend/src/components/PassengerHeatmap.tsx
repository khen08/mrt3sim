import React, { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { HeatmapChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Register ECharts components
echarts.use([
  HeatmapChart,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  TitleComponent,
  CanvasRenderer,
]);

interface HeatmapDataItem {
  // ECharts expects data typically in [xIndex, yIndex, value] format
  // Or it can be [{ value: [xIndex, yIndex, actualValue] }]
  // For simplicity, we'll pass transformed data directly
  value: [number, number, number]; // [originIndex, destinationIndex, passengerCount]
  originName: string;
  destinationName: string;
}

interface EchartsPassengerHeatmapProps {
  data: HeatmapDataItem[];
  stationOrder: string[]; // Array of station IDs, e.g., ["1", "2", ..., "13"]
  stationNames: { [key: string]: string }; // Mapping from station ID to name
  title?: string;
  height?: string | number;
}

const formatToK = (value: number): string => {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1).replace(/\\.0$/, "") + "k";
  }
  return value.toString();
};

const PassengerHeatmap: React.FC<EchartsPassengerHeatmapProps> = ({
  data,
  stationOrder,
  stationNames,
  title = "Passenger Demand Heatmap (Origin-Destination)",
  height = "400px",
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current && data.length > 0) {
      const chartInstance = echarts.init(chartRef.current, null, {
        renderer: "canvas",
      });

      // Determine text color based on dark mode
      const isDarkMode =
        typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark");
      const textColor = isDarkMode ? "#FFFFFF" : "#333333"; // Default dark text color
      const seriesLabelColor = "#000000"; // Always black for datapoints

      const yAxisLabels = stationOrder.map(
        (id) => stationNames[id] || `Station ${id}`
      ); // Origin stations
      const xAxisLabels = stationOrder.map(
        (id) => stationNames[id] || `Station ${id}`
      ); // Destination stations

      const processedData = data.map((item) => item.value);
      const passengerCounts = data.map((item) => item.value[2]);
      const minValue = Math.min(...passengerCounts);
      const maxValue = Math.max(...passengerCounts);

      const option = {
        title: {
          text: title,
          left: "center",
          textStyle: {
            fontSize: 16,
            fontWeight: "bold",
            color: textColor, // Apply dynamic text color
          },
        },
        tooltip: {
          position: "top",
          formatter: (params: any) => {
            const item = data[params.dataIndex];
            if (item) {
              return `${item.originName} to ${
                item.destinationName
              }<br />Passengers: ${item.value[2].toLocaleString()}`;
            }
            return "";
          },
        },
        grid: {
          left: "50px", // Decreased to shift chart left
          right: "50px",
          bottom: "80px", // Increased for x-axis labels
          top: "60px", // For title
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: xAxisLabels,
          splitArea: {
            show: true,
          },
          axisLabel: {
            rotate: 45, // Rotate labels for better readability
            interval: 0, // Show all labels
            fontSize: 10,
            color: textColor, // Apply dynamic text color
          },
        },
        yAxis: {
          type: "category",
          data: yAxisLabels,
          splitArea: {
            show: true,
          },
          axisLabel: {
            interval: 0, // Show all labels
            fontSize: 10,
            color: textColor, // Apply dynamic text color
          },
        },
        visualMap: {
          min: minValue > 0 ? 0 : minValue, // Start from 0 if all values are positive
          max: maxValue,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: "10px",
          inRange: {
            color: ["#fee0d2", "#fc9272", "#de2d26"], // Shades of red: light to dark
          },
          textStyle: {
            fontSize: 10,
            color: textColor, // Apply dynamic text color
          },
        },
        series: [
          {
            name: "Passenger Demand",
            type: "heatmap",
            data: processedData,
            label: {
              show: true,
              formatter: (params: any) => {
                return formatToK(params.value[2]);
              },
              fontSize: 9,
              color: seriesLabelColor, // Always black
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

      chartInstance.setOption(option);

      // Handle chart resizing
      const resizeHandler = () => {
        chartInstance.resize();
      };
      window.addEventListener("resize", resizeHandler);

      return () => {
        window.removeEventListener("resize", resizeHandler);
        chartInstance.dispose();
      };
    }
  }, [data, stationOrder, stationNames, title, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground">
          No heatmap data available to display.
        </p>
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: "100%", height: height }} />;
};

export default PassengerHeatmap;
