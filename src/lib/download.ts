/** File download helper.
 *
 *  A detached <a> element with an object URL that is revoked on the very next
 *  line gets cancelled by most browsers (and always inside a sandboxed preview
 *  iframe). Attach the link to the document, click it, then clean up on a
 *  timer so the browser can start the download. */
export function downloadTextFile(
  content: string,
  filename: string,
  mime = "text/csv;charset=utf-8",
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}
