/**
 * Parses a time string (HH:MM:SS) into seconds
 */
export function parseTime(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
}

/**
 * Formats seconds into a time string (HH:MM:SS)
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Adds seconds to a time string and returns a new time string
 */
export function addSeconds(timeString: string, secondsToAdd: number): string {
  const totalSeconds = parseTime(timeString) + secondsToAdd;
  return formatTime(totalSeconds);
}

/**
 * Calculates the difference between two time strings in seconds
 */
export function timeDifference(
  timeString1: string,
  timeString2: string
): number {
  return parseTime(timeString2) - parseTime(timeString1);
}

/**
 * Formats a time string as HH:MM (without seconds)
 */
export function formatTimeShort(timeString: string): string {
  return timeString.substring(0, 5);
}

/**
 * Checks if a time is between two other times
 */
export function isTimeBetween(
  timeToCheck: string,
  startTime: string,
  endTime: string
): boolean {
  const timeSeconds = parseTime(timeToCheck);
  const startSeconds = parseTime(startTime);
  const endSeconds = parseTime(endTime);

  return timeSeconds >= startSeconds && timeSeconds <= endSeconds;
}
