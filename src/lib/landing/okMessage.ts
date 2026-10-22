// The email-confirmed link lands on the landing page as ?ok=<message>. Only this one fixed message is ever shown, never free text from the URL.
export const CONFIRMED = 'Email confirmed. Welcome to Zovix.';
export const isConfirmed = (search: string) => new URLSearchParams(search).get('ok') === CONFIRMED;
