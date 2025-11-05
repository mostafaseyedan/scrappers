type SummaryStatProps = {
  title: string;
  value: string;
  helper?: string;
  trend?: number | null;
};

export const SummaryStat = ({
  title,
  value,
  helper,
  trend,
}: SummaryStatProps) => {
  const trendColor =
    trend !== undefined && trend !== null
      ? trend >= 0
        ? "text-green-600"
        : "text-red-600"
      : "";
  const trendIconPath =
    trend !== undefined && trend !== null && trend < 0
      ? "M4 12h16M12 4l8 8-8 8"
      : "M4 12h16M12 4l8 8-8 8";
  const trendRotation =
    trend !== undefined && trend !== null && trend < 0
      ? "rotate-90"
      : "-rotate-90";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-900">{value}</span>
        {helper && <span className="text-xs text-gray-400">{helper}</span>}
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`mt-3 flex items-center text-sm ${trendColor}`}>
          <svg
            className={`mr-1 h-3.5 w-3.5 transform ${trendRotation}`}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d={trendIconPath}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{`${trend >= 0 ? "+" : ""}${trend}% vs prior week`}</span>
        </div>
      )}
    </div>
  );
};
