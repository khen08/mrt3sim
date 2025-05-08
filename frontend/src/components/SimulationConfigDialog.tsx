"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  IconInfoCircle,
  IconLoader2,
  IconTrain,
  IconRulerMeasure,
  IconClock,
  IconSettings,
  IconRoute,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { formatFileName } from "@/lib/utils";

type Station = {
  name: string;
  scheme: string;
  distance: number;
};

type TrainSpecs = {
  maxCapacity: number;
  acceleration: number;
  deceleration: number;
  cruisingSpeed: number;
  passthroughSpeed: number;
};

type ServicePeriod = {
  NAME: string;
  START_HOUR: number;
  TRAIN_COUNT: number;
};

type SimulationConfig = {
  simulationId: number;
  name?: string;
  stations?: Station[];
  schemeType?: "REGULAR" | "SKIP-STOP";
  schemePattern?: string[];
  dwellTime?: number;
  turnaroundTime?: number;
  trainSpecs?: TrainSpecs;
  servicePeriods?: ServicePeriod[];
  simulatePassengers?: boolean;
  passengerDataFile?: string;
  timeIntervalSeconds?: number;
  createdAt?: string;
  runTime?: number;
  startTime?: string;
  endTime?: string;
  [key: string]: any;
};

interface SimulationConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  config: SimulationConfig | null;
  isLoading: boolean;
}

export function SimulationConfigDialog({
  isOpen,
  onClose,
  onConfirm,
  config,
  isLoading,
}: SimulationConfigDialogProps) {
  if (!config && !isLoading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-fit">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>Simulation #{config?.simulationId}</span>
            {config?.name && (
              <Badge variant="outline" className="ml-2">
                {config.name}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review the configuration before loading this simulation.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading configuration...</span>
          </div>
        ) : config ? (
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-4 pr-4">
              {/* Basic Information */}
              <Card>
                <CardContent className="pt-6 pb-4">
                  <CardTitle className="text-sm font-medium mb-4 flex items-center">
                    <IconInfoCircle className="mr-2 h-4 w-4" /> Basic
                    Information
                  </CardTitle>

                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <span className="font-medium text-muted-foreground">
                      Simulation Type:
                    </span>
                    <span>
                      {config.simulatePassengers ? (
                        <Badge variant="default">Passenger + Train</Badge>
                      ) : (
                        <Badge variant="outline">Train Only</Badge>
                      )}
                    </span>

                    {config.passengerDataFile && (
                      <>
                        <span className="font-medium text-muted-foreground">
                          Data File:
                        </span>
                        <span
                          className="truncate"
                          title={config.passengerDataFile}
                        >
                          {formatFileName(config.passengerDataFile)}
                        </span>
                      </>
                    )}

                    <span className="font-medium text-muted-foreground">
                      Scheme Type:
                    </span>
                    <span>
                      <Badge
                        variant={
                          config.schemeType === "REGULAR"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {config.schemeType || "REGULAR"}
                      </Badge>
                    </span>

                    {config.timeIntervalSeconds && (
                      <>
                        <span className="font-medium text-muted-foreground">
                          Time Interval:
                        </span>
                        <span>{config.timeIntervalSeconds} seconds</span>
                      </>
                    )}

                    <span className="font-medium text-muted-foreground">
                      Dwell Time:
                    </span>
                    <span>{config.dwellTime} seconds</span>

                    {config.createdAt && (
                      <>
                        <span className="font-medium text-muted-foreground">
                          Created At:
                        </span>
                        <span>
                          {new Date(config.createdAt).toLocaleString()}
                        </span>
                      </>
                    )}

                    <span className="font-medium text-muted-foreground">
                      Turnaround Time:
                    </span>
                    <span>{config.turnaroundTime} seconds</span>

                    {config.runTime && (
                      <>
                        <span className="font-medium text-muted-foreground">
                          Run Time:
                        </span>
                        <span>{config.runTime.toFixed(2)} seconds</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Train Specifications */}
              {config.trainSpecs && (
                <Card>
                  <CardContent className="pt-6 pb-4">
                    <CardTitle className="text-sm font-medium mb-3 flex items-center">
                      <IconTrain className="mr-2 h-4 w-4" /> Train
                      Specifications
                    </CardTitle>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex flex-col items-center border rounded-md p-2">
                        <span className="text-xs text-muted-foreground">
                          Max Capacity
                        </span>
                        <span className="font-medium">
                          {config.trainSpecs.maxCapacity} pax
                        </span>
                      </div>
                      <div className="flex flex-col items-center border rounded-md p-2">
                        <span className="text-xs text-muted-foreground">
                          Cruising Speed
                        </span>
                        <span className="font-medium">
                          {config.trainSpecs.cruisingSpeed} km/h
                        </span>
                      </div>
                      <div className="flex flex-col items-center border rounded-md p-2">
                        <span className="text-xs text-muted-foreground">
                          Passthrough
                        </span>
                        <span className="font-medium">
                          {config.trainSpecs.passthroughSpeed} km/h
                        </span>
                      </div>
                      <div className="flex flex-col items-center border rounded-md p-2">
                        <span className="text-xs text-muted-foreground">
                          Acceleration
                        </span>
                        <span className="font-medium">
                          {config.trainSpecs.acceleration} m/s²
                        </span>
                      </div>
                      <div className="flex flex-col items-center border rounded-md p-2">
                        <span className="text-xs text-muted-foreground">
                          Deceleration
                        </span>
                        <span className="font-medium">
                          {config.trainSpecs.deceleration} m/s²
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Service Periods */}
              {config.servicePeriods && config.servicePeriods.length > 0 && (
                <Card>
                  <CardContent className="pt-6 pb-4">
                    <CardTitle className="text-sm font-medium mb-3 flex items-center">
                      <IconCalendarEvent className="mr-2 h-4 w-4" /> Service
                      Periods
                    </CardTitle>
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                        <div className="col-span-6">Period Name</div>
                        <div className="col-span-3">Start Hour</div>
                        <div className="col-span-3">Train Count</div>
                      </div>
                      <Separator />
                      {config.servicePeriods.map((period, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-2 text-sm"
                        >
                          <div className="col-span-6">{period.NAME}</div>
                          <div className="col-span-3">
                            {period.START_HOUR}:00
                          </div>
                          <div className="col-span-3">
                            {period.TRAIN_COUNT}
                            <span className="text-xs text-muted-foreground ml-1">
                              train{period.TRAIN_COUNT !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Station Configuration */}
              {config.stations && config.stations.length > 0 && (
                <Card>
                  <CardContent className="pt-6 pb-4">
                    <CardTitle className="text-sm font-medium mb-3 flex items-center">
                      <IconRoute className="mr-2 h-4 w-4" /> Station
                      Configuration
                    </CardTitle>
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Name</div>
                        <div className="col-span-3">Scheme</div>
                        <div className="col-span-3">Distance (km)</div>
                      </div>
                      <Separator />
                      {config.stations.map((station, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-2 text-sm"
                        >
                          <div className="col-span-1">{index + 1}</div>
                          <div className="col-span-5">{station.name}</div>
                          <div className="col-span-3">
                            <Badge
                              variant={
                                station.scheme === "AB"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {station.scheme}
                            </Badge>
                          </div>
                          <div className="col-span-3">
                            {index === 0 ? "-" : station.distance}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="mt-3 p-3 bg-muted/50 rounded-md flex items-start gap-2 text-xs">
                <IconInfoCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p>
                  Loading this simulation will reset the current state and
                  visualization settings.
                </p>
              </div>
            </div>
          </ScrollArea>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading || !config}>
            Load Simulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
