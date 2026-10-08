// Captures outgoing mail instead of opening an SMTP connection.
export default { createTransport: () => ({ sendMail: async (m: any) => { const g = globalThis as any; if (g.__mailFail) throw new Error('smtp down'); (g.__sent ??= []).push(m); } }) };
