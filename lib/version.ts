// Single source of truth for the user-facing app version.
// Bump this on every release — the "What's new" popup keys off it, and the
// About page shows it. Each new version triggers a fresh update notice
// (the popup uses a per-version localStorage flag).
export const APP_VERSION = "1.1.0";
