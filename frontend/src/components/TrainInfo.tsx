"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconTrain, // Re-use train icon
  IconMapPin, // Keep for station name
  IconClock, // For scheduled time
  IconUsers, // For load
  IconInfoCircle, // General info?
  IconArrowUp, // Correct icon for Northbound
  IconArrowDown, // Correct icon for Southbound
  IconRoute, // For Status
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";

// Match the interface defined in page.tsx
interface TrainInfoData {
  id: number;
  direction: "northbound" | "southbound";
  status: string;
  load: number; // Hardcoded 0 for now
  capacity: number;
  relevantStationName: string | null;
  scheduledTime: string | null;
}

const TrainInfo = ({
  // Use the interface name for props
  id,
  direction,
  status,
  load,
  capacity,
  relevantStationName,
  scheduledTime,
}: TrainInfoData) => {
  const directionColor =
    direction === "northbound" ? "text-red-600" : "text-blue-600";
  const directionBg = direction === "northbound" ? "bg-red-100" : "bg-blue-100";
  const directionDarkBg =
    direction === "northbound" ? "dark:bg-red-900/30" : "dark:bg-blue-900/30";

  return (
    <Card>
      <CardHeader className="bg-gray-700 text-white p-3">
        {" "}
        {/* Darker header for trains */}
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center">
              <IconTrain className="mr-2" size={20} />
              Train {id}
            </CardTitle>
            <CardDescription className="text-gray-300 mt-0.5">
              Details & Status
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`border-none text-xs px-1.5 py-0.5 ${directionColor} ${directionBg} ${directionDarkBg}`}
          >
            {/* Render icon conditionally inline */}
            {direction === "northbound" ? (
              <IconArrowUp size={12} className="mr-1" /> // Use correct icon
            ) : (
              <IconArrowDown size={12} className="mr-1" /> // Use correct icon
            )}
            {direction.charAt(0).toUpperCase() + direction.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Column 1: Status & Location */}
        <div className="space-y-3">
          <div className="flex items-center text-sm">
            <IconRoute className="mr-2 text-gray-500" size={16} />
            <span className="text-gray-600 dark:text-gray-400 mr-2">
              Status:
            </span>
            <span className="font-medium text-gray-800 dark:text-gray-100">
              {status}
            </span>
          </div>

          <div className="flex items-center text-sm">
            <IconMapPin className="mr-2 text-gray-500" size={16} />
            <span className="text-gray-600 dark:text-gray-400 mr-2">
              {status.includes("Transit") ? "Next Stop:" : "Location:"}
            </span>
            <span className="font-medium text-gray-800 dark:text-gray-100">
              {relevantStationName ?? "N/A"}
            </span>
          </div>
        </div>

        {/* Column 2: Load & Time */}
        <div className="space-y-3">
          <div className="flex items-center text-sm">
            <IconUsers className="mr-2 text-gray-500" size={16} />
            <span className="text-gray-600 dark:text-gray-400 mr-2">Load:</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">
              {load} / {capacity}
            </span>
          </div>

          <div className="flex items-center text-sm">
            <IconClock className="mr-2 text-gray-500" size={16} />
            <span className="text-gray-600 dark:text-gray-400 mr-2">
              {status.includes("Transit") ? "ETA:" : "Scheduled:"}
            </span>
            <span className="font-medium text-gray-800 dark:text-gray-100">
              {scheduledTime ?? "N/A"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrainInfo;
