"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { scriptLog as scriptLogModel } from "@/app/models";

type WeeklyDataPoint = {
  week: string;
  count: number;
};

const EmptyState = ({ message }: { message: string }) => (
  <div
    className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500"
    style={{ minHeight: 224 }}
  >
    {message}
  </div>
);

export const WeeklyActivityChart = () => {
  const [data, setData] = useState<WeeklyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allLogs = await scriptLogModel.get({
          limit: 1000,
          sort: "created desc",
        });

        // Use ALL logs, no date filtering
        const recentLogs = allLogs.results || [];

        // Group by week
        const weeklyData: Record<string, number> = {};

        recentLogs.forEach((log: any) => {
          const date = new Date(log.created);
          // Get week start (Sunday)
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          const weekLabel = weekStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          weeklyData[weekLabel] = (weeklyData[weekLabel] || 0) + 1;
        });

        // Convert to array and sort
        const chartData = Object.entries(weeklyData)
          .map(([week, count]) => ({ week, count }))
          .sort((a, b) => {
            const dateA = new Date(a.week + " 2024");
            const dateB = new Date(b.week + " 2024");
            return dateA.getTime() - dateB.getTime();
          });

        setData(chartData);
      } catch (error) {
        console.error("Failed to fetch weekly activity data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const hasActivity = data.some((point) => point.count > 0);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex h-72 items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Weekly Activity
          </h3>
          <p className="text-sm text-gray-500">
            Scraping jobs per week (all time)
          </p>
        </div>
      </div>

      {hasActivity ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 5,
                left: 20,
                bottom: 20,
              }}
            >
              <CartesianGrid
                stroke="#E5E7EB"
                strokeDasharray="6 6"
                vertical={false}
              />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickMargin={15}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickMargin={15}
              />
              <Tooltip
                cursor={{ stroke: "#93C5FD", strokeWidth: 1 }}
                contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
                formatter={(value: number) => [`${value} jobs`, "Count"]}
                labelFormatter={(label: string) => `Week of ${label}`}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState message="No scraping activity recorded." />
        </div>
      )}
    </div>
  );
};
