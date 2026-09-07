export const VERBA_BASE_PATH = process.env.NEXT_PUBLIC_VERBA_BASE_PATH ?? "";

export function withBasePath(path: string) {
  if (!VERBA_BASE_PATH) return path;
  return `${VERBA_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
