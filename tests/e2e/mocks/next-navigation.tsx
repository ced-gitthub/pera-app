export function redirect(url: string): never { const e: any = new Error('NEXT_REDIRECT'); e.url = url; throw e; }
export function notFound(): never { const e: any = new Error('NEXT_NOT_FOUND'); e.notFound = true; throw e; }
export const useRouter = () => ({ refresh() {}, push() {} });
