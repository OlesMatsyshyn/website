"use client";

import { type ReactNode } from "react";

export type MeasurementCardMode = "trend" | "averages";

export function MeasurementCard({
  actions,
  entryPanel,
  graphHeader,
  graphPanel,
  mode,
  onModeChange,
  primaryLabel,
  title,
}: {
  actions: ReactNode;
  entryPanel: ReactNode;
  graphHeader?: ReactNode;
  graphPanel: ReactNode;
  mode: MeasurementCardMode;
  onModeChange: (mode: MeasurementCardMode) => void;
  primaryLabel: string;
  title: string;
}) {
  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-950">{title}</h2>
          <p className="mt-1 text-sm text-stone-500">Primary: {primaryLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>

      <div className="mt-4 grid min-w-0 gap-[var(--wc-grid-gap)] lg:grid-cols-[minmax(15rem,0.38fr)_minmax(0,0.62fr)]">
        <div className="min-w-0 rounded-[var(--wc-card-radius)] bg-stone-50 p-[var(--wc-card-padding)]">
          {entryPanel}
        </div>
        <div className="min-w-0 rounded-[var(--wc-card-radius)] border border-stone-200 p-[var(--wc-card-padding)]">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{graphHeader}</div>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1">
              {(["trend", "averages"] as const).map((option) => (
                <button
                  aria-pressed={mode === option}
                  className={`min-h-9 rounded px-3 text-sm font-semibold ${
                    mode === option
                      ? "bg-white text-stone-950 shadow-sm"
                      : "text-stone-600"
                  }`}
                  key={option}
                  onClick={() => onModeChange(option)}
                  type="button"
                >
                  {option === "trend" ? "Trend" : "Averages"}
                </button>
              ))}
            </div>
          </div>
          {graphPanel}
        </div>
      </div>
    </section>
  );
}
