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
import { useSimulationStore } from "@/store/simulationStore";
import {
  usePassengerDemandStore,
  SchemeType as PassengerDemandSchemeType,
} from "@/store/passengerDemandStore";
import { IconLoader2, IconInfoCircle } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PEAK_HOURS, FULL_DAY_HOURS } from "@/lib/constants";
import { parseTime } from "@/lib/timeUtils";

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
  value: [number, number, number]; // [originIndex, destinationIndex, metricValue]
  originName: string;
  destinationName: string;
}

// Metric types for the heatmap
type HeatmapMetricType = "PASSENGER_COUNT" | "WAIT_TIME" | "TRAVEL_TIME";

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
const getStationIndex = (stationId: string | number): number =>
  stationOrder.indexOf(String(stationId));
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
  selectedMetric: HeatmapMetricType;
  selectedScheme: PassengerDemandSchemeType;
}

export const PassengerHeatmapChart: React.FC<PassengerHeatmapChartProps> = ({
  height = "550px", // Adjusted height to make space for selectors
  width = "100%",
  selectedMetric,
  selectedScheme,
}) => {
  // --- State and Store Access ---
  const { selectedTimePeriod } = useSimulationStore(); // Time period from global store
  const {
    passengerDemand,
    isLoading: isDemandLoading,
    error: demandError,
  } = usePassengerDemandStore();

  // --- Data Processing ---
  const echartsHeatmapData = useMemo(() => {
    if (!passengerDemand || passengerDemand.length === 0 || isDemandLoading)
      return [];

    // 1. Filter by Scheme
    const schemeFilteredDemand = passengerDemand.filter(
      (entry) => entry.SCHEME_TYPE === selectedScheme
    );

    // 2. Filter by Time Period
    const timeFilteredDemand = schemeFilteredDemand.filter((entry) => {
      if (!entry.ARRIVAL_TIME_AT_ORIGIN) return false;
      const arrivalSeconds = parseTime(entry.ARRIVAL_TIME_AT_ORIGIN);

      if (selectedTimePeriod === "AM_PEAK") {
        return (
          arrivalSeconds >= parseTime(PEAK_HOURS.AM.start) &&
          arrivalSeconds <= parseTime(PEAK_HOURS.AM.end)
        );
      } else if (selectedTimePeriod === "PM_PEAK") {
        return (
          arrivalSeconds >= parseTime(PEAK_HOURS.PM.start) &&
          arrivalSeconds <= parseTime(PEAK_HOURS.PM.end)
        );
      }
      // FULL_SERVICE or any other case includes all
      return true;
    });

    // 3. Aggregate by OD pair based on selectedMetric
    const aggregatedData: Record<
      string, // OD_Pair_Key e.g., "1-2"
      { sum: number; count: number; entries: number[] }
    > = {};

    timeFilteredDemand.forEach((entry) => {
      const odKey = `${entry.ORIGIN_STATION_ID}-${entry.DESTINATION_STATION_ID}`;
      if (!aggregatedData[odKey]) {
        aggregatedData[odKey] = { sum: 0, count: 0, entries: [] };
      }

      if (selectedMetric === "PASSENGER_COUNT") {
        aggregatedData[odKey].sum += entry.PASSENGER_COUNT;
      } else if (selectedMetric === "WAIT_TIME") {
        aggregatedData[odKey].sum += entry.WAIT_TIME;
        aggregatedData[odKey].count += 1; // For averaging
        aggregatedData[odKey].entries.push(entry.WAIT_TIME);
      } else if (selectedMetric === "TRAVEL_TIME") {
        aggregatedData[odKey].sum += entry.TRAVEL_TIME;
        aggregatedData[odKey].count += 1; // For averaging
        aggregatedData[odKey].entries.push(entry.TRAVEL_TIME);
      }
    });

    // 4. Transform to ECharts format
    const transformedData: EchartsHeatmapDataItem[] = [];
    Object.keys(aggregatedData).forEach((odKey) => {
      const [originIdStr, destinationIdStr] = odKey.split("-");
      const originId = parseInt(originIdStr);
      const destinationId = parseInt(destinationIdStr);

      if (
        getStationIndex(originId) === -1 ||
        getStationIndex(destinationId) === -1 ||
        originId === destinationId
      ) {
        return; // Skip invalid or self-loops
      }

      let value: number;
      if (selectedMetric === "PASSENGER_COUNT") {
        value = aggregatedData[odKey].sum;
      } else {
        // Average for WAIT_TIME and TRAVEL_TIME, convert to minutes
        value =
          aggregatedData[odKey].count > 0
            ? aggregatedData[odKey].sum / aggregatedData[odKey].count / 60
            : 0;
      }

      if (value > 0) {
        // Only include pairs with data
        transformedData.push({
          value: [
            getStationIndex(originId),
            getStationIndex(destinationId),
            value,
          ],
          originName: stationNames[originIdStr] || `Station ${originIdStr}`,
          destinationName:
            stationNames[destinationIdStr] || `Station ${destinationIdStr}`,
        });
      }
    });
    return transformedData;
  }, [
    passengerDemand,
    selectedScheme,
    selectedTimePeriod,
    selectedMetric,
    isDemandLoading,
  ]);
  // --- End Data Processing ---

  // --- ECharts Rendering Logic ---
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
      const seriesLabelColor = isDarkMode ? "#000000" : "#000000"; // Adjusted for dark mode

      const yAxisLabels = stationOrder.map(
        (id) => stationNames[id] || `Station ${id}`
      );
      const xAxisLabels = stationOrder.map(
        (id) => stationNames[id] || `Station ${id}`
      );
      const processedData = echartsHeatmapData.map((item) => item.value);
      const metricValues = echartsHeatmapData.map((item) => item.value[2]);
      const minValue =
        metricValues.length > 0 ? Math.min(0, ...metricValues) : 0; // Ensure 0 is included if all values are positive
      const maxValue = metricValues.length > 0 ? Math.max(...metricValues) : 1; // Avoid 0 max

      let metricNameForTitle: string;
      let valueSuffix: string;
      let colorGradient: string[];

      switch (selectedMetric) {
        case "PASSENGER_COUNT":
          metricNameForTitle = "Passenger Count";
          valueSuffix = " passengers";
          colorGradient = [
            "#fee0d2", // Lightest Red
            "#fcbba1",
            "#fc9272",
            "#fb6a4a",
            "#de2d26", // Darkest Red
          ];
          break;
        case "WAIT_TIME":
          metricNameForTitle = "Average Wait Time";
          valueSuffix = " min";
          colorGradient = [
            "#eff3ff", // Lightest Blue
            "#bdd7e7",
            "#6baed6",
            "#3182bd",
            "#08519c", // Darkest Blue
          ];
          break;
        case "TRAVEL_TIME":
          metricNameForTitle = "Average Travel Time";
          valueSuffix = " min";
          colorGradient = [
            "#ffffcc", // Lightest Yellow
            "#ffeda0",
            "#fed976",
            "#feb24c",
            "#fd8d3c", // Darkest Yellow/Orange
          ];
          break;
        default:
          metricNameForTitle = "Data";
          valueSuffix = "";
          colorGradient = ["#fee0d2", "#fc9272", "#de2d26"];
      }

      const currentTitle = `O-D Heatmap: ${metricNameForTitle} (${selectedScheme}, ${selectedTimePeriod.replace(
        "_",
        " "
      )})`;

      const option = {
        title: {
          text: currentTitle,
          left: "center",
          top: 5,
          textStyle: { fontSize: 16, fontWeight: "bold", color: textColor },
        },
        tooltip: {
          position: "top",
          formatter: (params: any) => {
            const val = params.value;
            if (val && val.length === 3) {
              const originName = yAxisLabels[val[0]];
              const destinationName = xAxisLabels[val[1]];
              const count = val[2];
              return `${originName} to ${destinationName}<br />${metricNameForTitle}: ${count.toFixed(
                selectedMetric === "PASSENGER_COUNT" ? 0 : 2
              )}${valueSuffix}`;
            }
            return "";
          },
        },
        grid: {
          left: "50px",
          right: "50px",
          bottom: "80px", // Adjusted for visualMap
          top: "70px", // Adjusted for title and selectors
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
          min: minValue,
          max: maxValue,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: "10px",
          inRange: { color: colorGradient },
          textStyle: { fontSize: 10, color: textColor },
          formatter: (value: number) => {
            if (selectedMetric === "PASSENGER_COUNT") {
              return formatToK(value);
            }
            return value.toFixed(1) + valueSuffix.trim();
          },
        },
        series: [
          {
            name: metricNameForTitle,
            type: "heatmap",
            data: processedData,
            label: {
              show: true,
              formatter: (params: any) => {
                const value = params.value[2];
                if (selectedMetric === "PASSENGER_COUNT") {
                  return formatToK(value);
                } else {
                  return value.toFixed(1) + " min";
                }
              },
              fontSize: 9,
              color: seriesLabelColor,
            },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" },
            },
          },
        ],
      };
      chartInstance.setOption(option, true); // Add true for notMerge
      const resizeHandler = () => chartInstance.resize();
      window.addEventListener("resize", resizeHandler);
      return () => {
        window.removeEventListener("resize", resizeHandler);
        chartInstance.dispose();
      };
    } else if (chartRef.current) {
      const chartInstance = echarts.getInstanceByDom(chartRef.current);
      chartInstance?.clear();
    }
  }, [
    echartsHeatmapData,
    selectedMetric,
    selectedScheme,
    selectedTimePeriod,
    height,
    width,
  ]);
  // --- End ECharts Rendering Logic ---

  // --- Loading and No Data States ---
  if (isDemandLoading && echartsHeatmapData.length === 0) {
    // Show loader if demand is loading AND no data yet
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

  if (demandError) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height: height, width: width }}
      >
        <Alert variant="destructive" className="max-w-md">
          <IconInfoCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            Could not load passenger demand data: {demandError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const noDataForSelection =
    echartsHeatmapData.length === 0 && !isDemandLoading;

  if (noDataForSelection) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center p-4"
        style={{ minHeight: "300px", width: width }} // Ensure minimum height
      >
        <Alert className="max-w-md">
          <IconInfoCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            Passenger demand data is not available for the selected filters:
            <br />
            Time Period: {selectedTimePeriod.replace(/_/g, " ")}
            <br />
            Metric: {selectedMetric.replace("_", " ")}
            <br />
            Scheme: {selectedScheme}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  // --- End Loading and No Data States ---

  // --- Combined Render ---
  return (
    <div className="p-2" style={{ width: width, height: height }}>
      <div
        ref={chartRef}
        style={{ width: "100%", height: "100%" }} // Chart takes full height now
      />
    </div>
  );
  // --- End Combined Render ---
};
