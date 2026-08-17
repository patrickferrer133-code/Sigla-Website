const MINIMUM_ACCOUNT_AGE_YEARS = 18;

export function ageInYears(dateOfBirth: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
}

// docs/06 section 6: minimum account age is 18. "18 is the simplest
// defensible line for a coaching marketplace" — no under-18 accounts in v1,
// not a soft warning.
export function isAtLeastMinimumAge(dateOfBirth: Date, now: Date = new Date()): boolean {
  return ageInYears(dateOfBirth, now) >= MINIMUM_ACCOUNT_AGE_YEARS;
}
