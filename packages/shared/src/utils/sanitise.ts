/**
 * Pure-JS HTML stripper used as a Zod `.transform()` on free-text fields.
 *
 * Lives in @tmjconnect/shared (not the API package) so that schemas can declare
 * sanitisation inline. The shared package only depends on Zod, so DOMPurify is
 * deliberately not used here — instead we apply a strict "no markup at all"
 * filter via regex, iterated until the output is stable. The iteration handles
 * malformed-tag obfuscation like `<<script>script>` which a single pass would miss.
 *
 * This is defence-in-depth: clients (React / React Native) escape on render by
 * default, so the practical risk is "user A's note is rendered into user B's
 * dashboard via dangerouslySetInnerHTML or similar accident". Stripping at write
 * time is the cheapest insurance against that.
 */
export function stripHtml(input: string): string {
  let prev: string;
  let curr = input;
  do {
    prev = curr;
    curr = prev
      // Strip script/style/iframe tag PAIRS including their contents — matches
      // DOMPurify's "dangerous element" handling. A bare `<script>alert(1)`
      // (no closing tag) falls through to the generic tag stripper below.
      .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
      // Open/close/self-closing tags (generic).
      .replace(/<\/?[a-z][^>]*>/gi, '')
      // HTML comments and CDATA.
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  } while (curr !== prev);
  return curr.trim();
}
