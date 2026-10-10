interface Props {
  label: string;
  value: string;
  tone?: 'cyan' | 'warn' | 'good' | 'gold';
  size?: 'md' | 'lg';
  flicker?: boolean;
}

/** An LED-style display in a recessed glass window. */
export function Readout({ label, value, tone = 'cyan', size = 'md', flicker = false }: Props) {
  return (
    <div className={`readout tone-${tone} size-${size} ${flicker ? 'flicker' : ''}`}>
      <span className="readout-label">{label}</span>
      <span className="readout-value">{value}</span>
    </div>
  );
}
