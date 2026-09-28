import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_PROPS, CATEGORICAL, CHART_COLORS, ChartEmpty, ChartTooltip } from './ChartKit';
import { formatCurrency } from '../../lib/format';

// One decimal keeps adjacent ticks distinct — at 0 decimals 1,050 and 1,237 both render as "$1K".
const compact = (value: number) => formatCurrency(value, { compact: true, decimals: 1 });

export function ExpenseTrendChart({
  data,
  height = 220,
}: {
  data: { label: string; amount: number }[];
  height?: number;
}) {
  if (!data?.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-expense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.4} />
            <stop offset="100%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} tickFormatter={compact} width={62} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.gold, strokeOpacity: 0.3 }} />
        <Area
          type="monotone"
          dataKey="amount"
          name="Expenses"
          stroke={CHART_COLORS.gold}
          strokeWidth={2.2}
          fill="url(#grad-expense)"
          dot={{ r: 3, fill: CHART_COLORS.gold, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueVsExpensesChart({
  data,
  height = 240,
  seriesNames = { revenue: 'Revenue', expenses: 'Expenses' },
}: {
  data: { label: string; revenue: number; expenses: number }[];
  height?: number;
  seriesNames?: { revenue: string; expenses: string };
}) {
  if (!data?.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={6}>
        <defs>
          <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.positive} stopOpacity={0.95} />
            <stop offset="100%" stopColor={CHART_COLORS.positive} stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="grad-exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.95} />
            <stop offset="100%" stopColor={CHART_COLORS.gold} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} tickFormatter={compact} width={62} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis, paddingTop: 8 }}
        />
        <Bar dataKey="revenue" name={seriesNames.revenue} fill="url(#grad-rev)" radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={800} />
        <Bar dataKey="expenses" name={seriesNames.expenses} fill="url(#grad-exp)" radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPieChart({
  data,
  height = 260,
}: {
  data: { category: string; amount: number }[];
  height?: number;
}) {
  if (!data?.length) return <ChartEmpty />;
  const top = data.slice(0, 9);
  const rest = data.slice(9).reduce((sum, d) => sum + d.amount, 0);
  const series = rest > 0 ? [...top, { category: 'Other', amount: rest }] : top;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={series}
          dataKey="amount"
          nameKey="category"
          innerRadius="52%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="none"
          animationDuration={800}
        >
          {series.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          layout="horizontal"
          wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis, paddingTop: 10 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RevenueTrendChart({
  data,
  height = 260,
}: {
  data: { label: string; projected: number; received: number }[];
  height?: number;
}) {
  if (!data?.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} tickFormatter={compact} width={62} />
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis, paddingTop: 8 }} />
        <Line
          type="monotone"
          dataKey="projected"
          name="Projected"
          stroke={CHART_COLORS.navy}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 3 }}
          animationDuration={800}
        />
        <Line
          type="monotone"
          dataKey="received"
          name="Received"
          stroke={CHART_COLORS.gold}
          strokeWidth={2.4}
          dot={{ r: 3.5 }}
          animationDuration={900}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BudgetHistoryChart({
  data,
  height = 240,
}: {
  data: { label: string; budget: number; spent: number }[];
  height?: number;
}) {
  if (!data?.length) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} tickFormatter={compact} width={62} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: CHART_COLORS.axis, paddingTop: 8 }} />
        <Bar dataKey="spent" name="Spent" radius={[5, 5, 0, 0]} maxBarSize={22} animationDuration={800}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.budget > 0 && entry.spent / entry.budget > 0.9
                  ? CHART_COLORS.danger
                  : entry.budget > 0 && entry.spent / entry.budget >= 0.7
                    ? CHART_COLORS.warning
                    : CHART_COLORS.positive
              }
            />
          ))}
        </Bar>
        <Line type="monotone" dataKey="budget" name="Budget" stroke={CHART_COLORS.gold} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
