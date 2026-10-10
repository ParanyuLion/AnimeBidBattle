interface Props {
  label: string;
  value: string;
  tone?: 'cyan' | 'warn' | 'good' | 'gold';
  size?: 'md' | 'lg' | 'xl';
  flicker?: boolean;
  pulseKey?: string | number;
}

/** An LED-style display in a recessed glass window. */
export function Readout({ label, value, tone = 'cyan', size = 'md', flicker = false, pulseKey }: Props) {
  return (
    <div className={`readout tone-${tone} size-${size} ${flicker ? 'flicker' : ''}`}>
      <span className="readout-label">{label}</span>
      {pulseKey !== undefined ? (
        <span key={pulseKey} className="readout-value pulse">
          {value}
        </span>
      ) : (
        <span className="readout-value">{value}</span>
      )}
    </div>
  );
}
