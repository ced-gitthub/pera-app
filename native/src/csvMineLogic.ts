// Small pure rules for the export/import sheet and the first-run "Make it yours" screen (no react-native).

/** Pasted CSV text that has not been imported yet counts as unsaved work. */
export const csvDirty = (text: string): boolean => text.trim().length > 0;

/** The pop-out message after an import, plural-aware. */
export const importedToast = (added: number): string =>
  `Imported ${added.toLocaleString('en-US')} ${added === 1 ? 'entry' : 'entries'}`;

/** Which account to mark "Make it yours" as seen for: the loaded profile, else the local session (works offline), else nobody. */
export const seenUid = (profileUid: string | undefined, sessionUid: string | undefined): string | null => profileUid ?? sessionUid ?? null;
