const ASIA_SHANGHAI_OFFSET = 8 * 60;

export function nowInShanghai(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + ASIA_SHANGHAI_OFFSET * 60000);
}

export function formatISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
}

export function formatDateShanghai(date: Date | string): string {
  const d = typeof date === "string" ? parseShanghaiDate(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseShanghaiDate(iso: string): Date {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
      parseInt(match[4]),
      parseInt(match[5]),
      parseInt(match[6])
    );
  }
  const d = new Date(iso);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + ASIA_SHANGHAI_OFFSET * 60000);
}

export function startOfDay(date: Date | string): Date {
  const d = typeof date === "string" ? parseShanghaiDate(date) : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

export function parseAsOfDate(asOf?: string): Date {
  if (!asOf) {
    return nowInShanghai();
  }
  const parsed = parseShanghaiDate(asOf);
  if (isNaN(parsed.getTime())) {
    return nowInShanghai();
  }
  return parsed;
}

export function daysAgo(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getBatchTag(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const season = month < 3 ? "W" : month < 6 ? "S1" : month < 9 ? "S2" : "A";
  return `${year}-${season}`;
}
