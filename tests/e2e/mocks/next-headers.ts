export const cookies = async () => ({ getAll: () => [], get: (_k: string) => undefined, set() {} });
export const headers = async () => ({ get: (k: string) => (k.toLowerCase() === 'origin' ? 'https://pera.example' : null) });
