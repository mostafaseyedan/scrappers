"use client";

import { stat as StatModel } from "@/app/models";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useEffect, useState } from "react";
import { format as $d, addDays, subDays } from "date-fns";

import styles from "./scraperChart.module.scss";

const chartConfig = {} satisfies ChartConfig;

function generateChartData(statData: Record<string, any>[], endDate: Date) {
  const data = [];
  const dailyStats: Record<string, number> = {};

  for (const stat of statData) {
    if (stat.periodType === "day") {
      const statSegs = stat.key.split("/");
      const dateStr = statSegs[statSegs.length - 1];

      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = 0;
      }

      dailyStats[dateStr] += stat.value || 0;
    }
  }

  for (let day = 0; day < 30; day++) {
    const dayStr = $d(subDays(endDate, day), "yyyy-MM-dd");

    if (!dailyStats[dayStr]) {
      dailyStats[dayStr] = 0;
    }

    dailyStats[dayStr] += dailyStats[dayStr];
  }

  console.log({ dailyStats });

  for (const [dateStr, count] of Object.entries(dailyStats)) {
    data.push({
      date: $d(dateStr, "M/dd"),
      total: count,
    });
  }

  data.sort((a, b) => (a.date > b.date ? 1 : -1));

  return { data };
}

const PursuingChart = () => {
  const [chartData, setChartData] = useState<Record<string, any>[]>([]);

  async function refresh() {
    const startDate = subDays(new Date(), 30);
    const endDate = addDays(new Date(), 1);
    const statData = await StatModel.get({
      sort: "startDate desc",
      limit: 1000,
      filters: {
        parentKey: "updateCnStatusToPursuing",
        periodType: "day",
        startDate: `> ${$d(startDate, "yyyy-MM-dd")} AND < ${$d(
          endDate,
          "yyyy-MM-dd"
        )}`,
      },
    });

    if (statData.results?.length) {
      const { data } = generateChartData(statData.results, endDate);
      console.log({ data });
      setChartData(data);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card className={styles.scraperChart}>
      <CardHeader>
        <CardTitle>Status Updated to Pursuing</CardTitle>
        <CardDescription>last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className={styles.scraperChart_chart}
          config={chartConfig}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 20,
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={true}
              axisLine={true}
              tickMargin={8}
            />
            <Bar dataKey="total" fill={`var(--chart-3`}>
              <LabelList dataKey="total" position="top" fill="#ccc" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { PursuingChart };
