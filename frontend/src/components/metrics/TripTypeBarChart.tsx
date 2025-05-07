import React, { useState } from "react";
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
}

export const TripTypeBarChart: React.FC<TripTypeBarChartProps> = ({
  height = "400px",
}) => {
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>("PASSENGER_COUNT");

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

  // Process data for trip type comparison
  const prepareTripTypeData = () => {
    console.log(
      "Processing trip type data from",
      passengerDemand.length,
      "entries"
    );
    // Data structure to hold aggregated values
    const data = {
      DIRECT: {
        REGULAR: { sum: 0, count: 0 },
        "SKIP-STOP": { sum: 0, count: 0 },
      },
      TRANSFER: {
        REGULAR: { sum: 0, count: 0 },
        "SKIP-STOP": { sum: 0, count: 0 },
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
      if (!data[tripType]) {
        data[tripType] = {
          REGULAR: { sum: 0, count: 0 },
          "SKIP-STOP": { sum: 0, count: 0 },
        };
      }

      if (!data[tripType][scheme]) {
        data[tripType][scheme] = { sum: 0, count: 0 };
      }

      if (selectedMetric === "PASSENGER_COUNT") {
        data[tripType][scheme].sum += entry.PASSENGER_COUNT || 0;
        data[tripType][scheme].count += 1;
      } else {
        const value = entry[selectedMetric];
        if (typeof value === "number") {
          data[tripType][scheme].sum += value;
          data[tripType][scheme].count += 1;
        }
      }
    });

    console.log("Aggregated trip type data:", data);

    // Calculate final values
    const result = {
      DIRECT: {
        REGULAR:
          selectedMetric === "PASSENGER_COUNT"
            ? data["DIRECT"]["REGULAR"].sum
            : data["DIRECT"]["REGULAR"].count > 0
            ? data["DIRECT"]["REGULAR"].sum / data["DIRECT"]["REGULAR"].count
            : 0,
        "SKIP-STOP":
          selectedMetric === "PASSENGER_COUNT"
            ? data["DIRECT"]["SKIP-STOP"].sum
            : data["DIRECT"]["SKIP-STOP"].count > 0
            ? data["DIRECT"]["SKIP-STOP"].sum /
              data["DIRECT"]["SKIP-STOP"].count
            : 0,
      },
      TRANSFER: {
        REGULAR:
          selectedMetric === "PASSENGER_COUNT"
            ? data["TRANSFER"]["REGULAR"].sum
            : data["TRANSFER"]["REGULAR"].count > 0
            ? data["TRANSFER"]["REGULAR"].sum /
              data["TRANSFER"]["REGULAR"].count
            : 0,
        "SKIP-STOP":
          selectedMetric === "PASSENGER_COUNT"
            ? data["TRANSFER"]["SKIP-STOP"].sum
            : data["TRANSFER"]["SKIP-STOP"].count > 0
            ? data["TRANSFER"]["SKIP-STOP"].sum /
              data["TRANSFER"]["SKIP-STOP"].count
            : 0,
      },
    };

    return result;
  };

  const tripTypeData = prepareTripTypeData();

  const getOption = () => {
    const option = {
      title: {
        text: `${
          selectedMetric === "PASSENGER_COUNT"
            ? "Passenger Count"
            : selectedMetric === "WAIT_TIME"
            ? "Average Wait Time"
            : "Average Travel Time"
        } by Trip Type and Scheme`,
        left: "center",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          let result = `<div>${params[0].axisValue} Trips</div>`;

          params.forEach((param: any) => {
            const value =
              selectedMetric === "PASSENGER_COUNT"
                ? param.value.toLocaleString()
                : (param.value / 60).toFixed(2) + "min";

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
        data: ["Direct", "Transfer"],
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: "value",
        name:
          selectedMetric === "PASSENGER_COUNT"
            ? "Passenger Count"
            : "Time (minutes)",
        nameLocation: "middle",
        nameGap: 50,
      },
      series: [
        {
          name: "Regular",
          type: "bar",
          data: [
            tripTypeData["DIRECT"]["REGULAR"],
            tripTypeData["TRANSFER"]["REGULAR"],
          ],
          itemStyle: {
            color: "#0066CC",
          },
        },
        {
          name: "Skip-Stop",
          type: "bar",
          data: [
            tripTypeData["DIRECT"]["SKIP-STOP"],
            tripTypeData["TRANSFER"]["SKIP-STOP"],
          ],
          itemStyle: {
            color: "#9E2B25",
          },
        },
      ],
    };

    return option;
  };

  return (
    <Card>
      <CardContent>
        <div className="w-full mb-4">
          <label className="text-sm font-medium mb-1 block">Metric:</label>
          <Select
            value={selectedMetric}
            onValueChange={(value) => setSelectedMetric(value as MetricType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PASSENGER_COUNT">Passenger Count</SelectItem>
              <SelectItem value="WAIT_TIME">Average Wait Time</SelectItem>
              <SelectItem value="TRAVEL_TIME">Average Travel Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ReactECharts option={getOption()} style={{ height }} />
      </CardContent>
    </Card>
  );
};
