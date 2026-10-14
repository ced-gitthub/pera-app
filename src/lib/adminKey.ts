// The server needs the SECRET key. A publishable key makes the database see an anonymous caller, so treat it as "not configured" instead of failing later with a vague error.
export const looksLikeServerKey = (k: string | undefined): boolean => !!k && k.trim() !== '' && !k.trim().startsWith('sb_publishable_');
