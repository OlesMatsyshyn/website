"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <section className="rounded-md border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-stone-950">
          Something went wrong while loading this page.
        </h1>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="grid min-h-11 place-items-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800"
            href="/"
          >
            Return to Today
          </Link>
        </div>
      </section>
    </div>
  );
}
