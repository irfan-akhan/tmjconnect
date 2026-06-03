import { UAParser } from 'ua-parser-js';

/**
 * Parses a raw user-agent string into a short human-readable label.
 * Examples:
 *   "Chrome 125 on Windows 11"
 *   "Safari on iPhone (iOS 17)"
 *   "TMJConnect App on Samsung Galaxy S24 (Android 14)"
 *   "Unknown device"
 */
export function parseDevice(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';

  const parser = new UAParser(ua);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const parts: string[] = [];

  // Browser / app name
  const appName = browser.name
    ? `${browser.name}${browser.version ? ' ' + browser.version.split('.')[0] : ''}`
    : null;

  // Device model (phone/tablet)
  const model = device.model || null;

  // OS label
  const osLabel = os.name
    ? `${os.name}${os.version ? ' ' + os.version : ''}`
    : null;

  if (appName) parts.push(appName);

  if (model && osLabel) {
    parts.push(`on ${model} (${osLabel})`);
  } else if (model) {
    parts.push(`on ${model}`);
  } else if (osLabel) {
    parts.push(`on ${osLabel}`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Unknown device';
}
