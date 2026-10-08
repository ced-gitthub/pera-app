export type SP = Promise<Record<string, string | undefined>>;
export const Flash = ({ sp }: { sp: Record<string, string | undefined> }) => sp.err ? <p className="flash bad" role="alert">{sp.err}</p> : sp.ok ? <p className="flash good">{sp.ok}</p> : null;
