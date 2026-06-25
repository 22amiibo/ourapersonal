import sanitizeHtml from "sanitize-html";

// Sanitize newsletter HTML before storing/rendering: keep readable structure,
// strip scripts/styles/iframes/tracking pixels and all event handlers.
export function sanitizeArticleHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "hr", "span", "div", "blockquote", "pre", "code",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "dl", "dt", "dd",
      "strong", "b", "em", "i", "u", "s", "sub", "sup", "small", "mark",
      "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height"],
      "*": [],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Only allow images over http(s) (no data: tracking blobs).
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      // Force links to open safely if ever rendered outside the in-app sheet.
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
    // Drop 1x1 / tracking pixels and spacer images.
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const w = Number(frame.attribs.width);
      const h = Number(frame.attribs.height);
      return (w > 0 && w <= 2) || (h > 0 && h <= 2);
    },
  });
}

// First non-tracking image URL in the HTML (used as the article hero/banner).
export function firstImageUrl(html: string): string | null {
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src = m[1];
    if (!/^https?:\/\//i.test(src)) continue;
    const wMatch = /\bwidth=["']?(\d+)/i.exec(tag);
    const hMatch = /\bheight=["']?(\d+)/i.exec(tag);
    const w = wMatch ? Number(wMatch[1]) : null;
    const h = hMatch ? Number(hMatch[1]) : null;
    if ((w != null && w <= 2) || (h != null && h <= 2)) continue; // tracking pixel
    return src;
  }
  return null;
}

// Drop newsletter preheader noise: beehiiv's plain-text part leads with
// "View image: (https://…)" placeholders and bare tracking URLs. Left in, the
// unbroken URLs also overflow the card horizontally (zoomed-in layout on iOS).
function stripPreviewNoise(s: string): string {
  return s
    .replace(/view image:?\s*\(?https?:\/\/\S+\)?/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Short plain-text description from the email's text (preheader / first line).
export function deriveDescription(text: string | undefined, fallbackHtml: string): string {
  const fromText = stripPreviewNoise((text ?? "").replace(/\s+/g, " ").trim());
  if (fromText) return fromText.slice(0, 200);
  const stripped = stripPreviewNoise(
    sanitizeHtml(fallbackHtml, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim(),
  );
  return stripped.slice(0, 200);
}
