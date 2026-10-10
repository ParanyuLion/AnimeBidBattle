import type { ErrorPayload } from '@abb/shared';

export function ErrorBanner({ error, onDismiss }: { error: ErrorPayload | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div className="banner error" role="alert">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <span>{error.message}</span>
        <button className="secondary" onClick={onDismiss} aria-label="Dismiss error">
          OK
        </button>
      </div>
    </div>
  );
}
