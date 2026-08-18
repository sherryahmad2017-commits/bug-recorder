export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500">
          <span className="h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="text-lg font-semibold text-slate-900">ReproFlow</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
    </div>
  );
}
