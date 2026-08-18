export function Spinner({ label }: { label: string }) {
  return (
    <div className="rf-spinner" role="status">
      <span className="rf-spin" aria-hidden="true" />
      {label}
    </div>
  );
}
