interface Props {
  /** 0..1 — how much of the bar is lit. */
  fraction: number;
  segments?: number;
  danger?: boolean;
}

export function LedBar({ fraction, segments = 20, danger = false }: Props) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const lit = Math.ceil(clamped * segments);
  return (
    <div
      className={`ledbar ${danger ? 'danger' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      {Array.from({ length: segments }, (_, index) => (
        <i key={index} className={index < lit ? 'on' : ''} />
      ))}
    </div>
  );
}
