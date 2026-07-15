interface PLBadgeProps {
  value: number;
  prefix?: string;
  className?: string;
}

export default function PLBadge({ value, prefix = '$', className = '' }: PLBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const formatted = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = isPositive ? '+' : isNegative ? '-' : '';
  const colorClass = isPositive ? 'pl-positive' : isNegative ? 'pl-negative' : 'pl-zero';

  return (
    <span className={`tabular ${colorClass} ${className}`}>
      {sign}{prefix}{formatted}
    </span>
  );
}
