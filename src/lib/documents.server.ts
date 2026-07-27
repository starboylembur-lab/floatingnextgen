// Server-only helpers for document ingestion (extraction + chunking).
// This file is client-blocked via `.server.ts` naming.
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export async function extractTextFromFile(bytes: Uint8Array, mime: string, name: string): Promise<string> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    const text: string | string[] = (result as { text: string | string[] }).text;
    return typeof text === "string" ? text : text.join("\n\n");
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const { value } = await mammoth.extractRawText({ arrayBuffer: copy.buffer });
    return value ?? "";
  }
  // txt / md / plain
  return new TextDecoder("utf-8").decode(bytes);
}

export function chunkText(input: string, size = 1000, overlap = 150): string[] {
  const text = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    if (end < text.length) {
      // prefer to break at paragraph or sentence boundary within the window
      const slice = text.slice(i, end);
      const bp = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (bp > size * 0.5) end = i + bp + 1;
    }
    const piece = text.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks;
}
