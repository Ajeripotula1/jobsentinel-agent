// Convert ISO datestring into data format based on users current location.
// Null-safe: posted_at is null when the ATS didn't send a date, and
// `new Date(null)` would otherwise render as Jan 1, 1970.
export const formatDate = (iso) =>
    iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) : '—';
