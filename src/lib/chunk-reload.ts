/**
 * After a new version is published, an open tab may still reference old
 * asset file names that no longer exist. Reloading once fetches the new ones.
 */
const RELOAD_KEY = "mp:chunk-reload-at";
const RELOAD_WINDOW_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(
    message,
  );
}

/** Reloads the page unless it already reloaded for this reason in the last few seconds. */
export function reloadOnceForStaleAssets(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (now - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // sessionStorage unavailable: still try a single reload.
  }
  window.location.reload();
  return true;
}

export function installStaleAssetRecovery() {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnceForStaleAssets()) event.preventDefault();
  });
}
