import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ResponsiveHeatMap } from "@nivo/heatmap";
import { ResponsiveLine } from "@nivo/line";

export default function Component() {
  return (
    <Card className="h-full w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Sales Performance Heatmap</CardTitle>
        <CardDescription>
          This heatmap shows the sales performance across different regions and
          product categories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-10 gap-1">
          <div className="col-span-8 row-span-8">
            <HeatmapChart className="aspect-[4/3]" />
          </div>
          <div className="col-span-2 row-span-4 flex flex-col items-start gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#0077b6]" />
              <span className="text-sm">Low Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#ffa500]" />
              <span className="text-sm">Average Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#ff0000]" />
              <span className="text-sm">High Sales</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapChart(props: any) {
  return (
    <div {...props}>
      <ResponsiveHeatMap
        data={[
          {
            id: "A",
            data: [
              {
                x: "1",
                y: 4415,
              },
              {
                x: "2",
                y: -59456,
              },
              {
                x: "3",
                y: -79886,
              },
              {
                x: "4",
                y: 14478,
              },
              {
                x: "5",
                y: -63874,
              },
              {
                x: "6",
                y: -47542,
              },
              {
                x: "7",
                y: 16635,
              },
              {
                x: "8",
                y: -30278,
              },
              {
                x: "9",
                y: -95178,
              },
            ],
          },
          {
            id: "B",
            data: [
              {
                x: "1",
                y: 41241,
              },
              {
                x: "2",
                y: -77516,
              },
              {
                x: "3",
                y: -19422,
              },
              {
                x: "4",
                y: 61220,
              },
              {
                x: "5",
                y: -65044,
              },
              {
                x: "6",
                y: -59254,
              },
              {
                x: "7",
                y: 9299,
              },
              {
                x: "8",
                y: -58470,
              },
              {
                x: "9",
                y: 51828,
              },
            ],
          },
          {
            id: "C",
            data: [
              {
                x: "1",
                y: 94426,
              },
              {
                x: "2",
                y: 31248,
              },
              {
                x: "3",
                y: -15766,
              },
              {
                x: "4",
                y: 22271,
              },
              {
                x: "5",
                y: 86246,
              },
              {
                x: "6",
                y: -23717,
              },
              {
                x: "7",
                y: 97595,
              },
              {
                x: "8",
                y: -69800,
              },
              {
                x: "9",
                y: 74453,
              },
            ],
          },
          {
            id: "D",
            data: [
              {
                x: "1",
                y: -49899,
              },
              {
                x: "2",
                y: 13864,
              },
              {
                x: "3",
                y: -45673,
              },
              {
                x: "4",
                y: -20270,
              },
              {
                x: "5",
                y: 99430,
              },
              {
                x: "6",
                y: 17283,
              },
              {
                x: "7",
                y: -6514,
              },
              {
                x: "8",
                y: -21766,
              },
              {
                x: "9",
                y: -52610,
              },
            ],
          },
          {
            id: "E",
            data: [
              {
                x: "1",
                y: 81123,
              },
              {
                x: "2",
                y: -25153,
              },
              {
                x: "3",
                y: 2577,
              },
              {
                x: "4",
                y: 24409,
              },
              {
                x: "5",
                y: 82923,
              },
              {
                x: "6",
                y: 51283,
              },
              {
                x: "7",
                y: 10208,
              },
              {
                x: "8",
                y: 4055,
              },
              {
                x: "9",
                y: -14699,
              },
            ],
          },
        ]}
        margin={{ top: 0, right: 10, bottom: 30, left: 30 }}
        axisTop={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 16,
        }}
        colors={{
          type: "sequential",
          scheme: "blue_green",
        }}
        theme={{
          tooltip: {
            chip: {
              borderRadius: "9999px",
            },
            container: {
              fontSize: "12px",
              textTransform: "capitalize",
              borderRadius: "6px",
            },
          },
        }}
        role="application"
        ariaLabel="A heatmap chart/matrix"
      />
    </div>
  );
}

function LineChart(props: any) {
  return (
    <div {...props}>
      <ResponsiveLine
        data={[
          {
            id: "Desktop",
            data: [
              { x: "Jan", y: 43 },
              { x: "Feb", y: 137 },
              { x: "Mar", y: 61 },
              { x: "Apr", y: 145 },
              { x: "May", y: 26 },
              { x: "Jun", y: 154 },
            ],
          },
          {
            id: "Mobile",
            data: [
              { x: "Jan", y: 60 },
              { x: "Feb", y: 48 },
              { x: "Mar", y: 177 },
              { x: "Apr", y: 78 },
              { x: "May", y: 96 },
              { x: "Jun", y: 204 },
            ],
          },
        ]}
        margin={{ top: 10, right: 10, bottom: 40, left: 40 }}
        xScale={{
          type: "point",
        }}
        yScale={{
          type: "linear",
        }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
        }}
        axisLeft={{
          tickSize: 0,
          tickValues: 5,
          tickPadding: 16,
        }}
        colors={["#2563eb", "#e11d48"]}
        pointSize={6}
        useMesh={true}
        gridYValues={6}
        theme={{
          tooltip: {
            chip: {
              borderRadius: "9999px",
            },
            container: {
              fontSize: "12px",
              textTransform: "capitalize",
              borderRadius: "6px",
            },
          },
          grid: {
            line: {
              stroke: "#f3f4f6",
            },
          },
        }}
        role="application"
      />
    </div>
  );
}
