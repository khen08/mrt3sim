import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface BarChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  colors?: string[];
  showLegend?: boolean;
  showAnimation?: boolean;
  yAxisWidth?: number;
}

export function BarChart({
  data,
  colors = ["#0066CC"],
  showLegend = false,
  showAnimation = true,
  yAxisWidth = 40,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart
        data={data}
        margin={{
          top: 5,
          right: 10,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#666" }}
          tickMargin={8}
        />
        <YAxis
          width={yAxisWidth}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#666" }}
          tickMargin={8}
        />
        <Tooltip
          cursor={{ fill: "#f5f5f5" }}
          contentStyle={{
            background: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
          formatter={(value: number) => [
            `${value.toLocaleString()} passengers`,
            "Volume",
          ]}
          labelFormatter={(label) => `${label}`}
        />
        {showLegend && (
          <Legend
            verticalAlign="top"
            height={36}
            iconSize={10}
            iconType="circle"
          />
        )}
        <Bar
          dataKey="value"
          name="Volume"
          fill={colors[0]}
          radius={[4, 4, 0, 0]}
          isAnimationActive={showAnimation}
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
