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
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { format as $d, addDays, subDays } from "date-fns";

import styles from "./pursuingChart.module.scss";

const chartConfig = {} satisfies ChartConfig;

function generateChartData(
  statData: Record<string, any>[],
  endDate: Date,
  days: number
) {
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

  for (let day = 0; day < days; day++) {
    const dayStr = $d(subDays(endDate, day), "yyyy-MM-dd");

    if (!dailyStats[dayStr]) {
      dailyStats[dayStr] = 0;
    }

    dailyStats[dayStr] += dailyStats[dayStr];
  }

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
  const [days, setDays] = useState<number>(30);

  async function refresh() {
    const startDate = subDays(new Date(), days);
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
      const { data } = generateChartData(statData.results, endDate, days);
      setChartData(data);
    }
  }

  useEffect(() => {
    refresh();
  }, [days]);

  return (
    <Card className={styles.pursuingChart}>
      <CardHeader>
        <CardTitle>Status Updated to Pursuing</CardTitle>
        <CardDescription className={styles.pursuingChart_cardDescription}>
          last{" "}
          <Select
            value={days.toString()}
            onValueChange={(value) => setDays(Number(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="60">60</SelectItem>
            </SelectContent>
          </Select>{" "}
          days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className={styles.pursuingChart_chart}
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
            <Bar dataKey="total" fill={`var(--chart-3)`}>
              <LabelList
                dataKey="total"
                position="top"
                fill="#ccc"
                content={(props: any) => {
                  const { value, x, y, width } = props;
                  if (!value) return null; // hide when total is 0 or falsy
                  const cx =
                    typeof x === "number" && typeof width === "number"
                      ? x + width / 2
                      : x;
                  return (
                    <text x={cx} y={y - 4} fill="#ccc" textAnchor="middle">
                      {value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { PursuingChart };
