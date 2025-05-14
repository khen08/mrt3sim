import React, { useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  useMetricsStore,
  useCurrentProcessedMetrics,
} from "@/store/metricsStore";
import {
  usePassengerDemandStore,
  PassengerDemandEntry,
} from "@/store/passengerDemandStore";
import { useSimulationStore } from "@/store/simulationStore";
import DataInterpretation from "./DataInterpretation";

interface PassengerCountsChartProps {
  title?: string;
  height?: number | string;
  width?: number | string;
}

export const PassengerCountsChart: React.FC<PassengerCountsChartProps> = ({
  title = "Passenger Throughput by Completion Time",
  height = "400px",
  width = "100%",
}) => {
  const isLoading = useMetricsStore((state) => state.isLoading);
  const { passengerDemand, isLoading: isDemandLoading } =
    usePassengerDemandStore();
  const isFullDayView = useSimulationStore((state) => state.isFullDayView);

  // Add state for granularity
  const [granularity, setGranularity] = useState<"15min" | "30min" | "hourly">(
    "15min"
  );

  if (isLoading || isDemandLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
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

  // Get time slot string based on granularity
  const getTimeSlot = (date: Date, granularity: string): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes();

    if (granularity === "hourly") {
      return `${hours}:00`;
    } else if (granularity === "30min") {
      const minuteStr = minutes < 30 ? "00" : "30";
      return `${hours}:${minuteStr}`;
    } else {
      // 15min
      let minuteStr = "00";
      if (minutes >= 15 && minutes < 30) minuteStr = "15";
      else if (minutes >= 30 && minutes < 45) minuteStr = "30";
      else if (minutes >= 45) minuteStr = "45";
      return `${hours}:${minuteStr}`;
    }
  };

  // Process data for completed passenger journeys
  const prepareCompletionData = () => {
    // Group data by completion time and scheme
    const completionData: Record<
      string,
      Record<
        string,
        { sum: number; count: number; transferSum: number; directSum: number }
      >
    > = {};

    passengerDemand.forEach((entry: PassengerDemandEntry) => {
      // Skip entries without arrival time or scheme
      if (!entry.ARRIVAL_TIME_AT_ORIGIN || !entry.SCHEME_TYPE) {
        return;
      }

      // Parse origin arrival time
      let originTime;
      try {
        const timeStr = entry.ARRIVAL_TIME_AT_ORIGIN;

        // Handle different time formats
        if (timeStr.includes("T") || timeStr.includes("-")) {
          // Full ISO date string
          originTime = new Date(timeStr);
        } else if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
          // Time-only format
          const [hours, minutes, seconds] = timeStr.split(":").map(Number);
          originTime = new Date();
          originTime.setHours(hours, minutes, seconds, 0);
        } else {
          // Fallback
          originTime = new Date(timeStr);
        }

        // Check if date is valid
        if (isNaN(originTime.getTime())) {
          return;
        }
      } catch (e) {
        return;
      }

      // Calculate completion time by adding travel time to origin time
      const completionTime = new Date(
        originTime.getTime() + entry.TRAVEL_TIME * 1000
      );

      // Get time slot based on granularity
      const timeSlot = getTimeSlot(completionTime, granularity);
      const scheme = entry.SCHEME_TYPE;
      const isTransfer = entry.TRIP_TYPE === "TRANSFER";

      // Initialize the time slot object if it doesn't exist
      if (!completionData[timeSlot]) {
        completionData[timeSlot] = {};
      }

      // Initialize the scheme data if it doesn't exist for this time slot
      if (!completionData[timeSlot][scheme]) {
        completionData[timeSlot][scheme] = {
          sum: 0,
          count: 0,
          transferSum: 0,
          directSum: 0,
        };
      }

      // Track transfer and direct trips separately
      if (isTransfer) {
        completionData[timeSlot][scheme].transferSum +=
          entry.PASSENGER_COUNT || 0;
      } else {
        completionData[timeSlot][scheme].directSum +=
          entry.PASSENGER_COUNT || 0;
      }

      completionData[timeSlot][scheme].sum += entry.PASSENGER_COUNT || 0;
      completionData[timeSlot][scheme].count += 1;
    });

    // Convert to arrays sorted by time slot
    const timeSlots = Object.keys(completionData).sort();

    const regularData = timeSlots.map((slot) => {
      const slotData = completionData[slot]["REGULAR"] || {
        sum: 0,
        count: 0,
        transferSum: 0,
        directSum: 0,
      };
      return slotData.sum;
    });

    const skipStopData = timeSlots.map((slot) => {
      const slotData = completionData[slot]["SKIP-STOP"] || {
        sum: 0,
        count: 0,
        transferSum: 0,
        directSum: 0,
      };
      return slotData.sum;
    });

    const regularDirectData = timeSlots.map((slot) => {
      const slotData = completionData[slot]["REGULAR"] || {
        sum: 0,
        count: 0,
        transferSum: 0,
        directSum: 0,
      };
      return slotData.directSum;
    });

    const regularTransferData = timeSlots.map((slot) => {
      const slotData = completionData[slot]["REGULAR"] || {
        sum: 0,
        count: 0,
        transferSum: 0,
        directSum: 0,
      };
      return slotData.transferSum;
    });

    const skipStopDirectData = timeSlots.map((slot) => {
      const slotData = completionData[slot]["SKIP-STOP"] || {
        sum: 0,
        count: 0,
        transferSum: 0,
        directSum: 0,
      };
      return slotData.directSum;
    });

    const skipStopTransferData = timeSlots.map((slot) => {
      const slotData = completionData[slot]["SKIP-STOP"] || {
        sum: 0,
        count: 0,
        transferSum: 0,
        directSum: 0,
      };
      return slotData.transferSum;
    });

    return {
      timeSlots,
      regularData,
      skipStopData,
      regularDirectData,
      regularTransferData,
      skipStopDirectData,
      skipStopTransferData,
    };
  };

  const {
    timeSlots,
    regularData,
    skipStopData,
    regularDirectData,
    regularTransferData,
    skipStopDirectData,
    skipStopTransferData,
  } = prepareCompletionData();

  // Determine if this is a full day view based on data
  const uniqueTimeSlots = timeSlots.length;
  // More time slots are needed for 15min granularity to count as full day
  const minSlotsForFullDay =
    granularity === "15min" ? 48 : granularity === "30min" ? 24 : 12;
  const autoFullDayView = uniqueTimeSlots >= minSlotsForFullDay;

  // Dynamic text color based on theme
  const isDarkMode =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const textColor = isDarkMode ? "#E0E0E0" : "#333333";
  const axisColor = isDarkMode ? "#AAAAAA" : "#666666";
  const legendColor = isDarkMode ? "#CCCCCC" : "#555555";

  // Get AM and PM peak time slots based on granularity
  const getFilteredPeakTimeSlots = () => {
    let amPeakSlots: string[] = [];
    let pmPeakSlots: string[] = [];

    if (granularity === "hourly") {
      amPeakSlots = ["07:00", "08:00", "09:00"];
      pmPeakSlots = ["17:00", "18:00", "19:00"];
    } else if (granularity === "30min") {
      amPeakSlots = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30"];
      pmPeakSlots = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];
    } else {
      // 15min
      amPeakSlots = [
        "07:00",
        "07:15",
        "07:30",
        "07:45",
        "08:00",
        "08:15",
        "08:30",
        "08:45",
        "09:00",
        "09:15",
        "09:30",
        "09:45",
      ];
      pmPeakSlots = [
        "17:00",
        "17:15",
        "17:30",
        "17:45",
        "18:00",
        "18:15",
        "18:30",
        "18:45",
        "19:00",
        "19:15",
        "19:30",
        "19:45",
      ];
    }

    // Filter to only include time slots that exist in the data
    const filteredAmPeakSlots = amPeakSlots.filter((slot) =>
      timeSlots.includes(slot)
    );
    const filteredPmPeakSlots = pmPeakSlots.filter((slot) =>
      timeSlots.includes(slot)
    );

    // Combined for display but keeping AM and PM groups separate
    return {
      allPeakSlots: [...filteredAmPeakSlots, ...filteredPmPeakSlots],
      amPeakSlots: filteredAmPeakSlots,
      pmPeakSlots: filteredPmPeakSlots,
    };
  };

  const { allPeakSlots, amPeakSlots, pmPeakSlots } = getFilteredPeakTimeSlots();

  const getOption = () => {
    if (isFullDayView || autoFullDayView) {
      // Show continuous lines for the whole day
      return {
        title: {
          text: `Passenger Throughput by Completion Time (${
            granularity === "15min"
              ? "15-minute"
              : granularity === "30min"
              ? "30-minute"
              : "Hourly"
          })`,
          left: "center",
          textStyle: {
            color: textColor,
            fontSize: 16,
          },
          subtext:
            "Passengers who completed their journeys, grouped by completion time",
          subtextStyle: {
            fontSize: 12,
          },
        },
        backgroundColor: isDarkMode ? "#000000" : "#ffffff",
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow",
          },
          formatter: (params: any) => {
            let result = `<div>${params[0].axisValue}</div>`;
            params.forEach((param: any) => {
              if (param.value === null || param.value === undefined) return;
              result += `<div style="display:flex;justify-content:space-between;gap:20px">
                <span style="font-weight:bold;color:${param.color}">${
                param.seriesName
              }:</span>
                <span>${param.value.toLocaleString()} passengers</span>
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
          data: timeSlots,
          name: "Time of Day",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: { color: textColor },
          axisLabel: {
            color: axisColor,
            interval:
              granularity === "15min" ? 3 : granularity === "30min" ? 1 : 0,
            rotate: 45,
          },
          axisLine: { lineStyle: { color: axisColor } },
          axisTick: { lineStyle: { color: axisColor } },
          axisPointer: {
            label: {
              formatter: (params: any) => {
                return params.value;
              },
            },
          },
        },
        yAxis: {
          type: "value",
          name: "Passenger Count",
          nameTextStyle: { color: textColor },
          nameLocation: "middle",
          nameGap: 50,
          axisLabel: { color: axisColor },
          splitLine: {
            lineStyle: { color: isDarkMode ? "#444444" : "#EEEEEE" },
          },
          axisLine: { lineStyle: { color: axisColor } },
          axisTick: { lineStyle: { color: axisColor } },
        },
        series: [
          {
            name: "Regular",
            type: "line",
            data: regularData,
            lineStyle: { color: "#0066CC" },
            itemStyle: { color: "#0066CC" },
            connectNulls: false,
            symbol: "circle",
            symbolSize: 6,
          },
          {
            name: "Skip-Stop",
            type: "line",
            data: skipStopData,
            lineStyle: { color: "#9E2B25" },
            itemStyle: { color: "#9E2B25" },
            connectNulls: false,
            symbol: "circle",
            symbolSize: 6,
          },
        ],
      };
    }

    // Peak hours only view
    return {
      title: {
        text: `Passenger Throughput by Completion Time (${
          granularity === "15min"
            ? "15-minute"
            : granularity === "30min"
            ? "30-minute"
            : "Hourly"
        })`,
        left: "center",
        textStyle: {
          color: textColor,
          fontSize: 16,
        },
        subtext: "AM Peak (7-9) and PM Peak (17-19) hours",
        subtextStyle: {
          color: textColor,
          fontSize: 12,
        },
      },
      backgroundColor: isDarkMode ? "#000000" : "#ffffff",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          let result = `<div>${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            if (param.value === null || param.value === undefined) return;
            result += `<div style="display:flex;justify-content:space-between;gap:20px">
              <span style="font-weight:bold;color:${param.color}">${
              param.seriesName
            }:</span>
              <span>${
                param.value ? param.value.toLocaleString() : 0
              } passengers</span>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        data: [
          "Regular (AM)",
          "Regular (PM)",
          "Skip-Stop (AM)",
          "Skip-Stop (PM)",
        ],
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
        data: allPeakSlots,
        name: "Time of Day",
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: { color: textColor },
        axisLabel: {
          color: axisColor,
          interval: granularity === "15min" ? 1 : 0,
          rotate: 45,
        },
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { lineStyle: { color: axisColor } },
      },
      yAxis: {
        type: "value",
        name: "Passenger Count",
        nameTextStyle: { color: textColor },
        nameLocation: "middle",
        nameGap: 50,
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: isDarkMode ? "#444444" : "#EEEEEE" } },
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { lineStyle: { color: axisColor } },
      },
      series: [
        {
          name: "Regular (AM)",
          type: "line",
          sampling: "average",
          data: allPeakSlots.map((slot) => {
            const i = timeSlots.indexOf(slot);
            return amPeakSlots.includes(slot) && i !== -1
              ? regularData[i]
              : null;
          }),
          lineStyle: { color: "#0066CC" },
          itemStyle: { color: "#0066CC" },
          connectNulls: true,
          symbol: "circle",
          symbolSize: 6,
        },
        {
          name: "Regular (PM)",
          type: "line",
          sampling: "average",
          data: allPeakSlots.map((slot) => {
            const i = timeSlots.indexOf(slot);
            return pmPeakSlots.includes(slot) && i !== -1
              ? regularData[i]
              : null;
          }),
          lineStyle: { color: "#0066CC", type: "dashed" },
          itemStyle: { color: "#0066CC" },
          connectNulls: true,
          symbol: "triangle",
          symbolSize: 6,
        },
        {
          name: "Skip-Stop (AM)",
          type: "line",
          sampling: "average",
          data: allPeakSlots.map((slot) => {
            const i = timeSlots.indexOf(slot);
            return amPeakSlots.includes(slot) && i !== -1
              ? skipStopData[i]
              : null;
          }),
          lineStyle: { color: "#9E2B25" },
          itemStyle: { color: "#9E2B25" },
          connectNulls: true,
          symbol: "circle",
          symbolSize: 6,
        },
        {
          name: "Skip-Stop (PM)",
          type: "line",
          sampling: "average",
          data: allPeakSlots.map((slot) => {
            const i = timeSlots.indexOf(slot);
            return pmPeakSlots.includes(slot) && i !== -1
              ? skipStopData[i]
              : null;
          }),
          lineStyle: { color: "#9E2B25", type: "dashed" },
          itemStyle: { color: "#9E2B25" },
          connectNulls: true,
          symbol: "triangle",
          symbolSize: 6,
        },
      ],
    };
  };

  return (
    <div>
      <div className="flex justify-between mb-2">
        <DataInterpretation title="Passenger Throughput Interpretation">
          <p>
            This chart shows passenger throughput based on{" "}
            <strong>journey completion time</strong>, not when passengers start
            their journey.
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1">
            <li>
              Regular service: Passengers follow direct routes with all stops.
            </li>
            <li>
              Skip-stop service: Trains stop at designated stations, requiring
              transfers for some journeys.
            </li>
            <li>
              Differences in throughput patterns reflect the travel time
              variations between schemes.
            </li>
            <li>
              Peak hours (7-9 AM and 5-7 PM) typically show the highest
              passenger volumes.
            </li>
            <li>
              Adjusting granularity helps visualize subtle throughput
              differences.
            </li>
          </ul>
        </DataInterpretation>
        <select
          className="bg-background text-foreground border border-input rounded-md px-2 py-1 text-sm"
          value={granularity}
          onChange={(e) =>
            setGranularity(e.target.value as "15min" | "30min" | "hourly")
          }
        >
          <option value="15min">15-minute intervals</option>
          <option value="30min">30-minute intervals</option>
          <option value="hourly">Hourly intervals</option>
        </select>
      </div>
      <ReactECharts option={getOption()} style={{ height, width }} />
    </div>
  );
};
