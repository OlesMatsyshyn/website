function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatValue(value: number | null, digits = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

export function ProgressRing({
  isEstimated = false,
  isIncomplete = false,
  kind,
  label,
  secondaryText,
  target,
  unit,
  value,
  valueDigits = 0,
}: {
  isEstimated?: boolean;
  isIncomplete?: boolean;
  kind: "neutral" | "goal" | "limit";
  label: string;
  secondaryText?: string;
  target: number | null;
  unit: string;
  value: number | null;
  valueDigits?: number;
}) {
  const safeValue = finiteNumber(value);
  const safeTarget = finiteNumber(target);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const ratio =
    safeValue !== null && safeTarget !== null && safeTarget > 0
      ? safeValue / safeTarget
      : 0;
  const visualRatio = clamp(ratio, 0, 1);
  const dashOffset = circumference * (1 - visualRatio);
  const limitExceeded = kind === "limit" && safeValue !== null && safeTarget !== null && safeValue > safeTarget;
  const nearLimit = kind === "limit" && ratio >= 0.75;
  const strokeClass = limitExceeded
    ? "stroke-red-600"
    : nearLimit
      ? "stroke-amber-600"
      : kind === "neutral"
        ? "stroke-stone-700"
        : "stroke-[var(--accent)]";
  const meaning =
    kind === "limit"
      ? "Upper limit"
      : kind === "goal"
        ? "Daily target"
        : "Daily reference";
  const valueText = formatValue(safeValue, valueDigits);
  const targetText = safeTarget === null ? "—" : formatValue(safeTarget, valueDigits);
  const percent =
    safeValue !== null && safeTarget !== null && safeTarget > 0
      ? Math.round((safeValue / safeTarget) * 100)
      : null;
  const remaining =
    safeValue !== null && safeTarget !== null ? safeTarget - safeValue : null;
  const primaryStatus =
    kind === "limit"
      ? remaining === null
        ? "No limit saved"
        : remaining >= 0
          ? `${formatValue(remaining, valueDigits)} ${unit} remaining`
          : `${formatValue(Math.abs(remaining), valueDigits)} ${unit} over limit`
      : kind === "goal"
        ? percent === null
          ? "No target saved"
          : `${percent}% of daily target`
        : percent === null
          ? "No reference saved"
          : `${percent}% of daily reference`;
  const badges = [
    isEstimated ? "Approximate" : "",
    isIncomplete ? "Known total" : "",
  ].filter(Boolean);

  return (
    <article
      aria-label={`${label}: ${valueText} ${unit} of ${targetText} ${unit}. ${meaning}. ${primaryStatus}${
        badges.length > 0 ? `. ${badges.join(". ")}` : ""
      }`}
      className="wc-card flex min-h-64 flex-col border border-stone-200 bg-white"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-950">{label}</h2>
          <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">
            {meaning}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center justify-center">
        <div className="relative grid h-28 w-28 place-items-center sm:h-32 sm:w-32">
          <svg
            aria-hidden="true"
            className="h-full w-full -rotate-90"
            viewBox="0 0 104 104"
          >
            <circle
              className="stroke-stone-100"
              cx="52"
              cy="52"
              fill="none"
              r={radius}
              strokeWidth="10"
            />
            <circle
              className={strokeClass}
              cx="52"
              cy="52"
              fill="none"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth="10"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-semibold leading-none text-stone-950">
                {valueText}
              </p>
              <p className="mt-1 text-xs font-semibold text-stone-500">{unit}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-stone-700">
          of {targetText} {unit}
        </p>
        {secondaryText && (
          <p className="mt-1 text-center text-xs text-stone-500">{secondaryText}</p>
        )}
      </div>

      <div className="mt-3">
        <p className="text-sm text-stone-600">{primaryStatus}</p>
        {badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span
                className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600"
                key={badge}
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
