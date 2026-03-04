import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

interface PageExtraction {
  pageNumber: number;
  text: string;
}

/**
 * Extract text per page/slide from an uploaded file.
 * Returns an array of { pageNumber, text } for each page.
 */
export async function extractTextPerPage(file: File): Promise<PageExtraction[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    const text = await file.text();
    return [{ pageNumber: 1, text }];
  }

  if (name.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdf = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await pdf.getText();
    // pdf-parse returns pages separated by form feed characters
    const pages = result.text.split("\f").filter((p: string) => p.trim());
    if (pages.length === 0) return [{ pageNumber: 1, text: result.text }];
    return pages.map((text: string, i: number) => ({ pageNumber: i + 1, text: text.trim() }));
  }

  if (name.endsWith(".pptx")) {
    const officeparser = await import("officeparser");
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await officeparser.parseOfficeAsync(buffer);
    // officeparser returns all text concatenated — split on common slide delimiters
    const slideTexts = text.split(/\n{3,}/).filter((s: string) => s.trim());
    if (slideTexts.length <= 1) return [{ pageNumber: 1, text: text.trim() }];
    return slideTexts.map((text: string, i: number) => ({ pageNumber: i + 1, text: text.trim() }));
  }

  if (/\.(jpe?g|png|webp)$/.test(name)) {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Return only the extracted text, nothing else.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content ?? "";
    return [{ pageNumber: 1, text }];
  }

  throw new Error(
    `Unsupported file type: ${name}. Supported: .txt, .md, .csv, .pdf, .pptx, .jpg, .jpeg, .png, .webp`
  );
}

/**
 * Extract text content from an uploaded file (backward compatible).
 * Returns all text concatenated.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const pages = await extractTextPerPage(file);
  return pages.map((p) => p.text).join("\n\n");
}

/**
 * Extract text per page from a Buffer given a filename/mimeType.
 */
export async function extractTextPerPageFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<PageExtraction[]> {
  // Create a File-like object from the buffer using Uint8Array (avoids Buffer/BlobPart incompatibility)
  const uint8 = new Uint8Array(buffer);
  const blob = new Blob([uint8], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  return extractTextPerPage(file);
}
