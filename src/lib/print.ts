/** Printing helpers.
 *
 *  Inside the Lovable preview the app runs in an iframe, where window.print()
 *  prints the surrounding editor chrome. To keep printing reliable we render the
 *  report markup into a hidden same-document iframe and print that iframe, which
 *  needs no popup permission.
 *
 *  Important: the print call must happen while the click is still an active user
 *  gesture. Waiting on font/image promises before calling print() makes browsers
 *  silently drop the request, so we inline the styles (no async stylesheet load)
 *  and print straight away, only waiting when an image has not loaded yet. */

/** Copy styles into the print document, inlining rules where we can so the
 *  print document needs no async network fetch. */
function collectStyles() {
  const parts: string[] = [];
  for (const node of Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]'),
  )) {
    if (node.tagName === "STYLE") {
      parts.push(node.outerHTML);
      continue;
    }
    const sheet = (node as HTMLLinkElement).sheet;
    let inlined = "";
    try {
      if (sheet) {
        inlined = Array.from(sheet.cssRules)
          .map((r) => r.cssText)
          .join("\n");
      }
    } catch {
      inlined = "";
    }
    if (inlined) parts.push(`<style>${inlined}</style>`);
    else parts.push(node.outerHTML);
  }
  return parts.join("\n");
}

function buildDoc(bodyHtml: string, title: string) {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${title}</title>${collectStyles()}` +
    `<style>body{background:#fff;margin:0;padding:0}.no-print{display:none!important}` +
    `.print\\:hidden{display:none!important}</style>` +
    `</head><body>${bodyHtml}</body></html>`
  );
}

/** True when every image in the print document has finished loading. */
function imagesReady(doc: Document) {
  return Array.from(doc.images).every((img) => img.complete);
}

/** Print markup inside a hidden iframe. Returns false if it could not start. */
function printViaIframe(bodyHtml: string, title: string) {
  try {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;left:0;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none;z-index:-1";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
      frame.remove();
      return false;
    }
    doc.open();
    doc.write(buildDoc(bodyHtml, title));
    doc.close();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      frame.remove();
    };
    const go = () => {
      try {
        win.focus();
        win.print();
      } catch {
        cleanup();
        return false;
      }
      return true;
    };
    // Keep the frame alive until printing really finishes. Removing it on a
    // short timer causes blank print previews in Safari and iframe previews.
    win.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 60_000);

    // Print immediately (still inside the user gesture) when the document is
    // already renderable; otherwise give pending images a brief moment.
    if (imagesReady(doc)) go();
    else {
      let printed = false;
      const attempt = () => {
        if (printed) return;
        printed = true;
        go();
      };
      for (const img of Array.from(doc.images)) {
        img.addEventListener("load", () => imagesReady(doc) && attempt(), { once: true });
        img.addEventListener("error", () => imagesReady(doc) && attempt(), { once: true });
      }
      setTimeout(attempt, 800);
    }
    return true;
  } catch {
    return false;
  }
}

/** Open a printable document in a popup and print it right away. */
function printViaPopup(bodyHtml: string, title: string) {
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return false;

  win.document.open();
  win.document.write(buildDoc(bodyHtml, title));
  win.document.close();
  try {
    win.focus();
    win.print();
  } catch {
    return false;
  }
  return true;
}

/** Print markup in the current page: mount it in a print-only root, hide
 *  everything else while printing. Works on iPhone/iPad (where printing a
 *  hidden iframe prints the parent page, yielding blank sheets) and desktop. */
function printInPage(bodyHtml: string, title: string) {
  try {
    document.getElementById("__print_root")?.remove();
    document.getElementById("__print_style")?.remove();
    const root = document.createElement("div");
    root.id = "__print_root";
    root.innerHTML = bodyHtml;
    const style = document.createElement("style");
    style.id = "__print_style";
    style.textContent =
      "#__print_root{display:none}" +
      "@media print{body>*:not(#__print_root){display:none!important}" +
      "#__print_root{display:block!important;background:#fff}" +
      "#__print_root .no-print,#__print_root .print\\:hidden{display:none!important}}";
    document.head.appendChild(style);
    document.body.appendChild(root);
    const prevTitle = document.title;
    document.title = title;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      root.remove();
      style.remove();
      document.title = prevTitle;
    };
    window.addEventListener("afterprint", () => setTimeout(cleanup, 500), { once: true });
    setTimeout(cleanup, 120_000);
    window.print();
    return true;
  } catch {
    return false;
  }
}

void printViaIframe;
void printViaPopup;

/** Print the given markup (in-page print-only root, popup fallback). */
export function printHtml(bodyHtml: string, title = document.title) {
  if (printInPage(bodyHtml, title)) return true;
  if (printViaPopup(bodyHtml, title)) return true;
  window.print();
  return false;
}

/** Print directly from a click handler. The hidden iframe needs no popup
 *  permission, so it is the primary path here too. */
export function printHtmlFromClick(bodyHtml: string, title = document.title) {
  return printHtml(bodyHtml, title);
}

/** Print a specific element's markup. */
export function printElement(el: HTMLElement | null, title?: string) {
  if (!el) return;
  printHtml(el.innerHTML, title ?? document.title);
}

export function printElementFromClick(el: HTMLElement | null, title?: string) {
  if (!el) return;
  printHtml(el.innerHTML, title ?? document.title);
}
