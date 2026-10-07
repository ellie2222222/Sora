import { isTimeZone } from '@sora/contracts';

/**
 * Always offered, ahead of the runtime's own list: some engines list only legacy names
 * (`Asia/Saigon` for Asia/Ho_Chi_Minh), and some can't list zones at all. Only a menu: any
 * zone `isTimeZone` accepts can still be searched for and saved.
 */
const SUGGESTED_TIME_ZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Johannesburg',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Pacific/Honolulu',
  'UTC',
] as const;

function runtimeTimeZones(): readonly string[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf;
  try {
    return supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

/** Every zone to offer, the given ones first (the wallet's, this device's), matching `query` when set. */
export function timeZoneOptions(pinned: readonly string[], query: string): string[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '_');
  const all = [...new Set([...pinned, ...SUGGESTED_TIME_ZONES, ...runtimeTimeZones()])];
  const matches = needle.length === 0 ? all : all.filter((zone) => zone.toLowerCase().includes(needle));
  // A valid zone the list doesn't carry is still offered, so the menu never limits what can be saved.
  const typed = query.trim();
  if (typed.length > 0 && isTimeZone(typed) && !matches.some((zone) => zone.toLowerCase() === typed.toLowerCase())) {
    matches.unshift(typed);
  }
  return matches;
}

/** "America/Los_Angeles" → "America / Los Angeles". */
export function timeZoneLabel(zone: string): string {
  return zone.replace(/_/g, ' ').replace(/\//g, ' / ');
}
