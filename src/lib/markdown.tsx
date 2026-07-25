import { useEffect, useMemo, useRef } from "react";

// Minimal, safe-ish markdown renderer sufficient for chat: headings, bold, italic,
// inline code, code blocks, lists, blockquotes, links, tables (pipes), and paragraphs.
// Escapes HTML first, so raw HTML in AI output is displayed as text.

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

function inline(s: string) {
  s = esc(s);
  // images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, a, u) => `<img alt="${a}" src="${u}" loading="lazy" />`);
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // bold via __text__
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // inline code
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // strip stray asterisks (but preserve inside <code> tags we just made)
  s = s.replace(/\*+/g, "");
  return s;
}

function renderTable(rows: string[]): string {
  const cells = (r: string) =>
    r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const header = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const th = header.map((c) => `<th>${inline(c)}</th>`).join("");
  const trs = body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]); i++;
      }
      i++; // consume closing fence
      const raw = code.join("\n");
      const encoded = encodeURIComponent(raw);
      out.push(
        `<div class="code-block">` +
          (lang ? `<span class="code-lang">${esc(lang)}</span>` : "") +
          `<button type="button" class="copy-code" data-code="${encoded}">Copy</button>` +
          `<pre><code>${esc(raw)}</code></pre>` +
        `</div>`
      );
      continue;
    }
    // table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s|:-]+\|\s*$/.test(lines[i + 1])) {
      const rows: string[] = [line, lines[i + 1]]; i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      out.push(renderTable(rows));
      continue;
    }
    // heading
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    // blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++;
      }
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`);
      continue;
    }
    // paragraph (accumulate consecutive non-empty lines)
    if (line.trim() === "") { i++; continue; }
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|\s*\|.*\|\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => markdownToHtml(text), [text]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // KaTeX auto-render if available
    const w = window as unknown as {
      renderMathInElement?: (el: HTMLElement, opts: unknown) => void;
    };
    if (typeof w.renderMathInElement === "function") {
      try {
        w.renderMathInElement(el, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
          ],
          throwOnError: false,
        });
      } catch { /* ignore */ }
    }
    // Copy-code button wiring
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement;
      const btn = t.closest(".copy-code") as HTMLButtonElement | null;
      if (btn) {
        const code = decodeURIComponent(btn.dataset.code || "");
        navigator.clipboard.writeText(code).then(() => {
          const orig = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = orig; }, 1200);
        }).catch(() => {});
        return;
      }
      const img = t.closest("img") as HTMLImageElement | null;
      if (img && img.src) window.open(img.src, "_blank", "noopener");
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [html]);

  return <div ref={ref} className="prose-ai" dangerouslySetInnerHTML={{ __html: html }} />;
}