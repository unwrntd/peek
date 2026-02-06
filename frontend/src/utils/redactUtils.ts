/**
 * Utility functions for redacting sensitive information
 * Uses bullet character (•) for consistent masking
 */

/**
 * Redact an IP address, preserving structure with dots
 * Example: 192.168.1.100 → •••.•••.•.•••
 */
export function redactIP(ip: string | null | undefined): string {
  if (!ip) return '—';
  // Replace each octet with bullets matching its length
  return ip.replace(/\d+/g, (match) => '•'.repeat(match.length));
}

/**
 * Redact a MAC address, preserving structure with colons/dashes
 * Example: 00:1A:2B:3C:4D:5E → ••:••:••:••:••:••
 */
export function redactMAC(mac: string | null | undefined): string {
  if (!mac) return '—';
  // Replace hex segments with bullets matching their length
  return mac.replace(/[0-9A-Fa-f]+/g, (match) => '•'.repeat(match.length));
}

/**
 * Redact a hostname/device name
 * Example: my-server → •••••••••
 */
export function redactHostname(name: string | null | undefined): string {
  if (!name) return '—';
  return '•'.repeat(name.length);
}

/**
 * Redact an email address, preserving @ and domain structure
 * Example: user@example.com → ••••@•••••••.•••
 */
export function redactEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return '•'.repeat(email.length);

  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1);

  // Redact local part and domain parts separately
  const redactedLocal = '•'.repeat(local.length);
  const redactedDomain = domain.replace(/[^.]/g, '•');

  return `${redactedLocal}@${redactedDomain}`;
}

/**
 * Redact a username
 * Example: admin → •••••
 */
export function redactUsername(name: string | null | undefined): string {
  if (!name) return '—';
  return '•'.repeat(name.length);
}

/**
 * Redact a switch name
 * Example: Core-Switch-01 → ••••••••••••••
 */
export function redactSwitchName(name: string | null | undefined): string {
  if (!name) return '—';
  return '•'.repeat(name.length);
}

/**
 * Generic redaction - replaces all characters with bullets
 * Preserves length for visual consistency
 */
export function redact(value: string | null | undefined): string {
  if (!value) return '—';
  return '•'.repeat(value.length);
}

/**
 * Redact a URL, preserving protocol and structure
 * Example: https://192.168.1.1:8080/path → https://•••.•••.•.•:••••/••••
 */
export function redactURL(url: string | null | undefined): string {
  if (!url) return '—';
  try {
    const parsed = new URL(url);
    const redactedHost = redactHostname(parsed.hostname);
    const redactedPath = parsed.pathname.length > 1 ? '/' + '•'.repeat(parsed.pathname.length - 1) : '';
    return `${parsed.protocol}//${redactedHost}${parsed.port ? ':' + '•'.repeat(parsed.port.length) : ''}${redactedPath}`;
  } catch {
    // If not a valid URL, just redact the whole thing
    return '•'.repeat(url.length);
  }
}
