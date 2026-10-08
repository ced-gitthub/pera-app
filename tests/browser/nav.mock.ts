export const useRouter = () => ({ refresh() { (window as any).__refresh = ((window as any).__refresh || 0) + 1; }, push() {} });
