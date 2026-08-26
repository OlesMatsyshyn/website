"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  MeasurementCard,
  type MeasurementCardMode,
} from "@/components/measurement-card";
import { PageHeader } from "@/components/page-header";
import { ToastBridge } from "@/components/toast";
import { currentLocalTime, localDateKey, makeId } from "@/lib/food-log";
import {
  dayDifference,
  defaultMeasurementVariable,
  deleteMeasurementReading,
  enabledMeasurementVariables,
  formatShortDate,
  makeMeasurementReading,
  measurementColours,
  migrateMeasurementsV1,
  normalizeMeasurementVariables,
  primaryMeasurementVariable,
  readingsForVariable,
  saveMeasurementReadings,
  saveMeasurementVariables,
  upsertMeasurementReading,
  type MeasurementReading,
  type MeasurementVariable,
} from "@/lib/weight";

type ReadingDraft = {
  date: string;
  note: string;
  time: string;
  value: string;
};

type VariableDraft = {
  colourKey: MeasurementVariable["colourKey"];
  defaultTime: string;
  markerShape: MeasurementVariable["markerShape"];
  name: string;
  primary: boolean;
  unit: string;
};

const colourOptions: MeasurementVariable["colourKey"][] = [
  "amber",
  "blue",
  "green",
  "violet",
  "neutral",
];

const markerShapeOptions: MeasurementVariable["markerShape"][] = [
  "circle",
  "square",
  "triangle",
  "diamond",
];

function formatMeasurement(value: number | null | undefined, unit: string) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`
    : "—";
}

function formatChange(value: number | undefined, unit: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} ${unit}`;
}

function shapeLabel(shape: MeasurementVariable["markerShape"]) {
  return shape[0].toUpperCase() + shape.slice(1);
}

type ChartPoint = {
  date: string;
  time: string;
  value: number;
  x: number;
  y: number;
};

function markerForPoint({
  colour,
  onActivate,
  point,
  shape,
}: {
  colour: string;
  onActivate: () => void;
  point: ChartPoint;
  shape: MeasurementVariable["markerShape"];
}) {
  const common = {
    className: "cursor-pointer outline-none",
    fill: colour,
    onClick: onActivate,
    onFocus: onActivate,
    onMouseEnter: onActivate,
    role: "button",
    stroke: "#ffffff",
    strokeWidth: 2,
    tabIndex: 0,
  };

  if (shape === "square") {
    return <rect {...common} height="10" width="10" x={point.x - 5} y={point.y - 5} />;
  }
  if (shape === "triangle") {
    return (
      <polygon
        {...common}
        points={`${point.x},${point.y - 6} ${point.x - 6},${point.y + 5} ${point.x + 6},${point.y + 5}`}
      />
    );
  }
  if (shape === "diamond") {
    return (
      <polygon
        {...common}
        points={`${point.x},${point.y - 7} ${point.x - 7},${point.y} ${point.x},${point.y + 7} ${point.x + 7},${point.y}`}
      />
    );
  }

  return <circle {...common} cx={point.x} cy={point.y} r="5" />;
}

