import { useRedactStore } from '../stores/redactStore';
import {
  redact,
  redactIP,
  redactMAC,
  redactHostname,
  redactEmail,
  redactUsername,
  redactSwitchName,
  redactURL,
} from '../utils/redactUtils';

/**
 * Hook for widgets to access redact state and utility functions
 *
 * Usage:
 * ```typescript
 * const { rIP, rMAC, rHost } = useRedact();
 * return <td>{rIP(client.ip)}</td>;
 * ```
 */
export function useRedact() {
  const isRedacted = useRedactStore((state) => state.isRedacted);

  return {
    /** Whether redact mode is currently enabled */
    isRedacted,

    /** Generic redaction - replaces all characters with bullets */
    r: (value: string | null | undefined) => (isRedacted ? redact(value) : value ?? '—'),

    /** Redact IP address, preserving dot structure */
    rIP: (ip: string | null | undefined) => (isRedacted ? redactIP(ip) : ip ?? '—'),

    /** Redact MAC address, preserving colon/dash structure */
    rMAC: (mac: string | null | undefined) => (isRedacted ? redactMAC(mac) : mac ?? '—'),

    /** Redact hostname/device name */
    rHost: (name: string | null | undefined) => (isRedacted ? redactHostname(name) : name ?? '—'),

    /** Redact email, preserving @ and domain structure */
    rEmail: (email: string | null | undefined) => (isRedacted ? redactEmail(email) : email ?? '—'),

    /** Redact username */
    rUser: (name: string | null | undefined) => (isRedacted ? redactUsername(name) : name ?? '—'),

    /** Redact switch name */
    rSwitch: (name: string | null | undefined) => (isRedacted ? redactSwitchName(name) : name ?? '—'),

    /** Redact URL, preserving protocol and structure */
    rURL: (url: string | null | undefined) => (isRedacted ? redactURL(url) : url ?? '—'),
  };
}
