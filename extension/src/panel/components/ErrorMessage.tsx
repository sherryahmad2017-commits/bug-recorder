export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rf-error" role="alert">
      {message}
    </div>
  );
}
