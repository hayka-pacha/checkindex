/**
 * Normalizes a domain or URL to a bare, lowercase hostname.
 *
 * Handles: full URLs, www. prefix, uppercase, ports.
 * Returns invalid input as-is (lowercased).
 */
export function normalizeDomain(input: string): string {
  if (!input) return input;

  let hostname: string;

  try {
    // If it looks like a URL (has ://), parse it
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    hostname = url.hostname;
  } catch {
    return input.toLowerCase();
  }

  return hostname.toLowerCase().replace(/^www\./, '');
}
