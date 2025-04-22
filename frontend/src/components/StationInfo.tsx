"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconClock,
  IconMapPin,
  IconUsers,
  IconTrain,
} from "@tabler/icons-react";
import { BarChart } from "@/components/ui/bar-chart";
import { formatTime } from "@/lib/timeUtils";
import { MRT_COLORS } from "@/components/ui/button";

interface StationInfoProps {
  stationId: number;
  stationName: string;
  waitingPassengers: number;
  nextTrainArrivalNB: string;
  nextTrainArrivalSB: string;
  passengerFlowNB: {
    boarding: number;
    alighting: number;
  };
  passengerFlowSB: {
    boarding: number;
    alighting: number;
  };
  passengerDistribution: { hour: string; count: number }[];
  rawData?: any; // Optional debug data
}

const StationInfo = ({
  stationId,
  stationName,
  waitingPassengers,
  nextTrainArrivalNB,
  nextTrainArrivalSB,
  passengerFlowNB,
  passengerFlowSB,
  passengerDistribution,
  rawData,
}: StationInfoProps) => {
  const [previousWaiting, setPreviousWaiting] = useState(waitingPassengers);
  const [waitingTrend, setWaitingTrend] = useState<"up" | "down" | "same">(
    "same"
  );

  // Calculate trend (up/down/same) of waiting passengers
  useEffect(() => {
    if (waitingPassengers > previousWaiting) {
      setWaitingTrend("up");
    } else if (waitingPassengers < previousWaiting) {
      setWaitingTrend("down");
    } else {
      setWaitingTrend("same");
    }

    // Store current value for the next comparison
    setPreviousWaiting(waitingPassengers);
  }, [waitingPassengers, previousWaiting]);

  // Prepare data for the bar chart (hourly distribution)
  const chartData = passengerDistribution.map((item) => ({
    name: `${item.hour}:00`,
    value: item.count,
  }));

  return (
    <Card>
      <CardHeader className="bg-mrt-blue text-white p-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center">
              <IconMapPin className="mr-2" size={20} />
              {stationName}
            </CardTitle>
            <CardDescription className="text-blue-50 mt-0.5">
              Station {stationId}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="bg-white/10 text-white border-none text-xs px-1.5 py-0.5"
          >
            MRT-3
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-700">
              Platform Status
            </h3>

            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg flex items-center justify-between">
              <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm">
                <IconUsers className="mr-1.5 text-mrt-blue" size={16} />
                <span>Total Waiting (Station)</span>
              </div>
              <span className="font-bold text-lg text-gray-800 dark:text-gray-100">
                {waitingPassengers.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg space-y-2 border border-red-200 dark:border-red-800/50">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">
                  Northbound
                </h4>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <IconTrain
                      className="mr-1 text-red-600 dark:text-red-400"
                      size={14}
                    />{" "}
                    Next:
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {nextTrainArrivalNB} {/* Display full HH:MM:SS */}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <IconArrowUpRight className="mr-1" size={14} /> Boarding:
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {passengerFlowNB.boarding.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-orange-600 dark:text-orange-400">
                    <IconArrowDownRight className="mr-1" size={14} /> Alighting:
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {passengerFlowNB.alighting.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg space-y-2 border border-blue-200 dark:border-blue-800/50">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Southbound
                </h4>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <IconTrain
                      className="mr-1 text-blue-600 dark:text-blue-400"
                      size={14}
                    />{" "}
                    Next:
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {nextTrainArrivalSB} {/* Display full HH:MM:SS */}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <IconArrowUpRight className="mr-1" size={14} /> Boarding:
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {passengerFlowSB.boarding.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-orange-600 dark:text-orange-400">
                    <IconArrowDownRight className="mr-1" size={14} /> Alighting:
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {passengerFlowSB.alighting.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-2">
              Daily Passenger Distribution
            </h3>
            <div className="h-48">
              {chartData.length > 0 ? (
                <BarChart
                  data={chartData}
                  yAxisWidth={25}
                  showAnimation={true}
                  showLegend={false}
                  colors={["#0066CC"]}
                  fontSize={10}
                />
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 text-xs">No distribution data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gray-50 border-t px-4 py-2">
        <div className="text-xs text-gray-500 flex items-center">
          <IconClock size={14} className="mr-1" />
          Data interpolated from minute-level csv
        </div>
      </CardFooter>
    </Card>
  );
};

export default StationInfo;
