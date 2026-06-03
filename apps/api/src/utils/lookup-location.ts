/**
 * Simple IP-to-location lookup using ip-api.com (free, no key required).
 * Returns "City, Country" or "Unknown" on any failure.
 *
 * Notes:
 * - Free tier: 45 requests/minute (more than enough for paginated activity feeds)
 * - Private/local IPs return "Unknown"
 * - Results are cached in-memory to avoid repeated lookups for the same IP
 */

const cache = new Map<string, string>();
const CACHE_MAX = 500;
const TIMEOUT_MS = 3000;

export async function lookupLocation(ip: string | null | undefined): Promise<string> {
  if (!ip) return 'Unknown';

  // Skip private/local IPs
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.3') ||
    ip.startsWith('fe80:') ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fd')
  ) {
    return 'Unknown';
  }

  const cached = cache.get(ip);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,country`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return 'Unknown';

    const data = (await res.json()) as { status: string; city?: string; country?: string };

    if (data.status !== 'success' || !data.city || !data.country) return 'Unknown';

    const location = `${data.city}, ${data.country}`;

    // Evict oldest entries if cache is full
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(ip, location);

    return location;
  } catch {
    return 'Unknown';
  }
}

/**
 * Batch-resolve locations for multiple IPs (deduplicates lookups).
 * Returns a Map<ip, location>.
 */
export async function lookupLocations(ips: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ips.filter(Boolean) as string[])];
  const results = new Map<string, string>();

  // Resolve all in parallel (ip-api.com allows batch but this is simpler)
  await Promise.all(
    unique.map(async (ip) => {
      const loc = await lookupLocation(ip);
      results.set(ip, loc);
    }),
  );

  return results;
}
