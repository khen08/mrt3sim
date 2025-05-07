import React, { useMemo, useState, useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { HeatmapChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  useSimulationStore,
  TimePeriodFilter,
  AggregatedDemandEntry,
} from "@/store/simulationStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader2, IconInfoCircle } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Register ECharts components
echarts.use([
  HeatmapChart,
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  TitleComponent,
  CanvasRenderer,
]);

// Define the expected structure for ECharts heatmap data items
interface EchartsHeatmapDataItem {
  value: [number, number, number]; // [originIndex, destinationIndex, passengerCount]
  originName: string;
  destinationName: string;
}

// --- Station Data (Consider moving to a shared constants/config file if used elsewhere) ---
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
const getStationIndex = (stationId: string): number =>
  stationOrder.indexOf(stationId);
// --- End Station Data ---

// --- Helper Function ---
const formatToK = (value: number): string => {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1).replace(/\\.0$/, "") + "k";
  }
  return value.toString();
};
// --- End Helper Function ---

interface PassengerHeatmapChartProps {
  height?: string | number;
  width?: string | number;
}

export const PassengerHeatmapChart: React.FC<PassengerHeatmapChartProps> = ({
  height = "500px", // Default height increased slightly
  width = "100%",
}) => {
  // --- State and Store Access (from PassengerHeatmapTab) ---
  const {
    aggregatedPassengerDemand,
    selectedTimePeriod,
    setSelectedTimePeriod,
    isAggregatedDemandLoading,
    activeSimulationSettings,
  } = useSimulationStore();
  const currentScheme = activeSimulationSettings?.schemeType || "REGULAR";
  // --- End State and Store Access ---

  // --- Data Processing (from PassengerHeatmapTab) ---
  const echartsHeatmapData = useMemo(() => {
    if (!aggregatedPassengerDemand || isAggregatedDemandLoading) return [];
    const periodData = aggregatedPassengerDemand[selectedTimePeriod];
    if (!periodData) return [];
    const schemeData = periodData[currentScheme];
    if (!schemeData || schemeData.length === 0) return [];

    const transformedData: EchartsHeatmapDataItem[] = [];
    schemeData.forEach((entry: AggregatedDemandEntry) => {
      const [originId, destinationId] = entry.ROUTE.split("-");
      if (
        stationOrder.includes(originId) &&
        stationOrder.includes(destinationId) &&
        originId !== destinationId
      ) {
        transformedData.push({
          value: [
            getStationIndex(originId),
            getStationIndex(destinationId),
            entry.PASSENGER_COUNT,
          ],
          originName: stationNames[originId] || `Station ${originId}`,
          destinationName:
            stationNames[destinationId] || `Station ${destinationId}`,
        });
      }
    });
    return transformedData;
  }, [
    aggregatedPassengerDemand,
    selectedTimePeriod,
    currentScheme,
    isAggregatedDemandLoading,
  ]);
  // --- End Data Processing ---

  // --- Event Handlers (from PassengerHeatmapTab) ---
  const handleTimePeriodChange = (value: string) => {
    setSelectedTimePeriod(value as TimePeriodFilter);
  };
  // --- End Event Handlers ---

  // --- ECharts Rendering Logic (from PassengerHeatmap) ---
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chartRef.current && echartsHeatmapData.length > 0) {
      const chartInstance = echarts.init(chartRef.current, null, {
        renderer: "canvas",
      });
      const isDarkMode =
        typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark");
      const textColor = isDarkMode ? "#FFFFFF" : "#333333";
      const seriesLabelColor = "#000000";

      const yAxisLabels = stationOrder.map(
        (id) => stationNames[id] || `Station ${id}`
      );
      const xAxisLabels = stationOrder.map(
        (id) => stationNames[id] || `Station ${id}`
      );
      const processedData = echartsHeatmapData.map((item) => item.value);
      const passengerCounts = echartsHeatmapData.map((item) => item.value[2]);
      const minValue =
        passengerCounts.length > 0 ? Math.min(...passengerCounts) : 0;
      const maxValue =
        passengerCounts.length > 0 ? Math.max(...passengerCounts) : 1; // Avoid 0 max

      const option = {
        title: {
          text: "O-D Passenger Heatmap",
          left: "center",
          top: 0, // Move title slightly down
          textStyle: { fontSize: 16, fontWeight: "bold", color: textColor },
        },
        tooltip: {
          position: "top",
          formatter: (params: any) => {
            // Find the original data item based on index if possible
            // Note: params.dataIndex might not be reliable if data is sparse/filtered
            // A safer approach might be needed if exact origin/dest names are required
            const val = params.value; // val is [originIndex, destinationIndex, count]
            if (val && val.length === 3) {
              const originName = yAxisLabels[val[0]];
              const destinationName = xAxisLabels[val[1]];
              const count = val[2];
              return `${originName} to ${destinationName}<br />Passengers: ${count.toLocaleString()}`;
            }
            return "";
          },
        },
        grid: {
          left: "50px",
          right: "50px",
          bottom: "80px",
          top: "60px",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: xAxisLabels,
          splitArea: { show: true },
          axisLabel: {
            rotate: 45,
            interval: 0,
            fontSize: 10,
            color: textColor,
          },
        },
        yAxis: {
          type: "category",
          data: yAxisLabels,
          splitArea: { show: true },
          axisLabel: { interval: 0, fontSize: 10, color: textColor },
        },
        visualMap: {
          min: minValue > 0 ? 0 : minValue,
          max: maxValue,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: "10px",
          inRange: { color: ["#fee0d2", "#fc9272", "#de2d26"] }, // Red gradient
          textStyle: { fontSize: 10, color: textColor },
        },
        series: [
          {
            name: "Passenger Demand",
            type: "heatmap",
            data: processedData,
            label: {
              show: true,
              formatter: (params: any) => formatToK(params.value[2]),
              fontSize: 9,
              color: seriesLabelColor,
            },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" },
            },
          },
        ],
      };
      chartInstance.setOption(option);
      const resizeHandler = () => chartInstance.resize();
      window.addEventListener("resize", resizeHandler);
      return () => {
        window.removeEventListener("resize", resizeHandler);
        chartInstance.dispose();
      };
    } else if (chartRef.current) {
      // If data becomes empty, clear the chart
      const chartInstance = echarts.getInstanceByDom(chartRef.current);
      chartInstance?.clear();
    }
  }, [echartsHeatmapData, selectedTimePeriod, currentScheme, height, width]); // Re-run effect when data or options change
  // --- End ECharts Rendering Logic ---

  // --- Loading and No Data States (from PassengerHeatmapTab) ---
  if (isAggregatedDemandLoading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: height, width: width }}
      >
        <IconLoader2 className="h-12 w-12 animate-spin text-mrt-blue" />
        <p className="ml-4 text-lg">Loading Heatmap Data...</p>
      </div>
    );
  }

  // Check specifically if data *for the selected period/scheme* is empty
  const noDataForSelection = useMemo(() => {
    if (!aggregatedPassengerDemand) return true;
    const periodData = aggregatedPassengerDemand[selectedTimePeriod];
    if (!periodData) return true;
    const schemeData = periodData[currentScheme];
    return !schemeData || schemeData.length === 0;
  }, [aggregatedPassengerDemand, selectedTimePeriod, currentScheme]);

  if (noDataForSelection) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height: height, width: width }}
      >
        <Alert className="max-w-md">
          <IconInfoCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            Aggregated passenger demand data is not available for the selected
            time period ({selectedTimePeriod.replace(/_/g, " ")}) and scheme (
            {currentScheme}).
          </AlertDescription>
        </Alert>
        {/* Keep selector visible */}
        <div className="mt-4">
          <label
            htmlFor="time-period-select-nodata"
            className="text-sm font-medium mr-2"
          >
            Time Period:
          </label>
          <Select
            onValueChange={handleTimePeriodChange}
            defaultValue={selectedTimePeriod}
          >
            <SelectTrigger id="time-period-select-nodata" className="w-[180px]">
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
    );
  }
  // --- End Loading and No Data States ---

  // --- Combined Render ---
  return (
    <div className="w-full" style={{ height: height }}>
      {/* Selector */}
      <div className="mb-4 flex justify-start">
        <div className="flex items-center">
          <label
            htmlFor="time-period-select-chart"
            className="text-sm font-medium mr-2"
          >
            Time Period:
          </label>
          <Select
            onValueChange={handleTimePeriodChange}
            defaultValue={selectedTimePeriod}
          >
            <SelectTrigger id="time-period-select-chart" className="w-[180px]">
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
      {/* Chart Area */}
      <div
        ref={chartRef}
        style={{
          width: width,
          height: `calc(${
            typeof height === "string" ? height : height + "px"
          } - 40px)` /* Adjust height to account for selector */,
        }}
      />
    </div>
  );
  // --- End Combined Render ---
};
