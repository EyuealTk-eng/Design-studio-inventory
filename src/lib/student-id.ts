/**
 * One canonical spelling per student ID, so "ugr 2154 17", "UGR-2154-17" and
 * "UGR/2154/17" are all the same account (and can't be registered twice).
 */
export function canonicalStudentId(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s\-_\\.]+/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/|\/$/g, "");
}

/** University ID format, e.g. UGR/2154/17 (letters / number / two-digit year). */
export const STUDENT_ID_PATTERN = /^[A-Z]{2,5}\/\d{3,6}\/\d{2}$/;
