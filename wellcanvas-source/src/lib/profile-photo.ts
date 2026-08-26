import { type UserProfile } from "@/lib/personalization";
import { type CSSProperties } from "react";

export function clampProfilePosition(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 50;
}

export function clampProfileZoom(value: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 2.5) : 1;
}

export type ProfilePhotoGeometry = {
  imageNaturalHeight: number;
  imageNaturalWidth: number;
  viewportHeight: number;
  viewportWidth: number;
};

export type ProfilePhotoTransform = {
  actualScale: number;
  coverScale: number;
  overflowX: number;
  overflowY: number;
  scaledHeight: number;
  scaledWidth: number;
  x: number;
  y: number;
};

export function calculateProfilePhotoTransform(
  profile: Pick<UserProfile, "photoPositionX" | "photoPositionY" | "photoZoom">,
  geometry: ProfilePhotoGeometry,
): ProfilePhotoTransform {
  const viewportWidth = Math.max(geometry.viewportWidth, 1);
  const viewportHeight = Math.max(geometry.viewportHeight, 1);
  const imageNaturalWidth = Math.max(geometry.imageNaturalWidth, 1);
  const imageNaturalHeight = Math.max(geometry.imageNaturalHeight, 1);
  const coverScale = Math.max(
    viewportWidth / imageNaturalWidth,
    viewportHeight / imageNaturalHeight,
  );
  const actualScale = coverScale * clampProfileZoom(profile.photoZoom);
  const scaledWidth = imageNaturalWidth * actualScale;
  const scaledHeight = imageNaturalHeight * actualScale;
  const overflowX = Math.max(scaledWidth - viewportWidth, 0);
  const overflowY = Math.max(scaledHeight - viewportHeight, 0);
  const x = -(overflowX * clampProfilePosition(profile.photoPositionX)) / 100;
  const y = -(overflowY * clampProfilePosition(profile.photoPositionY)) / 100;

  return {
    actualScale,
    coverScale,
    overflowX,
    overflowY,
    scaledHeight,
    scaledWidth,
    x,
    y,
  };
}

export function dragDeltaToProfilePosition({
  deltaX,
  deltaY,
  geometry,
  profile,
}: {
  deltaX: number;
  deltaY: number;
  geometry: ProfilePhotoGeometry;
  profile: Pick<UserProfile, "photoPositionX" | "photoPositionY" | "photoZoom">;
}) {
  const transform = calculateProfilePhotoTransform(profile, geometry);

  return {
    photoPositionX:
      transform.overflowX <= 0
        ? 50
        : clampProfilePosition(
            profile.photoPositionX - (deltaX / transform.overflowX) * 100,
          ),
    photoPositionY:
      transform.overflowY <= 0
        ? 50
        : clampProfilePosition(
            profile.photoPositionY - (deltaY / transform.overflowY) * 100,
          ),
  };
}

export function profilePhotoImageStyle(
  profile: Pick<UserProfile, "photoPositionX" | "photoPositionY" | "photoZoom">,
  geometry?: ProfilePhotoGeometry | null,
): CSSProperties {
  void geometry;
  const x = clampProfilePosition(profile.photoPositionX);
  const y = clampProfilePosition(profile.photoPositionY);
  const zoom = clampProfileZoom(profile.photoZoom);

  return {
    height: "100%",
    inset: 0,
    objectFit: "cover" as const,
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${zoom})`,
    transformOrigin: `${x}% ${y}%`,
    width: "100%",
  };
}
