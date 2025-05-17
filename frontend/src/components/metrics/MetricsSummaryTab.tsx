import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMetricsStore,
  useCurrentProcessedMetrics,
} from "@/store/metricsStore";
import { usePassengerDemandStore } from "@/store/passengerDemandStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { IconFileSpreadsheet } from "@tabler/icons-react";
import * as XLSX from "xlsx";

const MetricsSummaryTab: React.FC = () => {
  const metricsLoading = useMetricsStore((state) => state.isLoading);
  const processedMetrics = useCurrentProcessedMetrics();
  const { passengerDemand, isLoading: demandLoading } =
    usePassengerDemandStore();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const isLoading = metricsLoading || demandLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!processedMetrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <span>No metrics data available</span>
      </div>
    );
  }

  // Calculate passenger demand summaries
  const calculateDemandSummaries = () => {
    if (!passengerDemand || passengerDemand.length === 0) {
      return {
        directTrips: { REGULAR: 0, "SKIP-STOP": 0 },
        transferTrips: { REGULAR: 0, "SKIP-STOP": 0 },
        avgWaitTime: { REGULAR: 0, "SKIP-STOP": 0 },
        avgTravelTime: { REGULAR: 0, "SKIP-STOP": 0 },
        originDestinationPairs: 0,
      };
    }

    // Initialize aggregation objects
    const counts = {
      DIRECT: { REGULAR: 0, "SKIP-STOP": 0 },
      TRANSFER: { REGULAR: 0, "SKIP-STOP": 0 },
    };

    const waitTimeSums = {
      REGULAR: { sum: 0, count: 0 },
      "SKIP-STOP": { sum: 0, count: 0 },
    };

    const travelTimeSums = {
      REGULAR: { sum: 0, count: 0 },
      "SKIP-STOP": { sum: 0, count: 0 },
    };

    // Set to track unique OD pairs
    const odPairs = new Set();

    // Process data
    passengerDemand.forEach((entry) => {
      const scheme = entry.SCHEME_TYPE;
      const tripType = entry.TRIP_TYPE;

      // Count passengers by trip type and scheme
      counts[tripType][scheme] += entry.PASSENGER_COUNT;

      // Track wait and travel times
      waitTimeSums[scheme].sum += entry.WAIT_TIME * entry.PASSENGER_COUNT;
      waitTimeSums[scheme].count += entry.PASSENGER_COUNT;

      travelTimeSums[scheme].sum += entry.TRAVEL_TIME * entry.PASSENGER_COUNT;
      travelTimeSums[scheme].count += entry.PASSENGER_COUNT;

      // Track unique OD pairs
      odPairs.add(`${entry.ORIGIN_STATION_ID}-${entry.DESTINATION_STATION_ID}`);
    });

    // Calculate averages
    const avgWaitTime = {
      REGULAR:
        waitTimeSums.REGULAR.count > 0
          ? waitTimeSums.REGULAR.sum / waitTimeSums.REGULAR.count
          : 0,
      "SKIP-STOP":
        waitTimeSums["SKIP-STOP"].count > 0
          ? waitTimeSums["SKIP-STOP"].sum / waitTimeSums["SKIP-STOP"].count
          : 0,
    };

    const avgTravelTime = {
      REGULAR:
        travelTimeSums.REGULAR.count > 0
          ? travelTimeSums.REGULAR.sum / travelTimeSums.REGULAR.count
          : 0,
      "SKIP-STOP":
        travelTimeSums["SKIP-STOP"].count > 0
          ? travelTimeSums["SKIP-STOP"].sum / travelTimeSums["SKIP-STOP"].count
          : 0,
    };

    return {
      directTrips: counts.DIRECT,
      transferTrips: counts.TRANSFER,
      avgWaitTime,
      avgTravelTime,
      originDestinationPairs: odPairs.size,
    };
  };

  const demandSummaries = calculateDemandSummaries();

  // Export to Excel function
  const exportToExcel = () => {
    if (!processedMetrics) return;

    const demandSummaries = calculateDemandSummaries();
    const workbook = XLSX.utils.book_new();

    // System Performance Comparison worksheet
    const systemPerformanceData = [
      ["", "Regular Service", "Skip-Stop Service"],
      [
        "Total Passengers",
        processedMetrics.basicMetrics["Total Passengers"]?.REGULAR || 0,
        processedMetrics.basicMetrics["Total Passengers"]?.["SKIP-STOP"] || 0,
      ],
      [
        "Avg. Platform Wait Time",
        processedMetrics.averageMetrics["Average Wait Time per Passenger"]
          ?.REGULAR || 0,
        processedMetrics.averageMetrics["Average Wait Time per Passenger"]?.[
          "SKIP-STOP"
        ] || 0,
      ],
      [
        "Avg. In-Vehicle Travel Time",
        processedMetrics.averageMetrics["Average Travel Time per Passenger"]
          ?.REGULAR || 0,
        processedMetrics.averageMetrics["Average Travel Time per Passenger"]?.[
          "SKIP-STOP"
        ] || 0,
      ],
      [
        "Avg. Trip Time (Origin – Destination)",
        processedMetrics.averageMetrics[
          "Average Total Journey Time per Passenger"
        ]?.REGULAR || 0,
        processedMetrics.averageMetrics[
          "Average Total Journey Time per Passenger"
        ]?.["SKIP-STOP"] || 0,
      ],
    ];

    // Passenger Demand Breakdown worksheet
    const demandBreakdownData = [
      ["", "Regular Service", "Skip-Stop Service"],
      [
        "Direct Trips",
        demandSummaries.directTrips.REGULAR,
        demandSummaries.directTrips["SKIP-STOP"],
      ],
      [
        "Transfer Trips",
        demandSummaries.transferTrips.REGULAR,
        demandSummaries.transferTrips["SKIP-STOP"],
      ],
      [
        "Total Trips",
        demandSummaries.directTrips.REGULAR +
          demandSummaries.transferTrips.REGULAR,
        demandSummaries.directTrips["SKIP-STOP"] +
          demandSummaries.transferTrips["SKIP-STOP"],
      ],
      [
        "% Transfer Trips",
        demandSummaries.directTrips.REGULAR +
          demandSummaries.transferTrips.REGULAR >
        0
          ? (demandSummaries.transferTrips.REGULAR /
              (demandSummaries.directTrips.REGULAR +
                demandSummaries.transferTrips.REGULAR)) *
            100
          : 0,
        demandSummaries.directTrips["SKIP-STOP"] +
          demandSummaries.transferTrips["SKIP-STOP"] >
        0
          ? (demandSummaries.transferTrips["SKIP-STOP"] /
              (demandSummaries.directTrips["SKIP-STOP"] +
                demandSummaries.transferTrips["SKIP-STOP"])) *
            100
          : 0,
      ],
    ];

    // Time Metrics from Flow worksheet
    const timeMetricsData = [
      ["", "Regular Service", "Skip-Stop Service"],
      [
        "Avg. Passenger Wait Time (s)",
        demandSummaries.avgWaitTime.REGULAR,
        demandSummaries.avgWaitTime["SKIP-STOP"],
      ],
      [
        "Avg. Passenger Travel Time (s)",
        demandSummaries.avgTravelTime.REGULAR,
        demandSummaries.avgTravelTime["SKIP-STOP"],
      ],
      [
        "Avg. Passenger Journey Time (s)",
        demandSummaries.avgWaitTime.REGULAR +
          demandSummaries.avgTravelTime.REGULAR,
        demandSummaries.avgWaitTime["SKIP-STOP"] +
          demandSummaries.avgTravelTime["SKIP-STOP"],
      ],
      [
        "Network Coverage",
        `${demandSummaries.originDestinationPairs} unique origin-destination pairs`,
      ],
    ];

    // Key Findings worksheet
    const findings = [];
    const totalJourneyTimeRegular =
      demandSummaries.avgWaitTime.REGULAR +
      demandSummaries.avgTravelTime.REGULAR;
    const totalJourneyTimeSkipStop =
      demandSummaries.avgWaitTime["SKIP-STOP"] +
      demandSummaries.avgTravelTime["SKIP-STOP"];

    if (totalJourneyTimeSkipStop < totalJourneyTimeRegular) {
      const reduction =
        ((totalJourneyTimeRegular - totalJourneyTimeSkipStop) /
          totalJourneyTimeRegular) *
        100;
      findings.push([
        "Journey Time",
        `The Skip-Stop service reduced the average total journey time by ${reduction.toFixed(
          1
        )}% compared to the Regular service.`,
      ]);
    } else if (totalJourneyTimeRegular < totalJourneyTimeSkipStop) {
      const increase =
        ((totalJourneyTimeSkipStop - totalJourneyTimeRegular) /
          totalJourneyTimeSkipStop) *
        100;
      findings.push([
        "Journey Time",
        `The Regular all-stop service resulted in a shorter average total journey time by ${increase.toFixed(
          1
        )}% compared to the Skip-Stop service.`,
      ]);
    }

    if (
      demandSummaries.avgWaitTime.REGULAR >
      demandSummaries.avgWaitTime["SKIP-STOP"]
    ) {
      const waitReduction =
        ((demandSummaries.avgWaitTime.REGULAR -
          demandSummaries.avgWaitTime["SKIP-STOP"]) /
          demandSummaries.avgWaitTime.REGULAR) *
        100;
      if (waitReduction > 1) {
        findings.push([
          "Wait Time",
          `Skip-Stop service demonstrated a lower average passenger wait time, reducing it by ${waitReduction.toFixed(
            1
          )}%.`,
        ]);
      }
    } else if (
      demandSummaries.avgWaitTime["SKIP-STOP"] >
      demandSummaries.avgWaitTime.REGULAR
    ) {
      const waitIncrease =
        ((demandSummaries.avgWaitTime["SKIP-STOP"] -
          demandSummaries.avgWaitTime.REGULAR) /
          demandSummaries.avgWaitTime["SKIP-STOP"]) *
        100;
      if (waitIncrease > 1) {
        findings.push([
          "Wait Time",
          `Regular service showed a lower average passenger wait time by ${waitIncrease.toFixed(
            1
          )}%.`,
        ]);
      }
    }

    const travelTimeRegular = demandSummaries.avgTravelTime.REGULAR;
    const travelTimeSkipStop = demandSummaries.avgTravelTime["SKIP-STOP"];
    if (travelTimeSkipStop < travelTimeRegular) {
      const travelReduction =
        ((travelTimeRegular - travelTimeSkipStop) / travelTimeRegular) * 100;
      findings.push([
        "Travel Time",
        `The Skip-Stop service achieved a notable reduction in average in-vehicle travel time by ${travelReduction.toFixed(
          1
        )}%.`,
      ]);
    } else if (travelTimeRegular < travelTimeSkipStop) {
      const travelIncrease =
        ((travelTimeSkipStop - travelTimeRegular) / travelTimeSkipStop) * 100;
      findings.push([
        "Travel Time",
        `Regular service offered slightly shorter average in-vehicle travel times by ${travelIncrease.toFixed(
          1
        )}%.`,
      ]);
    }

    // Transfer rate finding
    const totalTripsRegular =
      demandSummaries.directTrips.REGULAR +
      demandSummaries.transferTrips.REGULAR;
    const totalTripsSkipStop =
      demandSummaries.directTrips["SKIP-STOP"] +
      demandSummaries.transferTrips["SKIP-STOP"];
    const transferRateSkipStop =
      totalTripsSkipStop > 0
        ? (demandSummaries.transferTrips["SKIP-STOP"] / totalTripsSkipStop) *
          100
        : 0;

    if (transferRateSkipStop > 0) {
      findings.push([
        "Transfer Rate",
        `The Skip-Stop service resulted in ${transferRateSkipStop.toFixed(
          1
        )}% of trips requiring a train-to-train transfer.`,
      ]);
    }

    // Passenger throughput finding
    const totalPassengersRegular =
      processedMetrics.basicMetrics["Total Passengers"]?.REGULAR || 0;
    const totalPassengersSkipStop =
      processedMetrics.basicMetrics["Total Passengers"]?.["SKIP-STOP"] || 0;

    if (totalPassengersRegular > totalPassengersSkipStop) {
      const diff =
        ((totalPassengersRegular - totalPassengersSkipStop) /
          totalPassengersRegular) *
        100;
      if (diff > 1) {
        findings.push([
          "Passenger Throughput",
          `Regular service accommodated ${diff.toFixed(
            1
          )}% more completed passenger journeys overall.`,
        ]);
      }
    } else if (totalPassengersSkipStop > totalPassengersRegular) {
      const diff =
        ((totalPassengersSkipStop - totalPassengersRegular) /
          totalPassengersSkipStop) *
        100;
      if (diff > 1) {
        findings.push([
          "Passenger Throughput",
          `Skip-Stop service accommodated ${diff.toFixed(
            1
          )}% more completed passenger journeys overall.`,
        ]);
      }
    }

    if (findings.length === 0) {
      findings.push([
        "Overall",
        "The simulation data does not indicate a strong overall performance advantage for one service type over the other based on the current primary metrics.",
      ]);
    }

    // Create worksheets and add to workbook
    const systemPerformanceSheet = XLSX.utils.aoa_to_sheet(
      systemPerformanceData
    );
    const demandBreakdownSheet = XLSX.utils.aoa_to_sheet(demandBreakdownData);
    const timeMetricsSheet = XLSX.utils.aoa_to_sheet(timeMetricsData);
    const findingsSheet = XLSX.utils.aoa_to_sheet(findings);

    // Apply styles (via column widths)
    systemPerformanceSheet["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }];
    demandBreakdownSheet["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }];
    timeMetricsSheet["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }];
    findingsSheet["!cols"] = [{ wch: 20 }, { wch: 80 }];

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(
      workbook,
      systemPerformanceSheet,
      "System Performance"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      demandBreakdownSheet,
      "Passenger Demand"
    );
    XLSX.utils.book_append_sheet(workbook, timeMetricsSheet, "Time Metrics");
    XLSX.utils.book_append_sheet(workbook, findingsSheet, "Key Findings");

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, "metrics_summary.xlsx");
  };

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto metrics-summary-container">
      {/* Export to Excel Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export to Excel</DialogTitle>
            <DialogDescription>
              Are you sure you want to download the metrics summary as an Excel
              file?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-between">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                exportToExcel();
                setIsExportDialogOpen(false);
              }}
            >
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">
          Summary of Key Simulation Metrics
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setIsExportDialogOpen(true)}
            title="Download summary as Excel"
          >
            <IconFileSpreadsheet className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* System-wide metrics */}
      <Card>
        <CardHeader>
          <CardTitle>System Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="font-medium">Metric</div>
            <div className="font-medium text-center">Regular Service</div>
            <div className="font-medium text-center">Skip-Stop Service</div>

            <div>Total Passengers</div>
            <div className="text-center">
              {processedMetrics.basicMetrics[
                "Total Passengers"
              ]?.REGULAR?.toLocaleString() || "N/A"}
            </div>
            <div className="text-center">
              {processedMetrics.basicMetrics["Total Passengers"]?.[
                "SKIP-STOP"
              ]?.toLocaleString() || "N/A"}
            </div>

            <div>Avg. Platform Wait Time</div>
            <div className="text-center">
              {processedMetrics.averageMetrics[
                "Average Wait Time per Passenger"
              ]?.REGULAR?.toFixed(2) || "N/A"}{" "}
              seconds
            </div>
            <div className="text-center">
              {processedMetrics.averageMetrics[
                "Average Wait Time per Passenger"
              ]?.["SKIP-STOP"]?.toFixed(2) || "N/A"}{" "}
              seconds
            </div>

            <div>Avg. In-Vehicle Travel Time</div>
            <div className="text-center">
              {processedMetrics.averageMetrics[
                "Average Travel Time per Passenger"
              ]?.REGULAR?.toFixed(2) || "N/A"}{" "}
              seconds
            </div>
            <div className="text-center">
              {processedMetrics.averageMetrics[
                "Average Travel Time per Passenger"
              ]?.["SKIP-STOP"]?.toFixed(2) || "N/A"}{" "}
              seconds
            </div>

            <div>Avg. Trip Time (Origin – Destination)</div>
            <div className="text-center">
              {processedMetrics.averageMetrics[
                "Average Total Journey Time per Passenger"
              ]?.REGULAR?.toFixed(2) || "N/A"}{" "}
              seconds
            </div>
            <div className="text-center">
              {processedMetrics.averageMetrics[
                "Average Total Journey Time per Passenger"
              ]?.["SKIP-STOP"]?.toFixed(2) || "N/A"}{" "}
              seconds
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passenger demand breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Passenger Demand Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="font-medium">Trip Type</div>
            <div className="font-medium text-center">Regular Service</div>
            <div className="font-medium text-center">Skip-Stop Service</div>

            <div>Direct Trips</div>
            <div className="text-center">
              {demandSummaries.directTrips.REGULAR.toLocaleString()}
            </div>
            <div className="text-center">
              {demandSummaries.directTrips["SKIP-STOP"].toLocaleString()}
            </div>

            <div>Transfer Trips</div>
            <div className="text-center">
              {demandSummaries.transferTrips.REGULAR.toLocaleString()}
            </div>
            <div className="text-center">
              {demandSummaries.transferTrips["SKIP-STOP"].toLocaleString()}
            </div>

            <div>Total Trips</div>
            <div className="text-center">
              {(
                demandSummaries.directTrips.REGULAR +
                demandSummaries.transferTrips.REGULAR
              ).toLocaleString()}
            </div>
            <div className="text-center">
              {(
                demandSummaries.directTrips["SKIP-STOP"] +
                demandSummaries.transferTrips["SKIP-STOP"]
              ).toLocaleString()}
            </div>

            <div>% Transfer Trips</div>
            <div className="text-center">
              {demandSummaries.directTrips.REGULAR +
                demandSummaries.transferTrips.REGULAR >
              0
                ? (
                    (demandSummaries.transferTrips.REGULAR /
                      (demandSummaries.directTrips.REGULAR +
                        demandSummaries.transferTrips.REGULAR)) *
                    100
                  ).toFixed(1)
                : "0"}
              %
            </div>
            <div className="text-center">
              {demandSummaries.directTrips["SKIP-STOP"] +
                demandSummaries.transferTrips["SKIP-STOP"] >
              0
                ? (
                    (demandSummaries.transferTrips["SKIP-STOP"] /
                      (demandSummaries.directTrips["SKIP-STOP"] +
                        demandSummaries.transferTrips["SKIP-STOP"])) *
                    100
                  ).toFixed(1)
                : "0"}
              %
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time metrics from passenger demand */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Time Metrics from Passenger Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="font-medium">Metric</div>
            <div className="font-medium text-center">Regular Service</div>
            <div className="font-medium text-center">Skip-Stop Service</div>

            <div>Avg. Passenger Wait Time (s)</div>
            <div className="text-center">
              {demandSummaries.avgWaitTime.REGULAR.toFixed(2)} seconds
            </div>
            <div className="text-center">
              {demandSummaries.avgWaitTime["SKIP-STOP"].toFixed(2)} seconds
            </div>

            <div>Avg. Passenger Travel Time (s)</div>
            <div className="text-center">
              {demandSummaries.avgTravelTime.REGULAR.toFixed(2)} seconds
            </div>
            <div className="text-center">
              {demandSummaries.avgTravelTime["SKIP-STOP"].toFixed(2)} seconds
            </div>

            <div>Avg. Passenger Journey Time (s)</div>
            <div className="text-center">
              {(
                demandSummaries.avgWaitTime.REGULAR +
                demandSummaries.avgTravelTime.REGULAR
              ).toFixed(2)}{" "}
              seconds
            </div>
            <div className="text-center">
              {(
                demandSummaries.avgWaitTime["SKIP-STOP"] +
                demandSummaries.avgTravelTime["SKIP-STOP"]
              ).toFixed(2)}{" "}
              seconds
            </div>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Network Coverage:</strong>{" "}
              {demandSummaries.originDestinationPairs} unique origin-destination
              pairs were served in this simulation.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key findings */}
      <Card>
        <CardHeader>
          <CardTitle>Key Findings</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-3">
            {(() => {
              const findings = [];
              const totalJourneyTimeRegular =
                demandSummaries.avgWaitTime.REGULAR +
                demandSummaries.avgTravelTime.REGULAR;
              const totalJourneyTimeSkipStop =
                demandSummaries.avgWaitTime["SKIP-STOP"] +
                demandSummaries.avgTravelTime["SKIP-STOP"];

              // Finding 1: Overall Journey Time
              if (totalJourneyTimeSkipStop < totalJourneyTimeRegular) {
                const reduction =
                  ((totalJourneyTimeRegular - totalJourneyTimeSkipStop) /
                    totalJourneyTimeRegular) *
                  100;
                findings.push(
                  <li key="journeyTimeReduction">
                    The Skip-Stop service reduced the average total journey time
                    (wait + travel) for passengers by{" "}
                    <strong className="text-green-600 dark:text-green-400">
                      {reduction.toFixed(1)}%
                    </strong>{" "}
                    compared to the Regular service. This suggests potential
                    overall time savings despite operational differences.
                  </li>
                );
              } else if (totalJourneyTimeRegular < totalJourneyTimeSkipStop) {
                const increase =
                  ((totalJourneyTimeSkipStop - totalJourneyTimeRegular) /
                    totalJourneyTimeSkipStop) *
                  100;
                findings.push(
                  <li key="journeyTimeIncrease">
                    The Regular all-stop service resulted in a shorter average
                    total journey time by{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {increase.toFixed(1)}%
                    </strong>{" "}
                    compared to the Skip-Stop service.
                  </li>
                );
              }

              // Finding 2: Wait Time Analysis
              if (
                demandSummaries.avgWaitTime.REGULAR >
                demandSummaries.avgWaitTime["SKIP-STOP"]
              ) {
                const waitReduction =
                  ((demandSummaries.avgWaitTime.REGULAR -
                    demandSummaries.avgWaitTime["SKIP-STOP"]) /
                    demandSummaries.avgWaitTime.REGULAR) *
                  100;
                if (waitReduction > 1) {
                  // Only show if meaningful reduction
                  findings.push(
                    <li key="waitReduction">
                      Skip-Stop service demonstrated a lower average passenger
                      wait time, reducing it by{" "}
                      <strong className="text-green-600 dark:text-green-400">
                        {waitReduction.toFixed(1)}%
                      </strong>
                      . This could be attributed to more optimized train
                      dispatch or passenger distribution with skip-stop
                      patterns.
                    </li>
                  );
                }
              } else if (
                demandSummaries.avgWaitTime["SKIP-STOP"] >
                demandSummaries.avgWaitTime.REGULAR
              ) {
                const waitIncrease =
                  ((demandSummaries.avgWaitTime["SKIP-STOP"] -
                    demandSummaries.avgWaitTime.REGULAR) /
                    demandSummaries.avgWaitTime["SKIP-STOP"]) *
                  100;
                if (waitIncrease > 1) {
                  findings.push(
                    <li key="waitIncrease">
                      Regular service showed a lower average passenger wait time
                      by{" "}
                      <strong className="text-blue-600 dark:text-blue-400">
                        {waitIncrease.toFixed(1)}%
                      </strong>
                      .
                    </li>
                  );
                }
              }

              // Finding 3: Travel Time Analysis (Contextualized)
              const travelTimeRegular = demandSummaries.avgTravelTime.REGULAR;
              const travelTimeSkipStop =
                demandSummaries.avgTravelTime["SKIP-STOP"];
              if (travelTimeSkipStop < travelTimeRegular) {
                const travelReduction =
                  ((travelTimeRegular - travelTimeSkipStop) /
                    travelTimeRegular) *
                  100;
                findings.push(
                  <li key="travelReduction">
                    The Skip-Stop service achieved a notable reduction in
                    average in-vehicle travel time by{" "}
                    <strong className="text-green-600 dark:text-green-400">
                      {travelReduction.toFixed(1)}%
                    </strong>
                    . This is a primary benefit of trains bypassing certain
                    stations.
                  </li>
                );
              } else if (travelTimeRegular < travelTimeSkipStop) {
                const travelIncrease =
                  ((travelTimeSkipStop - travelTimeRegular) /
                    travelTimeSkipStop) *
                  100;
                findings.push(
                  <li key="travelIncreaseRegular">
                    Regular service offered slightly shorter average in-vehicle
                    travel times by{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {" "}
                      {travelIncrease.toFixed(1)}%
                    </strong>
                    . This might occur if the benefit of all-stops outweighs
                    transfer penalties for the majority of trips in this
                    specific demand profile.
                  </li>
                );
              }

              // Finding 4: Transfer Rate (Contextualized)
              const totalTripsRegular =
                demandSummaries.directTrips.REGULAR +
                demandSummaries.transferTrips.REGULAR;
              const totalTripsSkipStop =
                demandSummaries.directTrips["SKIP-STOP"] +
                demandSummaries.transferTrips["SKIP-STOP"];

              const transferRateRegular =
                totalTripsRegular > 0
                  ? (demandSummaries.transferTrips.REGULAR /
                      totalTripsRegular) *
                    100
                  : 0;
              const transferRateSkipStop =
                totalTripsSkipStop > 0
                  ? (demandSummaries.transferTrips["SKIP-STOP"] /
                      totalTripsSkipStop) *
                    100
                  : 0;

              // The original finding about transfer rates was valid but needed context.
              // Regular service should ideally have 0% train-to-train transfers.
              // Skip-stop will have some.
              if (transferRateSkipStop > 0) {
                findings.push(
                  <li key="transferRateSkipStop">
                    The Skip-Stop service, due to its A/B train patterns,
                    resulted in{" "}
                    <strong className="text-orange-600 dark:text-orange-400">
                      {transferRateSkipStop.toFixed(1)}%
                    </strong>{" "}
                    of trips requiring a train-to-train transfer. The Regular
                    service, being all-stop, inherently has a transfer rate
                    approaching 0% for train-to-train connections.
                  </li>
                );
              }

              // Finding 5: Passenger Throughput
              const totalPassengersRegular =
                processedMetrics.basicMetrics["Total Passengers"]?.REGULAR || 0;
              const totalPassengersSkipStop =
                processedMetrics.basicMetrics["Total Passengers"]?.[
                  "SKIP-STOP"
                ] || 0;

              if (totalPassengersRegular > totalPassengersSkipStop) {
                const diff =
                  ((totalPassengersRegular - totalPassengersSkipStop) /
                    totalPassengersRegular) *
                  100;
                if (diff > 1) {
                  // Only show if meaningful difference
                  findings.push(
                    <li key="throughputRegular">
                      Regular service accommodated{" "}
                      <strong className="text-blue-600 dark:text-blue-400">
                        {diff.toFixed(1)}%
                      </strong>{" "}
                      more completed passenger journeys overall.
                    </li>
                  );
                }
              } else if (totalPassengersSkipStop > totalPassengersRegular) {
                const diff =
                  ((totalPassengersSkipStop - totalPassengersRegular) /
                    totalPassengersSkipStop) *
                  100;
                if (diff > 1) {
                  findings.push(
                    <li key="throughputSkipStop">
                      Skip-Stop service accommodated{" "}
                      <strong className="text-green-600 dark:text-green-400">
                        {diff.toFixed(1)}%
                      </strong>{" "}
                      more completed passenger journeys overall.
                    </li>
                  );
                }
              }

              if (findings.length === 0) {
                findings.push(
                  <li key="noClearDifference">
                    The simulation data does not indicate a strong overall
                    performance advantage for one service type over the other
                    based on the current primary metrics. Further analysis of
                    specific O-D pairs or time periods might reveal more
                    granular differences.
                  </li>
                );
              }

              return findings;
            })()}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricsSummaryTab;
