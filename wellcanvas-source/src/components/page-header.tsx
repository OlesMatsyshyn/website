"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { WellCanvasIcon } from "@/components/wellcanvas-icon";
import { localDateKey } from "@/lib/food-log";
import {
  DEFAULT_PROFILE,
  readProfile,
  type UserProfile,
} from "@/lib/personalization";

const DISPLAY_LOCALE = "en-SG";

function formatHeaderDate(date: Date | string) {
  if (date instanceof Date) {
    return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
      day: "numeric",
      month: "long",
      weekday: "long",
    }).format(date);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
      day: "numeric",
      month: "long",
      weekday: "long",
    }).format(new Date(year, month - 1, day));
  }

  return date;
}

export type PageHeaderProps = {
  date?: Date | string;
  greetingMode?: boolean;
  profile?: UserProfile;
  profileReady?: boolean;
  subtitle?: string;
  title: string;
  trailingAction?: ReactNode;
};

export function PageHeader({
  date,
  greetingMode,
  profile,
  profileReady,
  subtitle,
  title,
  trailingAction,
}: PageHeaderProps) {
  const [localProfile, setLocalProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [localProfileReady, setLocalProfileReady] = useState(false);
  const [localDateLabel, setLocalDateLabel] = useState("");
  const effectiveProfile = profile ?? localProfile;
  const isProfileReady = profileReady ?? localProfileReady;
  const dateLabel = useMemo(
    () => (date ? formatHeaderDate(date) : localDateLabel),
    [date, localDateLabel],
  );
  const hasPhoto = effectiveProfile.photoSource !== "none";

  useEffect(() => {
    if (profile) return;

    function refreshProfile() {
      setLocalProfile(readProfile());
      setLocalProfileReady(true);
    }

    refreshProfile();
    window.addEventListener("storage", refreshProfile);
    window.addEventListener("health-tracker-profile-change", refreshProfile);
    return () => {
      window.removeEventListener("storage", refreshProfile);
      window.removeEventListener("health-tracker-profile-change", refreshProfile);
    };
  }, [profile]);

  useEffect(() => {
    if (date) return;

    function refreshDate() {
      setLocalDateLabel(formatHeaderDate(localDateKey()));
    }

    refreshDate();
    window.addEventListener("focus", refreshDate);
    window.addEventListener("pageshow", refreshDate);
    window.addEventListener("health-tracker:local-day-changed", refreshDate);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.removeEventListener("focus", refreshDate);
      window.removeEventListener("pageshow", refreshDate);
      window.removeEventListener("health-tracker:local-day-changed", refreshDate);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, [date]);

  return (
    <header className={`page-header${greetingMode ? " page-header--greeting" : ""}`}>
      <div className="page-header-row">
        <div className="page-header-main">
          <span className="page-header-avatar-slot" aria-hidden={!isProfileReady}>
            {!isProfileReady ? (
              <span className="block h-full w-full" />
            ) : hasPhoto ? (
              <ProfileAvatar
                fallbackText={effectiveProfile.displayName
                  .trim()
                  .slice(0, 1)
                  .toUpperCase()}
                profile={effectiveProfile}
                sizeClassName="h-full w-full"
              />
            ) : (
              <WellCanvasIcon
                className="page-header-app-icon"
                name="app"
                size="brand"
              />
            )}
          </span>
          <div className="page-header-copy">
            <h1 className="page-header-title">{title}</h1>
            <p className="page-header-date">{dateLabel || "\u00a0"}</p>
          </div>
        </div>
        {trailingAction ? (
          <div className="page-header-action">{trailingAction}</div>
        ) : null}
      </div>
      {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
    </header>
  );
}
