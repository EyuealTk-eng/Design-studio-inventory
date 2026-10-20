/** Shown instantly when you click a link, while the page's data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 flex flex-col gap-3">
        <div className="skeleton h-9 w-64 max-w-full" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton h-10 w-10 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="skeleton h-4" style={{ width: `${70 - i * 6}%` }} />
              <div className="skeleton h-3" style={{ width: `${45 - i * 3}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
