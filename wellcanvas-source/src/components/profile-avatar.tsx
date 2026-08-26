"use client";

import { useEffect, useRef, useState } from "react";
import { type UserProfile } from "@/lib/personalization";
import {
  profilePhotoImageStyle,
  type ProfilePhotoGeometry,
} from "@/lib/profile-photo";
import { readReferencePhotoUrl } from "@/lib/reference-photos";

export function ProfileAvatar({
  className = "",
  fallbackText,
  profile,
  sizeClassName = "h-10 w-10",
}: {
  className?: string;
  fallbackText?: string;
  profile: UserProfile;
  sizeClassName?: string;
}) {
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const viewportRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let active = true;

    if (profile.photoSource !== "uploaded" || !profile.uploadedPhotoId) {
      return;
    }

    readReferencePhotoUrl(profile.uploadedPhotoId)
      .then((url) => {
        if (active) setUploadedUrl(url);
      })
      .catch(() => {
        if (active) setUploadedUrl(null);
      });

    return () => {
      active = false;
    };
  }, [profile.photoSource, profile.uploadedPhotoId]);

  const source =
    profile.photoSource === "preset"
      ? profile.presetPhotoPath
      : profile.photoSource === "uploaded"
        ? uploadedUrl
        : null;
  const geometry: ProfilePhotoGeometry | null =
    imageSize && viewportSize
      ? {
          imageNaturalHeight: imageSize.height,
          imageNaturalWidth: imageSize.width,
          viewportHeight: viewportSize.height,
          viewportWidth: viewportSize.width,
        }
      : null;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({ height: rect.height, width: rect.width });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)] ring-1 ring-white/80 ${sizeClassName} ${className}`}
      ref={viewportRef}
    >
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={
            profile.displayName.trim()
              ? `${profile.displayName.trim()} profile photo`
              : "Profile photo"
          }
          className="absolute max-w-none"
          onLoad={(event) =>
            setImageSize({
              height: event.currentTarget.naturalHeight,
              width: event.currentTarget.naturalWidth,
            })
          }
          src={source}
          style={profilePhotoImageStyle(profile, geometry)}
        />
      ) : (
        <span aria-hidden="true">{fallbackText ?? ""}</span>
      )}
    </span>
  );
}
