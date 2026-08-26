"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  WellCanvasIcon,
  type WellCanvasIconName,
} from "@/components/wellcanvas-icon";

const items = [
  { href: "/", label: "Today", short: "Today", icon: "today" },
  { href: "/foods", label: "Foods and meals", short: "Foods", icon: "foods" },
  { href: "/activity", label: "Activity", short: "Activity", icon: "activity" },
  { href: "/measurements", label: "Measurements", short: "Measurements", icon: "weight" },
  { href: "/settings", label: "Settings", short: "Settings", icon: "settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [todayIcon, setTodayIcon] = useState<WellCanvasIconName | null>(null);

  useEffect(() => {
    function refreshIcon() {
      const hour = new Date().getHours();
      setTodayIcon(hour >= 5 && hour < 18 ? "sun" : "moon");
    }

    refreshIcon();
    document.addEventListener("visibilitychange", refreshIcon);
    window.addEventListener("focus", refreshIcon);
    window.addEventListener("health-tracker:local-day-changed", refreshIcon);
    return () => {
      document.removeEventListener("visibilitychange", refreshIcon);
      window.removeEventListener("focus", refreshIcon);
      window.removeEventListener("health-tracker:local-day-changed", refreshIcon);
    };
  }, []);

  function Icon({ icon }: { icon: string }) {
    let iconName: WellCanvasIconName;
    if (icon === "today") {
      if (!todayIcon) return <span aria-hidden="true" className="block h-[26px] w-[26px]" />;
      iconName = todayIcon;
    } else if (icon === "foods") {
      iconName = "food";
    } else if (icon === "activity") {
      iconName = "activity";
    } else if (icon === "weight") {
      iconName = "measurement";
    } else {
      iconName = "settings";
    }
    return <WellCanvasIcon name={iconName} size="nav" />;
  }

  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)]">
      <div className="mx-auto grid w-full max-w-lg min-w-0 grid-cols-[repeat(5,minmax(0,1fr))] gap-1">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center rounded-md px-1 text-center text-[11px] font-medium transition sm:px-2 sm:text-xs ${
                active
                  ? "accent-selected"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
              }`}
              href={item.href}
              key={item.href}
            >
              <span className={`mb-1 transition ${active ? "scale-105 opacity-100" : "opacity-85"}`}>
                <Icon icon={item.icon} />
              </span>
              <span className="max-w-full truncate">{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
