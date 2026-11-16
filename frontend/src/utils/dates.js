// Sequelize serializes timestamps as createdAt even when SQL uses created_at.
export function formatAuditDate(record, locales, options) {
  const value = record?.createdAt ?? record?.created_at;
  if (value === null || value === undefined || value === '') return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(locales, options);
}
