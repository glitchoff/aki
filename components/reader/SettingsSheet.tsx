"use client";

import type { Typography } from "@/lib/types";

type Props = {
  value: Typography;
  onChange: (next: Typography) => void;
  onClose: () => void;
  /** Whether the current book supports reflow. */
  canReflow: boolean;
};

const SIZES = [15, 17, 19, 21, 24, 28, 32];
const FAMILIES: Array<[Typography["fontFamily"], string]> = [
  ["serif", "Serif"],
  ["sans", "Sans"],
  ["mono", "Mono"],
];
const THEMES: Array<[Typography["theme"], string]> = [
  ["system", "System"],
  ["light", "Light"],
  ["sepia", "Sepia"],
  ["dark", "Dark"],
];

export function SettingsSheet({ value, onChange, onClose, canReflow }: Props) {
  const set = <K extends keyof Typography>(key: K, next: Typography[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-black/10 bg-[var(--r-panel)] shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-semibold tracking-wide text-[var(--r-dim)] uppercase">Typography</span>
        <button
          onClick={onClose}
          className="rounded-full px-3 py-1 text-sm text-[var(--r-dim)] hover:bg-black/5"
        >
          Done
        </button>
      </div>

      <Row label="Text size">
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <Chip key={s} active={value.fontSize === s} onClick={() => set("fontSize", s)}>
              <span style={{ fontSize: Math.min(s, 20) }}>A</span>
            </Chip>
          ))}
        </div>
      </Row>

      <Row label="Line spacing">
        <Stepper
          value={value.lineHeight}
          steps={[1.3, 1.45, 1.6, 1.75, 1.9, 2.1]}
          onChange={(v) => set("lineHeight", v)}
          format={(v) => v.toFixed(2)}
        />
      </Row>

      <Row label="Typeface">
        <Segmented
          options={FAMILIES}
          value={value.fontFamily}
          onChange={(v) => set("fontFamily", v)}
        />
      </Row>

      <Row label="Theme">
        <Segmented options={THEMES} value={value.theme} onChange={(v) => set("theme", v)} />
      </Row>

      <Row label="Margins">
        <Stepper
          value={value.margin}
          steps={[12, 16, 22, 28, 36, 48]}
          onChange={(v) => set("margin", v)}
          format={(v) => `${v}`}
        />
      </Row>

      <Row label="Alignment">
        <Segmented
          options={[
            ["justify", "Justify"],
            ["start", "Left"],
          ]}
          value={value.justify ? "justify" : "start"}
          onChange={(v) => set("justify", v === "justify")}
        />
      </Row>

      {canReflow && (
        <Row label="Layout">
          <Segmented
            options={[
              ["reflow", "Reflow"],
              ["page", "Original"],
            ]}
            value={value.mode}
            onChange={(v) => set("mode", v as Typography["mode"])}
          />
        </Row>
      )}

      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="w-28 shrink-0 text-sm text-[var(--r-dim)]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
        active ? "bg-[var(--r-accent)] text-white" : "text-[var(--r-fg)] hover:bg-black/5"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<[T, string]>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-black/5 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-[7px] px-2.5 py-1.5 text-xs font-medium transition ${
            value === v ? "bg-[var(--r-panel)] shadow-sm" : "text-[var(--r-dim)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  steps,
  onChange,
  format,
}: {
  value: number;
  steps: number[];
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const index = Math.max(0, steps.indexOf(value));
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(steps[Math.max(0, index - 1)])}
        disabled={index === 0}
        className="h-8 w-8 rounded-lg text-lg leading-none text-[var(--r-fg)] hover:bg-black/5 disabled:opacity-30"
      >
        −
      </button>
      <span className="w-12 text-center text-sm tabular-nums text-[var(--r-dim)]">{format(value)}</span>
      <button
        onClick={() => onChange(steps[Math.min(steps.length - 1, index + 1)])}
        disabled={index === steps.length - 1}
        className="h-8 w-8 rounded-lg text-lg leading-none text-[var(--r-fg)] hover:bg-black/5 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}