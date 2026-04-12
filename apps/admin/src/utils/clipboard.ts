/**
 * clipboard.ts — Tiny wrapper around the Clipboard API.
 *
 * `navigator.clipboard.writeText` is async and only works in secure contexts.
 * For non-secure dev / older browsers we fall back to a hidden textarea +
 * document.execCommand('copy'). The fallback is short-circuited as soon as
 * the modern API is available.
 */
export async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}
