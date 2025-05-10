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
  IconArrowDownLeft,
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
import { parseTime, formatTime } from "@/lib/timeUtils";
import { MRT_COLORS } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Define structure for simulation result entries (TRAIN_MOVEMENTS)
interface TrainMovementEntry {
  MOVEMENT_ID?: number;
  SIMULATION_ID?: number;
  SCHEME_TYPE?: string;
  TRAIN_ID: number;
  TRAIN_SERVICE_TYPE?: string;
  STATION_ID: number;
  DIRECTION: "NORTHBOUND" | "SOUTHBOUND";
  TRAIN_STATUS: string;
  ARRIVAL_TIME: string | null;
  DEPARTURE_TIME: string | null;
  TRAVEL_TIME_SECONDS?: number;
  PASSENGERS_BOARDED?: number;
  PASSENGERS_ALIGHTED?: number;
  CURRENT_STATION_PASSENGER_COUNT?: number;
  CURRENT_PASSENGER_COUNT?: number;
}

// Define structure for passenger demand distribution data
interface PassengerDistributionData {
  hour: string;
  count: number;
}

interface StationInfoProps {
  stationId: number;
  stationName: string;
  // New props for dynamic data
  simulationTime: string;
  simulationResult: TrainMovementEntry[] | null;
  passengerDistributionData: PassengerDistributionData[] | null;
  // New props for skip-stop pattern
  stationType?: "A" | "B" | "AB" | null;
  className?: string; // Add className prop
  // Add selectedScheme prop
  selectedScheme: "REGULAR" | "SKIP-STOP";
}

