'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-4">
      <p className="font-medium">Something went wrong loading this page.</p>
      <button onClick={reset} className="mt-2 rounded border border-red-400 px-3 py-1 text-sm">
        Try again
      </button>
    </div>
  );
}
