// Shared by the server action and the browser form. Server actions accept ~1 MB request bodies (and Vercel Hobby functions 4.5 MB),
// so the app limit stays safely below both and the form refuses larger files with a clear message instead of an error page.
export const MAX_CSV_BYTES = 900_000;
export const MAX_CSV_LABEL = '900 KB, roughly 9,000 rows';
