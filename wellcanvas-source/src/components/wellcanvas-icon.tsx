import { withBasePath } from "@/lib/deployment";

export type WellCanvasIconName =
  | "cookie"
  | "opened-cookie"
  | "sun"
  | "moon"
  | "food"
  | "activity"
  | "measurement"
  | "settings"
  | "app";

type IconSize = "nav" | "fortune" | "brand" | number;

export const ICON_PATHS: Record<WellCanvasIconName, string> = {
  activity: withBasePath("/icons/activity.png"),
  app: withBasePath("/icons/wellcanvas-ui.png"),
  cookie: withBasePath("/icons/cookie.png"),
  food: withBasePath("/icons/platter.png"),
  measurement: withBasePath("/icons/measurement.png"),
  moon: withBasePath("/icons/moon.png"),
  "opened-cookie": withBasePath("/icons/opened-cookie.png"),
  settings: withBasePath("/icons/gear.png"),
  sun: withBasePath("/icons/sun.png"),
};

const iconSizes: Record<Exclude<IconSize, number>, number> = {
  brand: 40,
  fortune: 34,
  nav: 26,
};

export function WellCanvasIcon({
  alt = "",
  className = "",
  label,
  name,
  size = "nav",
}: {
  alt?: string;
  className?: string;
  label?: string;
  name: WellCanvasIconName;
  size?: IconSize;
}) {
  const pixels = typeof size === "number" ? size : iconSizes[size];
  const textAlternative = label ?? alt;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={textAlternative}
      aria-hidden={textAlternative ? undefined : true}
      className={`wc-icon ${className}`.trim()}
      draggable={false}
      height={pixels}
      src={ICON_PATHS[name]}
      width={pixels}
    />
  );
}
