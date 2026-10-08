/**
 * Returns a normalized YYYY-MM-DD date from an explicit lesson date or from
 * the beginning of a lesson title such as:
 *   02.09.26 програмування 1
 *   07.09.2026 дискр матем 3
 *
 * Explicit lessonDate/date always wins. If neither is present, the title is
 * used as a fallback so existing Firebase lessons do not need to be edited.
 */
export function inferDateFromTitle(title = '') {
  const match = String(title).match(/(^|\s|\[|\()([0-3]?\d)\.([01]?\d)\.(\d{2}|\d{4})(?=\s|$|[-–—:])/);
  if (!match) return '';

  const day = Number(match[2]);
  const month = Number(match[3]);
  let year = Number(match[4]);
  if (year < 100) year += 2000;

  // Let the Date constructor validate the calendar date without timezone drift.
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return '';

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function lessonDateKey(video = {}) {
  return video.lessonDate || video.date || inferDateFromTitle(video.title || '') || '';
}