const StationInfo = ({
  stationId,
  stationName,
  // New props with defaults
  stationType = null,
  className,
  // New props
  simulationTime,
  simulationResult,
  passengerDistributionData,
  // Add selectedScheme to destructuring
  selectedScheme,
}: StationInfoProps) => {
  // Calculate dynamic data based on props
  const dynamicData = useMemo(() => {
    let waiting = 0;
    let nextNB = "--:--:--";
    let nextSB = "--:--:--";
    let nextNB_A = null;
    let nextNB_B = null;
    let nextSB_A = null;
    let nextSB_B = null;
    let boardingNB = 0;
    let alightingNB = 0;
    let boardingSB = 0;
    let alightingSB = 0;

    if (simulationResult) {
      const currentTimeSeconds = parseTime(simulationTime);
      let closestPastEventNB: TrainMovementEntry | null = null;
      let closestPastEventSB: TrainMovementEntry | null = null;
      let minFutureArrivalNBSecs = Infinity;
      let minFutureArrivalSBSecs = Infinity;
      let minFutureArrivalNB_A_Secs = Infinity;
      let minFutureArrivalNB_B_Secs = Infinity;
      let minFutureArrivalSB_A_Secs = Infinity;
      let minFutureArrivalSB_B_Secs = Infinity;

      // Filter events for the current station AND current scheme
      const stationEvents = simulationResult.filter(
        (e) =>
          e.STATION_ID === stationId &&
          (!e.SCHEME_TYPE || e.SCHEME_TYPE === selectedScheme)
      );

      for (const event of stationEvents) {
        if (!event.ARRIVAL_TIME) continue;
        const arrivalSecs = parseTime(event.ARRIVAL_TIME);
        const departureSecs = event.DEPARTURE_TIME
          ? parseTime(event.DEPARTURE_TIME)
          : arrivalSecs;
        const serviceType = event.TRAIN_SERVICE_TYPE || "AB";

        // Find the most recent event that has ARRIVED or is DWELLING
        if (arrivalSecs <= currentTimeSeconds) {
          if (event.DIRECTION === "NORTHBOUND") {
            if (
              !closestPastEventNB ||
              arrivalSecs > parseTime(closestPastEventNB.ARRIVAL_TIME!)
            ) {
              closestPastEventNB = event;
            }
          } else {
            // SOUTHBOUND
            if (
              !closestPastEventSB ||
              arrivalSecs > parseTime(closestPastEventSB.ARRIVAL_TIME!)
            ) {
              closestPastEventSB = event;
            }
          }
        }

        // Find the next future arrival
        if (arrivalSecs > currentTimeSeconds) {
          if (event.DIRECTION === "NORTHBOUND") {
            if (arrivalSecs < minFutureArrivalNBSecs)
              minFutureArrivalNBSecs = arrivalSecs;
            if (serviceType === "A" && arrivalSecs < minFutureArrivalNB_A_Secs)
              minFutureArrivalNB_A_Secs = arrivalSecs;
            if (serviceType === "B" && arrivalSecs < minFutureArrivalNB_B_Secs)
              minFutureArrivalNB_B_Secs = arrivalSecs;
          } else {
            // SOUTHBOUND
            if (arrivalSecs < minFutureArrivalSBSecs)
              minFutureArrivalSBSecs = arrivalSecs;
            if (serviceType === "A" && arrivalSecs < minFutureArrivalSB_A_Secs)
              minFutureArrivalSB_A_Secs = arrivalSecs;
            if (serviceType === "B" && arrivalSecs < minFutureArrivalSB_B_Secs)
              minFutureArrivalSB_B_Secs = arrivalSecs;
          }
        }
      }

      // Use CURRENT_STATION_PASSENGER_COUNT from the most recent relevant past event
      // Determine waiting count based on the overall most recent event
      const mostRecentEventOverall =
        closestPastEventNB && closestPastEventSB
          ? parseTime(closestPastEventNB.ARRIVAL_TIME!) >=
            parseTime(closestPastEventSB.ARRIVAL_TIME!)
            ? closestPastEventNB
            : closestPastEventSB
          : closestPastEventNB || closestPastEventSB;

      if (mostRecentEventOverall) {
        waiting = mostRecentEventOverall.CURRENT_STATION_PASSENGER_COUNT ?? 0;
      } else {
        waiting = 0; // Default if no past events at all
      }

      // Set NB boarding/alighting based on the closest past NB event
      if (closestPastEventNB) {
        boardingNB = closestPastEventNB.PASSENGERS_BOARDED ?? 0;
        alightingNB = closestPastEventNB.PASSENGERS_ALIGHTED ?? 0;
      }

      // Set SB boarding/alighting based on the closest past SB event
      if (closestPastEventSB) {
        boardingSB = closestPastEventSB.PASSENGERS_BOARDED ?? 0;
        alightingSB = closestPastEventSB.PASSENGERS_ALIGHTED ?? 0;
      }

      // Format future arrival times
      if (minFutureArrivalNBSecs !== Infinity)
        nextNB = formatTime(minFutureArrivalNBSecs);
      if (minFutureArrivalSBSecs !== Infinity)
        nextSB = formatTime(minFutureArrivalSBSecs);
      if (minFutureArrivalNB_A_Secs !== Infinity)
        nextNB_A = formatTime(minFutureArrivalNB_A_Secs);
      if (minFutureArrivalNB_B_Secs !== Infinity)
        nextNB_B = formatTime(minFutureArrivalNB_B_Secs);
      if (minFutureArrivalSB_A_Secs !== Infinity)
        nextSB_A = formatTime(minFutureArrivalSB_A_Secs);
      if (minFutureArrivalSB_B_Secs !== Infinity)
        nextSB_B = formatTime(minFutureArrivalSB_B_Secs);
    }

    return {
      waiting,
      nextNB,
      nextSB,
      nextNB_A,
      nextNB_B,
      nextSB_A,
      nextSB_B,
      boardingNB,
      alightingNB,
      boardingSB,
      alightingSB,
    };
  }, [stationId, simulationTime, simulationResult, selectedScheme]);

  // Prepare data for the bar chart (hourly distribution)
  const chartData = useMemo(() => {
    return (passengerDistributionData || []).map((item) => ({
      name: item.hour, // Use the format from the new data
      value: item.count,
    }));
  }, [passengerDistributionData]);

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
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="bg-mrt-blue text-white p-3 flex-shrink-0">
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

      {/* Make content scrollable */}
      <ScrollArea className="flex-grow">
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
                    <IconInfoCircle
                      size={16}
                      className="text-gray-500 mt-0.5"
                    />
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
                  <IconUsers
                    className="mr-1.5 text-mrt-blue flex-shrink-0"
                    size={16}
                  />
                  <span>Waiting Now</span>
                </div>
                <span className="font-bold text-lg text-gray-800 dark:text-gray-100">
                  {dynamicData.waiting.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#00844e]/10 dark:bg-[#00844e]/20 p-3 rounded-lg space-y-2 border border-[#00844e]/20 dark:border-[#00844e]/30">
                  <h4 className="text-sm font-semibold text-[#00844e]">
                    Northbound
                  </h4>

                  {/* If skip-stop is active, show detailed arrival info */}
                  {stationType &&
                  (dynamicData.nextNB_A || dynamicData.nextNB_B) ? (
                    <>
                      {/* Type A train arrival */}
                      {(stationType === "A" || stationType === "AB") &&
                        dynamicData.nextNB_A && (
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                              <IconTrain
                                className="mr-1 text-[#00844e] dark:text-[#00844e]/90"
                                size={14}
                              />{" "}
                              <Badge className="bg-mrt-blue text-white text-[10px] px-1 py-0.5 mr-1">
                                A
                              </Badge>
                              Next:
                            </div>
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                              {dynamicData.nextNB_A}
                            </span>
                          </div>
                        )}

                      {/* Type B train arrival */}
                      {(stationType === "B" || stationType === "AB") &&
                        dynamicData.nextNB_B && (
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                              <IconTrain
                                className="mr-1 text-[#00844e] dark:text-[#00844e]/90"
                                size={14}
                              />{" "}
                              <Badge className="bg-mrt-red text-white text-[10px] px-1 py-0.5 mr-1">
                                B
                              </Badge>
                              Next:
                            </div>
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                              {dynamicData.nextNB_B}
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
                        {dynamicData.nextNB}
                      </span>
                    </div>
                  )}

                  {/* Passenger flow - use calculated */}
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <IconArrowUpRight className="mr-1" size={14} /> Boarded
                      (Last):
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {dynamicData.boardingNB.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-orange-600 dark:text-orange-400">
                      <IconArrowDownLeft className="mr-1" size={14} /> Alighted
                      (Last):
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {dynamicData.alightingNB.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="bg-[#ffcf26]/10 dark:bg-[#ffcf26]/20 p-3 rounded-lg space-y-2 border border-[#ffcf26]/30 dark:border-[#ffcf26]/30">
                  <h4 className="text-sm font-semibold text-yellow-600 dark:text-[#ffcf26]">
                    Southbound
                  </h4>

                  {/* If skip-stop is active, show detailed arrival info */}
                  {stationType &&
                  (dynamicData.nextSB_A || dynamicData.nextSB_B) ? (
                    <>
                      {/* Type A train arrival */}
                      {(stationType === "A" || stationType === "AB") &&
                        dynamicData.nextSB_A && (
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                              <IconTrain
                                className="mr-1 text-[#ffcf26] dark:text-[#ffcf26]"
                                size={14}
                              />{" "}
                              <Badge className="bg-mrt-blue text-white text-[10px] px-1 py-0.5 mr-1">
                                A
                              </Badge>
                              Next:
                            </div>
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                              {dynamicData.nextSB_A}
                            </span>
                          </div>
                        )}

                      {/* Type B train arrival */}
                      {(stationType === "B" || stationType === "AB") &&
                        dynamicData.nextSB_B && (
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center">
                              <IconTrain
                                className="mr-1 text-[#ffcf26] dark:text-[#ffcf26]"
                                size={14}
                              />{" "}
                              <Badge className="bg-mrt-red text-white text-[10px] px-1 py-0.5 mr-1">
                                B
                              </Badge>
                              Next:
                            </div>
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                              {dynamicData.nextSB_B}
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
                        {dynamicData.nextSB}
                      </span>
                    </div>
                  )}

                  {/* Passenger flow - use calculated */}
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <IconArrowUpRight className="mr-1" size={14} /> Boarded
                      (Last):
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {dynamicData.boardingSB.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-orange-600 dark:text-orange-400">
                      <IconArrowDownLeft className="mr-1" size={14} /> Alighted
                      (Last):
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {dynamicData.alightingSB.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-semibold text-gray-700 mb-2">
                Daily Passenger Distribution
              </h3>
              <div className="h-40">
                {chartData.length > 0 ? (
                  <BarChart
                    data={chartData}
                    yAxisWidth={60}
                    showAnimation={false}
                    showLegend={false}
                    colors={["#0066CC"]}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500 text-xs">
                      No distribution data
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default StationInfo;
