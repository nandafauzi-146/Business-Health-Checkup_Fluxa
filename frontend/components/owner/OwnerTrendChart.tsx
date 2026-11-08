'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface OwnerTrendPoint {
  label: string
  values: Record<string, number>
}

export interface OwnerTrendSeries {
  key: string
  label: string
  color: string
  axis?: 'primary' | 'secondary'
  formatValue: (value: number) => string
  formatAxisValue?: (value: number) => string
}

interface OwnerTrendChartProps {
  data: OwnerTrendPoint[]
  series: OwnerTrendSeries[]
  ariaLabel: string
  height?: number
  axisFormatter?: (value: number) => string
}

const tooltipStyle = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  color: 'var(--ink)',
  fontSize: 12,
}

export default function OwnerTrendChart({
  data,
  series,
  ariaLabel,
  height = 280,
  axisFormatter = value => String(Math.round(value)),
}: OwnerTrendChartProps) {
  if (data.length === 0 || series.length === 0) return null

  const chartData = data.map(point => ({ label: point.label, ...point.values }))
  const hasSecondaryAxis = series.some(item => item.axis === 'secondary')

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div role="img" aria-label={ariaLabel} style={{ width: '100%', height, minWidth: 0, marginTop: 8 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={height}>
          <AreaChart data={chartData} margin={{ top: 12, right: hasSecondaryAxis ? 8 : 18, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="4 6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--mute)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              tickMargin={8}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="primary"
              orientation="left"
              width={68}
              tickFormatter={axisFormatter}
              tick={{ fill: 'var(--mute)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              allowDataOverflow={false}
            />
            {hasSecondaryAxis && (
              <YAxis
                yAxisId="secondary"
                orientation="right"
                width={52}
                tickFormatter={value => {
                  const secondary = series.find(item => item.axis === 'secondary')
                  return secondary?.formatAxisValue?.(Number(value)) ?? String(Math.round(Number(value)))
                }}
                tick={{ fill: 'var(--mute)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
                allowDataOverflow={false}
              />
            )}
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: 'var(--mute)', marginBottom: 4 }}
              formatter={(value, name) => {
                const item = series.find(entry => entry.label === name)
                return [item?.formatValue(Number(value)) ?? String(value), String(name)]
              }}
            />
            {series.map(item => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                yAxisId={item.axis === 'secondary' ? 'secondary' : 'primary'}
                stroke={item.color}
                strokeWidth={2.5}
                fill={item.color}
                fillOpacity={0.14}
                activeDot={{ r: 5, strokeWidth: 0 }}
                dot={{ r: data.length <= 8 ? 3 : 1.5, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div
        aria-hidden="true"
        style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 20px', marginTop: 4, fontSize: 12, color: 'var(--mute)' }}
      >
        {series.map(item => (
          <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
