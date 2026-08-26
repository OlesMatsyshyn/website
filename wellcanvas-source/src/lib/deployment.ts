export const WELL_CANVAS_BASE_PATH =
  process.env.NEXT_PUBLIC_WELLCANVAS_BASE_PATH || "";

export function withBasePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${WELL_CANVAS_BASE_PATH}${normalizedPath}`;
}