function TrendChart({
  readings,
  variable,
}: {
  readings: MeasurementReading[];
  variable: MeasurementVariable;
}) {
  const [activePoint, setActivePoint] = useState<ChartPoint | null>(null);
  const variableReadings = readingsForVariable(readings, variable.id).slice(-30);

  if (variableReadings.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-md bg-stone-50 px-6 text-center text-sm text-stone-500">
        <p className="font-semibold text-stone-700">
          No {variable.name.toLowerCase()} readings yet.
        </p>
        <p className="mt-1">Save a snapshot to begin its history.</p>
      </div>
    );
  }

  const width = 680;
  const height = 250;
  const padding = { top: 28, right: 28, bottom: 58, left: 58 };
  const dateKeys = [...new Set(variableReadings.map((reading) => reading.date))].sort();
  const values = variableReadings.map((reading) => reading.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin;
  const minimumRange = rawRange === 0 ? 1 : Math.max(rawRange, 1);
  const midpoint = (rawMin + rawMax) / 2;
  const displayMin = rawRange === 0 ? rawMin - 0.5 : midpoint - minimumRange / 2;
  const displayMax = rawRange === 0 ? rawMax + 0.5 : midpoint + minimumRange / 2;
  const xSpan = width - padding.left - padding.right;
  const ySpan = height - padding.top - padding.bottom;
  const xForDate = (date: string) => {
    const index = dateKeys.indexOf(date);
    return dateKeys.length === 1
      ? padding.left + xSpan / 2
      : padding.left + (index / (dateKeys.length - 1)) * xSpan;
  };
  const yForValue = (value: number) =>
    padding.top + ((displayMax - value) / (displayMax - displayMin)) * ySpan;
  const gridValues = [0, 1, 2, 3].map(
    (index) => displayMin + ((displayMax - displayMin) * index) / 3,
  );
  const labelIndexes = Array.from(
    new Set(
      dateKeys.length <= 4
        ? dateKeys.map((_, index) => index)
        : [
            0,
            Math.floor((dateKeys.length - 1) / 3),
            Math.floor(((dateKeys.length - 1) * 2) / 3),
            dateKeys.length - 1,
          ],
    ),
  );
  const points = variableReadings.map((reading) => ({
    date: reading.date,
    time: reading.time,
    value: reading.value,
    x: xForDate(reading.date),
    y: yForValue(reading.value),
  }));
  const path =
    points.length <= 1
      ? ""
      : points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-stone-700">
        {formatShortDate(dateKeys[0])} - {formatShortDate(dateKeys.at(-1) ?? dateKeys[0])} ·{" "}
        {variableReadings.length} {variableReadings.length === 1 ? "reading" : "readings"}
      </p>
      <div className="overflow-hidden">
        <svg
          aria-label={`${variable.name} trend chart`}
          className="h-auto w-full"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <rect fill="#fafaf9" height={height} rx="6" width={width} />
          {gridValues.map((value) => {
            const y = yForValue(value);
            return (
              <g key={value}>
                <line
                  stroke="#e7e5e4"
                  strokeWidth="1"
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="#78716c"
                  fontSize="12"
                  textAnchor="end"
                  x={padding.left - 10}
                  y={y + 4}
                >
                  {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </text>
              </g>
            );
          })}
          {path && (
            <path
              d={path}
              fill="none"
              stroke={measurementColours[variable.colourKey]}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          )}
          {labelIndexes.map((index) => (
            <text
              fill="#78716c"
              fontSize="12"
              key={dateKeys[index]}
              textAnchor="middle"
              x={xForDate(dateKeys[index])}
              y={height - 22}
            >
              {formatShortDate(dateKeys[index])}
            </text>
          ))}
          {points.map((point) => (
            <g key={`${point.date}-${point.time}`}>
              {markerForPoint({
                colour: measurementColours[variable.colourKey],
                onActivate: () => setActivePoint(point),
                point,
                shape: variable.markerShape,
              })}
            </g>
          ))}
          {activePoint && (
            <g>
              <rect
                fill="#1c1917"
                height="52"
                rx="6"
                width="178"
                x={Math.min(activePoint.x + 10, width - 196)}
                y={Math.max(activePoint.y - 62, 12)}
              />
              <text
                fill="#ffffff"
                fontSize="12"
                fontWeight="700"
                x={Math.min(activePoint.x + 22, width - 184)}
                y={Math.max(activePoint.y - 40, 34)}
              >
                {variable.name}
              </text>
              <text
                fill="#e7e5e4"
                fontSize="12"
                x={Math.min(activePoint.x + 22, width - 184)}
                y={Math.max(activePoint.y - 20, 54)}
              >
                {formatShortDate(activePoint.date)} at {activePoint.time} ·{" "}
                {formatMeasurement(activePoint.value, variable.unit)}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function MeasurementEntryRow({
  draft,
  error,
  onDraftChange,
  onNoteToggle,
  onSave,
  saveState,
  showNote,
  unit,
}: {
  draft: ReadingDraft;
  error?: string;
  onDraftChange: (draft: ReadingDraft) => void;
  onNoteToggle: () => void;
  onSave: () => void;
  saveState: "idle" | "saving" | "saved";
  showNote: boolean;
  unit: string;
}) {
  return (
    <div>
      <div className="grid gap-3">
        <label>
          <span className="text-sm font-medium text-stone-700">Value</span>
          <div className="mt-2 flex min-h-12 items-center rounded-md border border-stone-300 bg-white focus-within:border-stone-900">
            <input
              className="min-w-0 flex-1 bg-transparent px-4 text-xl font-semibold outline-none"
              inputMode="decimal"
              onChange={(event) =>
                onDraftChange({ ...draft, value: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") onSave();
              }}
              placeholder="99.5"
              type="text"
              value={draft.value}
            />
            <span className="pr-4 text-sm font-semibold text-stone-500">{unit}</span>
          </div>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-sm font-medium text-stone-700">Date</span>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm font-semibold outline-none focus:border-stone-900"
              onChange={(event) => onDraftChange({ ...draft, date: event.target.value })}
              type="date"
              value={draft.date}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-stone-700">Time</span>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm font-semibold outline-none focus:border-stone-900"
              onChange={(event) => onDraftChange({ ...draft, time: event.target.value })}
              type="time"
              value={draft.time}
            />
          </label>
        </div>
      </div>
      <button className="btn btn-tertiary-text mt-2" onClick={onNoteToggle} type="button">
        {showNote ? "Hide note" : "+ Add note"}
      </button>
      {showNote && (
        <label className="mt-3 block">
          <span className="text-sm font-medium text-stone-700">Note, optional</span>
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900"
            onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
            value={draft.note}
          />
        </label>
      )}
      <button
        className="btn btn-primary-dark mt-3 min-h-11 w-full px-5 text-base"
        disabled={saveState === "saving"}
        onClick={onSave}
        type="button"
      >
        {saveState === "saving"
          ? "Saving…"
          : saveState === "saved"
            ? "✓ Saved"
            : "Save snapshot"}
      </button>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}

function VariableCreator({
  disabled,
  onCancel,
  onSave,
}: {
  disabled: boolean;
  onCancel: () => void;
  onSave: (draft: VariableDraft) => void;
}) {
  const [draft, setDraft] = useState<VariableDraft>({
    colourKey: "green",
    defaultTime: "12:00",
    markerShape: "triangle",
    name: "",
    primary: false,
    unit: "",
  });
  const [error, setError] = useState("");

  function submit() {
    if (!draft.name.trim()) {
      setError("Name this measurement.");
      return;
    }
    if (!draft.unit.trim()) {
      setError("Add a unit, such as kg or cm.");
      return;
    }
    onSave(draft);
  }

  if (disabled) {
    return (
      <p className="wc-section wc-section-padded text-sm text-stone-500">
        Enable or archive another measurement before adding more active variables.
      </p>
    );
  }

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <h2 className="text-lg font-semibold text-stone-950">Add measurement</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-stone-700">Name</span>
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) => {
              setDraft((current) => ({ ...current, name: event.target.value }));
              setError("");
            }}
            placeholder="Height"
            value={draft.name}
          />
        </label>
        <label>
          <span className="text-sm font-medium text-stone-700">Unit</span>
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              setDraft((current) => ({ ...current, unit: event.target.value }))
            }
            placeholder="cm"
            value={draft.unit}
          />
        </label>
        <label>
          <span className="text-sm font-medium text-stone-700">Default time</span>
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
            onChange={(event) =>
              setDraft((current) => ({ ...current, defaultTime: event.target.value }))
            }
            type="time"
            value={draft.defaultTime}
          />
        </label>
        <label>
          <span className="text-sm font-medium text-stone-700">Colour</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                colourKey: event.target.value as MeasurementVariable["colourKey"],
              }))
            }
            value={draft.colourKey}
          >
            {colourOptions.map((colour) => (
              <option key={colour} value={colour}>
                {colour[0].toUpperCase() + colour.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-medium text-stone-700">Marker</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                markerShape: event.target.value as MeasurementVariable["markerShape"],
              }))
            }
            value={draft.markerShape}
          >
            {markerShapeOptions.map((shape) => (
              <option key={shape} value={shape}>
                {shapeLabel(shape)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 flex min-h-10 items-center gap-2 text-sm font-medium text-stone-700">
        <input
          checked={draft.primary}
          onChange={(event) =>
            setDraft((current) => ({ ...current, primary: event.target.checked }))
          }
          type="checkbox"
        />
        Make this primary
      </label>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn btn-secondary-outline" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="btn btn-primary-dark" onClick={submit} type="button">
          Save measurement
        </button>
      </div>
    </section>
  );
}

function DialogFrame({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      aria-labelledby="measurements-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-stone-950/35 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
    >
      <button
        aria-label="Close dialog"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-1rem)] overflow-y-auto rounded-t-[var(--wc-section-radius)] bg-white p-[var(--wc-section-padding)] shadow-2xl sm:max-w-2xl sm:rounded-[var(--wc-section-radius)]">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-3">
          <h2 className="text-lg font-semibold text-stone-950" id="measurements-dialog-title">
            {title}
          </h2>
          <button className="btn btn-secondary-outline" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-1 font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function SummaryHeader({
  stats,
  variable,
}: {
  stats: ReturnType<typeof variableStats> | null;
  variable: MeasurementVariable;
}) {
  const hasEnoughHistory = (stats?.records.length ?? 0) >= 2;

  return (
    <div className="grid gap-2 text-sm min-[520px]:grid-cols-3">
      <MetricLine
        label="Latest"
        value={formatMeasurement(stats?.latest?.value, variable.unit)}
      />
      {hasEnoughHistory ? (
        <>
          <MetricLine
            label="7-day average"
            value={formatMeasurement(stats?.sevenDayAverage, variable.unit)}
          />
          <MetricLine
            label="30-day change"
            value={formatChange(stats?.thirtyDayChange, variable.unit)}
          />
        </>
      ) : (
        <MetricLine label="Readings" value={String(stats?.records.length ?? 0)} />
      )}
    </div>
  );
}

function variableStats(readings: MeasurementReading[], variable: MeasurementVariable) {
  const records = readingsForVariable(readings, variable.id);
  const latest = records.at(-1);
  const sevenDayRecords = latest
    ? records.filter(
        (record) =>
          dayDifference(latest.date, record.date) >= 0 &&
          dayDifference(latest.date, record.date) <= 6,
      )
    : [];
  const sevenDayAverage =
    sevenDayRecords.length >= 2
      ? sevenDayRecords.reduce((total, record) => total + record.value, 0) /
        sevenDayRecords.length
      : undefined;
  const thirtyDayRecords = latest
    ? records.filter(
        (record) =>
          dayDifference(latest.date, record.date) >= 0 &&
          dayDifference(latest.date, record.date) <= 30,
      )
    : [];
  const thirtyDayAverage =
    thirtyDayRecords.length >= 2
      ? thirtyDayRecords.reduce((total, record) => total + record.value, 0) /
        thirtyDayRecords.length
      : undefined;
  const baseline = latest
    ? records.find(
        (record) =>
          record.date !== latest.date &&
          dayDifference(latest.date, record.date) >= 0 &&
          dayDifference(latest.date, record.date) <= 30,
      )
    : undefined;
  const thirtyDayChange = latest && baseline ? latest.value - baseline.value : undefined;

  return {
    latest,
    records,
    sevenDayAverage,
    thirtyDayAverage,
    thirtyDayChange,
    thirtyDayRecords,
  };
}

function ReadingList({
  onDelete,
  onEdit,
  onSelectVariable,
  readings,
  selectedVariable,
  variables,
}: {
  onDelete: (reading: MeasurementReading) => void;
  onEdit: (reading: MeasurementReading) => void;
  onSelectVariable: (variableId: string) => void;
  readings: MeasurementReading[];
  selectedVariable: MeasurementVariable;
  variables: MeasurementVariable[];
}) {
  const variableReadings = readingsForVariable(readings, selectedVariable.id);
  const groups = [...variableReadings]
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .reduce<Array<{ date: string; readings: MeasurementReading[] }>>((list, reading) => {
      const existing = list.find((group) => group.date === reading.date);
      if (existing) existing.readings.push(reading);
      else list.push({ date: reading.date, readings: [reading] });
      return list;
    }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {variables.map((variable) => (
          <button
            aria-pressed={selectedVariable.id === variable.id}
            className={`btn ${
              selectedVariable.id === variable.id
                ? "btn-primary-accent"
                : "btn-secondary-outline"
            } min-h-9 px-3 text-xs`}
            key={variable.id}
            onClick={() => onSelectVariable(variable.id)}
            type="button"
          >
            {variable.name}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-500">
          No {selectedVariable.name.toLowerCase()} readings yet.
        </p>
      ) : (
        <div className="divide-y divide-stone-100">
          {groups.map((group) => (
            <div className="py-3" key={group.date}>
              <p className="text-sm font-semibold text-stone-800">
                {formatShortDate(group.date)}
              </p>
              <div className="mt-2 grid gap-2">
                {group.readings.map((reading) => (
                  <div
                    className="grid gap-2 rounded-md bg-stone-50 p-3 text-sm sm:grid-cols-[1fr_auto]"
                    key={reading.id}
                  >
                    <div>
                      <p className="font-medium text-stone-900">
                        {formatMeasurement(reading.value, selectedVariable.unit)}{" "}
                        <span className="font-normal text-stone-500">
                          at {reading.time}
                        </span>
                      </p>
                      {reading.note && (
                        <p className="mt-1 text-stone-500">{reading.note}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                        onClick={() => onEdit(reading)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-destructive min-h-9 px-3 text-xs"
                        onClick={() => onDelete(reading)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isBuiltInWeightVariable(variable: MeasurementVariable) {
  return (
    variable.id === "measurement-morning" ||
    variable.id === "measurement-evening" ||
    variable.id === "measurement-weight"
  );
}

function visibleMeasurementVariables(variables: MeasurementVariable[]) {
  const visible = variables.filter((variable) => variable.id !== "measurement-evening");
  return visible.length > 0 ? visible : variables;
}

function MeasurementChip({
  isSelected,
  onRemove,
  onSelect,
  variable,
}: {
  isSelected: boolean;
  onRemove: () => void;
  onSelect: () => void;
  variable: MeasurementVariable;
}) {
  const removable = !isBuiltInWeightVariable(variable);

  return (
    <span
      className={`inline-flex min-h-9 shrink-0 items-center rounded-md border text-xs font-semibold ${
        isSelected
          ? "border-transparent bg-[var(--accent)] text-[var(--accent-contrast)]"
          : "border-stone-300 bg-white text-stone-800"
      }`}
    >
      <button className="min-h-9 px-3" onClick={onSelect} type="button">
        {variable.name}
        {variable.isPrimary ? " · primary" : ""}
      </button>
      {removable && (
        <button
          aria-label={`Remove ${variable.name}`}
          className={`mr-1 grid h-7 w-7 place-items-center rounded-md ${
            isSelected
              ? "text-[var(--accent-contrast)] hover:bg-white/15"
              : "text-stone-500 hover:bg-stone-100 hover:text-red-700"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          type="button"
        >
          ×
        </button>
      )}
    </span>
  );
}

function MeasurementManager({
  onDeleteVariable,
  onUpdateVariables,
  readings,
  variables,
}: {
  onDeleteVariable: (
    variable: MeasurementVariable,
    mode: "archive" | "delete",
  ) => void;
  onUpdateVariables: (variables: MeasurementVariable[]) => void;
  readings: MeasurementReading[];
  variables: MeasurementVariable[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const enabledCount = variables.filter((variable) => variable.isEnabled).length;

  function patchVariable(id: string, patch: Partial<MeasurementVariable>) {
    const now = new Date().toISOString();
    onUpdateVariables(
      variables.map((variable) =>
        variable.id === id ? { ...variable, ...patch, updatedAt: now } : variable,
      ),
    );
  }

  return (
    <div className="grid gap-2">
      {variables.map((variable) => {
        const hasReadings = readings.some((reading) => reading.variableId === variable.id);
        const otherEnabled = variables.some(
          (current) => current.id !== variable.id && current.isEnabled,
        );
        const canArchive = otherEnabled || !variable.isEnabled;
        const canDelete = !variable.isPrimary && (otherEnabled || !variable.isEnabled);

        return (
          <div className="rounded-md bg-stone-50 p-3 text-sm" key={variable.id}>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-semibold text-stone-900">
                  {variable.name}{" "}
                  <span className="font-normal text-stone-500">
                  {variable.unit} ·{" "}
                  {isBuiltInWeightVariable(variable) ? "Built-in" : "Custom"} ·{" "}
                  {variable.colourKey} {variable.markerShape} ·{" "}
                    {variable.isPrimary ? "Primary · " : ""}
                    {variable.isEnabled ? "Active" : "Archived"}
                  </span>
                </p>
                {variable.defaultTime && (
                  <p className="mt-1 text-stone-500">Default time {variable.defaultTime}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                  onClick={() =>
                    setEditingId((current) => (current === variable.id ? null : variable.id))
                  }
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                  disabled={variable.isPrimary || !variable.isEnabled}
                  onClick={() =>
                    onUpdateVariables(
                      variables.map((current) => ({
                        ...current,
                        isPrimary: current.id === variable.id,
                      })),
                    )
                  }
                  type="button"
                >
                  Make primary
                </button>
                <button
                  className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                  disabled={variable.isEnabled && !canArchive}
                  onClick={() =>
                    patchVariable(variable.id, { isEnabled: !variable.isEnabled })
                  }
                  type="button"
                >
                  {variable.isEnabled ? "Archive" : "Restore"}
                </button>
                <button
                  className="btn btn-destructive min-h-9 px-3 text-xs"
                  disabled={!canDelete}
                  onClick={() => setConfirmingId(variable.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>

            {editingId === variable.id && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-semibold text-stone-500">Name</span>
                  <input
                    className="mt-1 min-h-9 w-full rounded-md border border-stone-300 px-2 text-xs"
                    onChange={(event) =>
                      patchVariable(variable.id, { name: event.target.value })
                    }
                    value={variable.name}
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-stone-500">Unit</span>
                  <input
                    className="mt-1 min-h-9 w-full rounded-md border border-stone-300 px-2 text-xs"
                    onChange={(event) =>
                      patchVariable(variable.id, { unit: event.target.value })
                    }
                    value={variable.unit}
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-stone-500">Default time</span>
                  <input
                    className="mt-1 min-h-9 w-full rounded-md border border-stone-300 px-2 text-xs"
                    onChange={(event) =>
                      patchVariable(variable.id, { defaultTime: event.target.value || null })
                    }
                    type="time"
                    value={variable.defaultTime ?? ""}
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-stone-500">Colour</span>
                  <select
                    className="mt-1 min-h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-xs"
                    onChange={(event) =>
                      patchVariable(variable.id, {
                        colourKey: event.target.value as MeasurementVariable["colourKey"],
                      })
                    }
                    value={variable.colourKey}
                  >
                    {colourOptions.map((colour) => (
                      <option key={colour} value={colour}>
                        {colour[0].toUpperCase() + colour.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-semibold text-stone-500">Marker</span>
                  <select
                    className="mt-1 min-h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-xs"
                    onChange={(event) =>
                      patchVariable(variable.id, {
                        markerShape: event.target
                          .value as MeasurementVariable["markerShape"],
                      })
                    }
                    value={variable.markerShape}
                  >
                    {markerShapeOptions.map((shape) => (
                      <option key={shape} value={shape}>
                        {shapeLabel(shape)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {confirmingId === variable.id && (
              <div className="mt-3 rounded-md border border-red-100 bg-white p-3">
                <p className="text-sm font-semibold text-stone-900">
                  Delete &quot;{variable.name}&quot;?
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {hasReadings
                    ? `${readings.filter((reading) => reading.variableId === variable.id).length} readings are attached. Archive keeps them. Deleting removes this measurement and its readings only.`
                    : "This measurement has no readings."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hasReadings && (
                    <button
                      className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                      onClick={() => {
                        onDeleteVariable(variable, "archive");
                        setConfirmingId(null);
                      }}
                      type="button"
                    >
                      Archive and keep readings
                    </button>
                  )}
                  <button
                    className="btn btn-destructive min-h-9 px-3 text-xs"
                    onClick={() => {
                      onDeleteVariable(variable, "delete");
                      setConfirmingId(null);
                    }}
                    type="button"
                  >
                    {hasReadings ? "Delete variable and readings" : "Delete variable"}
                  </button>
                  <button
                    className="btn btn-tertiary-text min-h-9 px-3 text-xs"
                    onClick={() => setConfirmingId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {enabledCount === 1 && variable.isEnabled && (
              <p className="mt-2 text-xs text-stone-500">
                At least one measurement must remain active.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RemoveMeasurementDialog({
  onArchive,
  onCancel,
  onDelete,
  onRemoveEmpty,
  readingCount,
  variable,
}: {
  onArchive: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onRemoveEmpty: () => void;
  readingCount: number;
  variable: MeasurementVariable;
}) {
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  return (
    <DialogFrame onClose={onCancel} title={`Remove ${variable.name}`}>
      {readingCount === 0 ? (
        <div className="grid gap-4">
          <div>
            <p className="text-base font-semibold text-stone-950">
              Remove &quot;{variable.name}&quot;?
            </p>
            <p className="mt-1 text-sm text-stone-500">
              This measurement has no saved readings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-destructive" onClick={onRemoveEmpty} type="button">
              Remove measurement
            </button>
            <button className="btn btn-tertiary-text" onClick={onCancel} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div>
            <p className="text-base font-semibold text-stone-950">
              Remove &quot;{variable.name}&quot;?
            </p>
            <p className="mt-1 text-sm text-stone-500">
              This measurement contains {readingCount} saved{" "}
              {readingCount === 1 ? "reading" : "readings"}.
            </p>
          </div>
          {!confirmDestructive ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary-outline" onClick={onArchive} type="button">
                Archive measurement
              </button>
              <button
                className="btn btn-destructive"
                onClick={() => setConfirmDestructive(true)}
                type="button"
              >
                Delete measurement and {readingCount}{" "}
                {readingCount === 1 ? "reading" : "readings"}
              </button>
              <button className="btn btn-tertiary-text" onClick={onCancel} type="button">
                Cancel
              </button>
            </div>
          ) : (
            <div className="rounded-md border border-red-100 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">
                Confirm permanent deletion?
              </p>
              <p className="mt-1 text-sm text-red-700">
                This deletes only {variable.name} and its {readingCount} saved{" "}
                {readingCount === 1 ? "reading" : "readings"}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-destructive" onClick={onDelete} type="button">
                  Yes, delete permanently
                </button>
                <button
                  className="btn btn-tertiary-text"
                  onClick={() => setConfirmDestructive(false)}
                  type="button"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DialogFrame>
  );
}

export default function MeasurementsPage() {
  const todayKey = useMemo(() => localDateKey(), []);
  const [variables, setVariables] = useState<MeasurementVariable[]>([]);
  const [readings, setReadings] = useState<MeasurementReading[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReadingDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<
    Record<string, "idle" | "saving" | "saved">
  >({});
  const [showVariableCreator, setShowVariableCreator] = useState(false);
  const [activeModal, setActiveModal] = useState<"list" | "manage" | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [selectedVariableId, setSelectedVariableId] = useState("");
  const [visualMode, setVisualMode] = useState<MeasurementCardMode>("trend");
  const [confirmation, setConfirmation] = useState("");
  const [variableToRemove, setVariableToRemove] =
    useState<MeasurementVariable | null>(null);
  const chipStripRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(() => {
    const migrated = migrateMeasurementsV1();
    const enabled = enabledMeasurementVariables(migrated.variables);
    const visibleEnabled = visibleMeasurementVariables(enabled);
    const primary = primaryMeasurementVariable(visibleEnabled);
    setVariables(migrated.variables);
    setReadings(migrated.readings);
    setSelectedVariableId((current) =>
      visibleEnabled.some((variable) => variable.id === current)
        ? current
        : primary?.id ?? visibleEnabled[0]?.id ?? "",
    );
    setDrafts((current) => {
      const next = { ...current };
      for (const variable of visibleEnabled) {
        next[variable.id] = next[variable.id] ?? {
          date: todayKey,
          note: "",
          time: variable.defaultTime ?? currentLocalTime(),
          value: "",
        };
      }
      return next;
    });
  }, [todayKey]);

  useEffect(() => {
    queueMicrotask(refresh);
  }, [refresh]);

  const enabledVariables = visibleMeasurementVariables(enabledMeasurementVariables(variables));
  const primaryVariable = primaryMeasurementVariable(enabledVariables);
  const selectedVariable =
    enabledVariables.find((variable) => variable.id === selectedVariableId) ??
    primaryVariable ??
    enabledVariables[0] ??
    null;
  const selectedStats = selectedVariable
    ? variableStats(readings, selectedVariable)
    : null;

  useEffect(() => {
    const selectedChip = chipStripRef.current?.querySelector<HTMLElement>(
      "[data-selected-measurement='true']",
    );
    selectedChip?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedVariableId, enabledVariables.length]);

  function persistVariables(nextVariables: MeasurementVariable[]) {
    const normalized = normalizeMeasurementVariables(nextVariables);
    saveMeasurementVariables(normalized);
    setVariables(normalized);
  }

  function fallbackVariableId(afterVariables: MeasurementVariable[]) {
    const enabled = enabledMeasurementVariables(afterVariables);
    const primary = primaryMeasurementVariable(afterVariables);
    return primary?.id ?? enabled[0]?.id ?? "";
  }

  function ensureActiveFallbackVariable(nextVariables: MeasurementVariable[]) {
    if (nextVariables.some((variable) => variable.isEnabled)) {
      return nextVariables;
    }

    const now = new Date().toISOString();
    const defaultIndex = nextVariables.findIndex(
      (variable) =>
        variable.id === "measurement-morning" || variable.id === "measurement-weight",
    );

    if (defaultIndex >= 0) {
      return nextVariables.map((variable, index) =>
        index === defaultIndex
          ? {
              ...variable,
              isEnabled: true,
              isPrimary: true,
              name:
                variable.id === "measurement-morning" &&
                variable.name === "Morning weight"
                  ? "Weight"
                  : variable.name,
              updatedAt: now,
            }
          : { ...variable, isPrimary: false },
      );
    }

    return [
      {
        ...defaultMeasurementVariable,
        createdAt: now,
        updatedAt: now,
      },
      ...nextVariables.map((variable) => ({ ...variable, isPrimary: false })),
    ];
  }

  function saveReading(variable: MeasurementVariable) {
    const draft = drafts[variable.id] ?? {
      date: todayKey,
      note: "",
      time: currentLocalTime(),
      value: "",
    };
    const value = Number(draft.value.trim());

    if (!Number.isFinite(value)) {
      setErrors((current) => ({
        ...current,
        [variable.id]: `Enter a value in ${variable.unit}.`,
      }));
      return;
    }

    setSaveStates((current) => ({ ...current, [variable.id]: "saving" }));
    window.setTimeout(() => {
      upsertMeasurementReading(
        makeMeasurementReading({
          date: draft.date || todayKey,
          note: draft.note,
          time: draft.time || currentLocalTime(),
          value,
          variableId: variable.id,
        }),
      );
      setSaveStates((current) => ({ ...current, [variable.id]: "saved" }));
      setErrors((current) => ({ ...current, [variable.id]: "" }));
      setConfirmation(`${variable.name} saved for ${formatShortDate(draft.date || todayKey)}.`);
      setDrafts((current) => ({
        ...current,
        [variable.id]: {
          date: todayKey,
          note: "",
          time: variable.defaultTime ?? currentLocalTime(),
          value: "",
        },
      }));
      refresh();
      window.setTimeout(() => {
        setSaveStates((current) => ({ ...current, [variable.id]: "idle" }));
      }, 1000);
    }, 180);
  }

  function addVariable(draft: VariableDraft) {
    const now = new Date().toISOString();
    const nextVariable: MeasurementVariable = {
      id: makeId("measurement"),
      name: draft.name.trim(),
      unit: draft.unit.trim(),
      defaultTime: draft.defaultTime || null,
      colourKey: draft.colourKey,
      markerShape: draft.markerShape,
      isPrimary: draft.primary,
      isEnabled: true,
      order: Math.max(...variables.map((variable) => variable.order), 0) + 1,
      createdAt: now,
      updatedAt: now,
    };
    persistVariables(
      draft.primary
        ? [...variables.map((variable) => ({ ...variable, isPrimary: false })), nextVariable]
        : [...variables, nextVariable],
    );
    setShowVariableCreator(false);
    setSelectedVariableId(nextVariable.id);
    setConfirmation(`${nextVariable.name} added.`);
    refresh();
  }

  function editReading(reading: MeasurementReading) {
    setSelectedVariableId(reading.variableId);
    setShowNote(Boolean(reading.note));
    setActiveModal(null);
    setDrafts((current) => ({
      ...current,
      [reading.variableId]: {
        date: reading.date,
        note: reading.note,
        time: reading.time,
        value: String(reading.value),
      },
    }));
    setConfirmation(`Editing ${formatShortDate(reading.date)}.`);
  }

  function removeReading(reading: MeasurementReading) {
    deleteMeasurementReading(reading.id);
    setConfirmation("Reading removed.");
    refresh();
  }

  function deleteVariable(variable: MeasurementVariable, mode: "archive" | "delete") {
    if (mode === "archive") {
      const nextVariables = ensureActiveFallbackVariable(
        variables.map((current) =>
          current.id === variable.id
            ? {
                ...current,
                isEnabled: false,
                isPrimary: false,
                updatedAt: new Date().toISOString(),
              }
            : current,
        ),
      );
      persistVariables(nextVariables);
      setSelectedVariableId(fallbackVariableId(nextVariables));
      setConfirmation(`${variable.name} archived. Readings were kept.`);
      refresh();
      return;
    }

    const nextVariables = ensureActiveFallbackVariable(
      variables.filter((current) => current.id !== variable.id),
    );
    persistVariables(nextVariables);
    saveMeasurementReadings(
      readings.filter((reading) => reading.variableId !== variable.id),
    );
    setSelectedVariableId(fallbackVariableId(nextVariables));
    setConfirmation(
      readings.some((reading) => reading.variableId === variable.id)
        ? `${variable.name} deleted.`
        : "Measurement removed.",
    );
    refresh();
  }

  if (!selectedVariable) {
    return (
      <div className="wc-page mx-auto flex w-full max-w-5xl flex-col">
        <PageHeader date={todayKey} title="Measurements" />
        <button
          className="btn btn-primary-accent"
          onClick={() => setShowVariableCreator(true)}
          type="button"
        >
          + Add measurement
        </button>
        {showVariableCreator && (
          <DialogFrame onClose={() => setShowVariableCreator(false)} title="Add measurement">
            <VariableCreator disabled={false} onCancel={() => setShowVariableCreator(false)} onSave={addVariable} />
          </DialogFrame>
        )}
      </div>
    );
  }

  return (
    <div className="wc-page mx-auto flex w-full max-w-5xl flex-col">
      <PageHeader date={todayKey} title="Measurements" />

      <ToastBridge
        message={confirmation}
        type={
          confirmation.toLowerCase().includes("removed") ||
          confirmation.toLowerCase().includes("archived")
            ? "information"
            : "success"
        }
      />

      <MeasurementCard
        actions={
          <>
            <button className="btn btn-secondary-outline" onClick={() => setActiveModal("list")} type="button">
              List
            </button>
            <button className="btn btn-secondary-outline" onClick={() => setActiveModal("manage")} type="button">
              Manage
            </button>
          </>
        }
        entryPanel={
          <div className="grid gap-4">
            <div
              aria-label="Measurement variables"
              className="-mx-1 flex max-w-full flex-nowrap gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap px-1 pb-1"
              ref={chipStripRef}
            >
              {enabledVariables.map((variable) => (
                <span
                  data-selected-measurement={selectedVariable.id === variable.id}
                  key={variable.id}
                >
                  <MeasurementChip
                    isSelected={selectedVariable.id === variable.id}
                    onRemove={() => setVariableToRemove(variable)}
                    onSelect={() => {
                      setSelectedVariableId(variable.id);
                      setShowNote(Boolean(drafts[variable.id]?.note));
                    }}
                    variable={variable}
                  />
                </span>
              ))}
              <button
                className="btn btn-tertiary-text min-h-9 shrink-0 px-3 text-xs"
                onClick={() => setShowVariableCreator(true)}
                type="button"
              >
                + Add measurement
              </button>
            </div>
            <MeasurementEntryRow
              draft={
                drafts[selectedVariable.id] ?? {
                  date: todayKey,
                  note: "",
                  time: selectedVariable.defaultTime ?? currentLocalTime(),
                  value: "",
                }
              }
              error={errors[selectedVariable.id]}
              onDraftChange={(draft) =>
                setDrafts((current) => ({ ...current, [selectedVariable.id]: draft }))
              }
              onNoteToggle={() => setShowNote((current) => !current)}
              onSave={() => saveReading(selectedVariable)}
              saveState={saveStates[selectedVariable.id] ?? "idle"}
              showNote={showNote}
              unit={selectedVariable.unit}
            />
          </div>
        }
        graphHeader={
          <SummaryHeader stats={selectedStats} variable={selectedVariable} />
        }
        graphPanel={
          visualMode === "trend" ? (
            <TrendChart readings={readings} variable={selectedVariable} />
          ) : (
            <div className="grid gap-2 rounded-md bg-stone-50 p-3 text-sm sm:grid-cols-2">
              <MetricLine
                label="Latest"
                value={formatMeasurement(selectedStats?.latest?.value, selectedVariable.unit)}
              />
              <MetricLine
                label="7-day average"
                value={formatMeasurement(
                  selectedStats?.sevenDayAverage,
                  selectedVariable.unit,
                )}
              />
              <MetricLine
                label="30-day average"
                value={formatMeasurement(
                  selectedStats?.thirtyDayAverage,
                  selectedVariable.unit,
                )}
              />
              <MetricLine
                label="30-day change"
                value={formatChange(
                  selectedStats?.thirtyDayChange,
                  selectedVariable.unit,
                )}
              />
              <MetricLine label="Readings" value={String(selectedStats?.records.length ?? 0)} />
              <MetricLine
                label="Minimum"
                value={formatMeasurement(
                  selectedStats?.records.length
                    ? Math.min(...selectedStats.records.map((record) => record.value))
                    : undefined,
                  selectedVariable.unit,
                )}
              />
              <MetricLine
                label="Maximum"
                value={formatMeasurement(
                  selectedStats?.records.length
                    ? Math.max(...selectedStats.records.map((record) => record.value))
                    : undefined,
                  selectedVariable.unit,
                )}
              />
            </div>
          )
        }
        mode={visualMode}
        onModeChange={setVisualMode}
        primaryLabel={primaryVariable?.name ?? "—"}
        title="Measurements"
      />

      {activeModal === "list" && (
        <DialogFrame onClose={() => setActiveModal(null)} title={`${selectedVariable.name} readings`}>
          <ReadingList
            onDelete={removeReading}
            onEdit={editReading}
            onSelectVariable={setSelectedVariableId}
            readings={readings}
            selectedVariable={selectedVariable}
            variables={variables}
          />
        </DialogFrame>
      )}

      {activeModal === "manage" && (
        <DialogFrame onClose={() => setActiveModal(null)} title="Manage measurements">
          <p className="mb-3 text-sm text-stone-500">
            {primaryVariable?.name ?? "—"} primary · {enabledVariables.length} active measurements.
          </p>
          <MeasurementManager
            onDeleteVariable={deleteVariable}
            onUpdateVariables={persistVariables}
            readings={readings}
            variables={variables}
          />
          <button
            className="btn btn-tertiary-text mt-3"
            onClick={() => setShowVariableCreator(true)}
            type="button"
          >
            + Add measurement
          </button>
        </DialogFrame>
      )}

      {showVariableCreator && (
        <DialogFrame onClose={() => setShowVariableCreator(false)} title="Add measurement">
          <VariableCreator
            disabled={false}
            onCancel={() => setShowVariableCreator(false)}
            onSave={addVariable}
          />
        </DialogFrame>
      )}

      {variableToRemove && (
        <RemoveMeasurementDialog
          onArchive={() => {
            deleteVariable(variableToRemove, "archive");
            setVariableToRemove(null);
          }}
          onCancel={() => setVariableToRemove(null)}
          onDelete={() => {
            deleteVariable(variableToRemove, "delete");
            setVariableToRemove(null);
          }}
          onRemoveEmpty={() => {
            deleteVariable(variableToRemove, "delete");
            setVariableToRemove(null);
          }}
          readingCount={
            readings.filter((reading) => reading.variableId === variableToRemove.id)
              .length
          }
          variable={variableToRemove}
        />
      )}
    </div>
  );
}
