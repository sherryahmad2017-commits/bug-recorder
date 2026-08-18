import { Button } from './Button';

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="shrink-0">
          Retry
        </Button>
      )}
    </div>
  );
}
