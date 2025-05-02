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
  IconRoute,
  IconInfoCircle,
  IconBuildingSkyscraper,
} from "@tabler/icons-react";
import { BarChart } from "@/components/ui/bar-chart";
import { formatTime } from "@/lib/timeUtils";
import { MRT_COLORS } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  // New props for skip-stop pattern
  stationType?: "A" | "B" | "AB" | null;
  nextTrainArrivalNB_TypeA?: string | null;
  nextTrainArrivalNB_TypeB?: string | null;
  nextTrainArrivalSB_TypeA?: string | null;
  nextTrainArrivalSB_TypeB?: string | null;
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
  // New props with defaults
  stationType = null,
  nextTrainArrivalNB_TypeA = null,
  nextTrainArrivalNB_TypeB = null,
  nextTrainArrivalSB_TypeA = null,
  nextTrainArrivalSB_TypeB = null,
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

  // Determine station type style
  const stationTypeColor =
    stationType === "A"
      ? "bg-mrt-red text-white"
      : stationType === "B"
      ? "bg-mrt-green text-white"
      : stationType === "AB"
      ? "bg-mrt-blue text-white"
      : "bg-gray-600 text-white";

  // Station type explanations
  const stationTypeExplanation = {
    A: "This is an A-type station. Only A-trains and regular trains stop here.",
    B: "This is a B-type station. Only B-trains and regular trains stop here.",
    AB: "This is an AB-type station. All trains stop here regardless of type.",
  };

  // Get appropriate explanation based on station type
  const currentTypeExplanation = stationType
    ? stationTypeExplanation[stationType]
    : "";

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
          <div className="flex items-center gap-2">
            {/* Station Type Badge */}
            {stationType && (
              <Badge
                className={`px-2 py-1 font-bold text-xs ${stationTypeColor}`}
                title={currentTypeExplanation}
              >
                {stationType}-Station
              </Badge>
            )}
            <Badge
              variant="outline"
              className="bg-white/10 text-white border-none text-xs px-1.5 py-0.5"
            >
              MRT-3
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-700">
              Platform Status
            </h3>

            {/* Station type explanation banner (if a skip-stop pattern is active) */}
            {stationType && (
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-start space-x-2">
                  <IconInfoCircle size={16} className="text-gray-500 mt-0.5" />
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <p>{currentTypeExplanation}</p>
                    {stationType !== "AB" && (
                      <p className="mt-1">
                        <span className="font-medium">Note:</span> Check the
                        train type before boarding.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

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
              <div className="bg-[#00844e]/10 dark:bg-[#00844e]/20 p-3 rounded-lg space-y-2 border border-[#00844e]/20 dark:border-[#00844e]/30">
                <h4 className="text-sm font-semibold text-[#00844e] dark:text-[#00844e]/90">
                  Northbound
                </h4>

                {/* If skip-stop is active, show detailed arrival info */}
                {stationType &&
                (nextTrainArrivalNB_TypeA || nextTrainArrivalNB_TypeB) ? (
                  <>
                    {/* Type A train arrival */}
                    {(stationType === "A" || stationType === "AB") &&
                      nextTrainArrivalNB_TypeA && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center">
                            <IconTrain
                              className="mr-1 text-[#00844e] dark:text-[#00844e]/90"
                              size={14}
                            />{" "}
                            <Badge className="bg-mrt-red text-white text-[10px] px-1 py-0.5 mr-1">
                              A
                            </Badge>
                            Next:
                          </div>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {nextTrainArrivalNB_TypeA}
                          </span>
                        </div>
                      )}

                    {/* Type B train arrival */}
                    {(stationType === "B" || stationType === "AB") &&
                      nextTrainArrivalNB_TypeB && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center">
                            <IconTrain
                              className="mr-1 text-[#00844e] dark:text-[#00844e]/90"
                              size={14}
                            />{" "}
                            <Badge className="bg-mrt-green text-white text-[10px] px-1 py-0.5 mr-1">
                              B
                            </Badge>
                            Next:
                          </div>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {nextTrainArrivalNB_TypeB}
                          </span>
                        </div>
                      )}
                  </>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <IconTrain
                        className="mr-1 text-[#00844e] dark:text-[#00844e]/90"
                        size={14}
                      />{" "}
                      Next:
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {nextTrainArrivalNB}
                    </span>
                  </div>
                )}

                {/* Passenger flow - unchanged */}
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

              <div className="bg-[#ffcf26]/10 dark:bg-[#ffcf26]/20 p-3 rounded-lg space-y-2 border border-[#ffcf26]/30 dark:border-[#ffcf26]/30">
                <h4 className="text-sm font-semibold text-[#ffcf26]/90 dark:text-[#ffcf26]">
                  Southbound
                </h4>

                {/* If skip-stop is active, show detailed arrival info */}
                {stationType &&
                (nextTrainArrivalSB_TypeA || nextTrainArrivalSB_TypeB) ? (
                  <>
                    {/* Type A train arrival */}
                    {(stationType === "A" || stationType === "AB") &&
                      nextTrainArrivalSB_TypeA && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center">
                            <IconTrain
                              className="mr-1 text-[#ffcf26] dark:text-[#ffcf26]"
                              size={14}
                            />{" "}
                            <Badge className="bg-mrt-red text-white text-[10px] px-1 py-0.5 mr-1">
                              A
                            </Badge>
                            Next:
                          </div>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {nextTrainArrivalSB_TypeA}
                          </span>
                        </div>
                      )}

                    {/* Type B train arrival */}
                    {(stationType === "B" || stationType === "AB") &&
                      nextTrainArrivalSB_TypeB && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center">
                            <IconTrain
                              className="mr-1 text-[#ffcf26] dark:text-[#ffcf26]"
                              size={14}
                            />{" "}
                            <Badge className="bg-mrt-green text-white text-[10px] px-1 py-0.5 mr-1">
                              B
                            </Badge>
                            Next:
                          </div>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {nextTrainArrivalSB_TypeB}
                          </span>
                        </div>
                      )}
                  </>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <IconTrain
                        className="mr-1 text-[#ffcf26] dark:text-[#ffcf26]"
                        size={14}
                      />{" "}
                      Next:
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {nextTrainArrivalSB}
                    </span>
                  </div>
                )}

                {/* Passenger flow - unchanged */}
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
