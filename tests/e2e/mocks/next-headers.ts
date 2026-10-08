export const cookies = async () => ({ getAll: () => [], set() {} });
export const headers = async () => ({ get: (k: string) => (k.toLowerCase() === 'origin' ? 'https://pera.example' : null) });
