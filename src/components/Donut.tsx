import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// Donut/ring chart (replaces recharts Pie). Shows `percent` filled in emerald.
export default function Donut({
  percent,
  size = 200,
  stroke = 26,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, percent)) / 100;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Track (pending = rose) */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#f43f5e" strokeWidth={stroke} fill="none" />
        {/* Filled (prepared = emerald) */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#10b981"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled)}
          strokeLinecap="round"
        />
      </Svg>
      <View className="absolute items-center">{children}</View>
    </View>
  );
}
