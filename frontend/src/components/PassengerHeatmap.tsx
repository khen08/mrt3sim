import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ResponsiveHeatMap, DefaultHeatMapDatum } from "@nivo/heatmap";
import { Tooltip } from "@nivo/tooltip";
import { useTheme } from "next-themes";
import * as React from "react";

// Revert to the structure Nivo types seem to demand: { id: string, data: Datum[] }[]
interface HeatmapDataPoint {
  // Equivalent to Nivo's Datum
  x: string | number; // Destination Station
  y: number; // Demand Value
}

interface HeatmapSeries {
  // Equivalent to Nivo's HeatMapSeries
  id: string; // Origin Station (for indexBy)
  data: HeatmapDataPoint[]; // Data points for this origin
}

// Update props
interface PassengerHeatmapProps {
  data: HeatmapSeries[];
  // destinationStations prop removed
}

export function PassengerHeatmap({ data }: PassengerHeatmapProps) {
  // Remove destinationStations prop passing
  return (
    <div className="w-[1000px] h-[550px] bg-white p-4 rounded-xl justify-center items-center flex">
      <div className="!w-[600px] h-[400px]">
        <HeatmapChart data={data} className="h-full w-full" />
      </div>
    </div>
  );
}

function HeatmapChart({
  data,
  // destinationStations removed
  className,
}: {
  data: HeatmapSeries[];
  className?: string;
}) {
  // Update function signature
  const { theme } = useTheme();

  // Update value calculation based on the new structure
  const values = data
    .flatMap((series) => series.data.map((d) => d.y)) // Access nested data
    .filter((y): y is number => typeof y === "number" && !isNaN(y));

  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 1;

  const nivoTheme = {
    axis: {
      ticks: {
        text: {
          fill: theme === "dark" ? "#a0aec0" : "#4a5568",
          fontSize: 10,
        },
      },
      legend: {
        text: {
          fill: theme === "dark" ? "#cbd5e0" : "#2d3748",
          fontSize: 12,
          fontWeight: 500,
        },
      },
    },
    tooltip: {
      container: {
        background: theme === "dark" ? "#2d3748" : "#ffffff",
        color: theme === "dark" ? "#e2e8f0" : "#1a202c",
        fontSize: "12px",
        borderRadius: "3px",
        boxShadow:
          "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
      },
    },
  };

  // Adjust tooltip for indexBy approach (data structure { id: string, data: {x, y}[] })
  // Nivo cell should contain serieId (origin) and data (the HeatmapDataPoint {x, y})
  const CustomTooltip: React.FC<{
    cell: {
      serieId: string | number;
      data: HeatmapDataPoint;
      value: number | null;
    };
  }> = ({ cell }) => (
    <div
      style={{
        background: nivoTheme.tooltip.container.background,
        color: nivoTheme.tooltip.container.color,
        padding: "6px 9px",
        borderRadius: nivoTheme.tooltip.container.borderRadius,
        boxShadow: nivoTheme.tooltip.container.boxShadow,
        fontSize: nivoTheme.tooltip.container.fontSize,
      }}
    >
      <strong>Origin: {cell.serieId}</strong>
      <br />
      <strong>Destination: {cell.data.x}</strong>
      <br />
      Demand: {cell.value?.toLocaleString() ?? "N/A"}
    </div>
  );

  return (
    <div className={className}>
      <ResponsiveHeatMap
        {...({
          // Cast the entire props object
          data: data, // Data should match Nivo's expected type now
          // keys prop removed
          indexBy: "id", // Index by the 'id' field (origin station)
          margin: { top: 30, right: 130, bottom: 100, left: 130 },
          valueFormat: ">,.0f",
          // Disable the top axis
          axisTop: null,
          axisRight: null,
          // Configure the bottom axis instead
          axisBottom: {
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45, // Keep rotation
            legend: "Destination Station",
            legendPosition: "middle",
            legendOffset: 80, // Positive offset to place below axis
          },
          axisLeft: {
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: "Origin Station",
            legendPosition: "middle",
            legendOffset: -110,
          },
          colors: {
            type: "sequential",
            scheme: "blues",
          },
          emptyColor: "#555555",
          cellBorderWidth: 1,
          cellBorderColor: { from: "color", modifiers: [["darker", 0.4]] },
          legends: [
            {
              anchor: "right",
              translateX: 20,
              translateY: 0,
              length: 300,
              thickness: 10,
              direction: "column",
              tickPosition: "after",
              tickSize: 3,
              tickSpacing: 4,
              tickOverlap: false,
              tickFormat: ">-.2s",
              title: "Passenger Demand →",
              titleAlign: "start",
              titleOffset: -55,
            },
          ],
          // tooltip prop using the adjusted CustomTooltip
          tooltip: ({ cell }: any) => <CustomTooltip cell={cell as any} />, // Keep 'as any' temporarily
          theme: nivoTheme,
        } as any)} // <--- Add type assertion here
      />
    </div>
  );
}
