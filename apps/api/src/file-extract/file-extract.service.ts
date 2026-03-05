import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

interface PageExtraction {
  pageNumber: number;
  text: string;
}

@Injectable()
export class FileExtractService {
  private readonly logger = new Logger(FileExtractService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: this.config.get<string>("OPENAI_API_KEY"),
      });
    }
    return this.openai;
  }

  async extractTextPerPageFromBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<PageExtraction[]> {
    const name = filename.toLowerCase();

    if (
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv")
    ) {
      const text = buffer.toString("utf-8");
      return [{ pageNumber: 1, text }];
    }

    if (name.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      const pages = result.text.split("\f").filter((p: string) => p.trim());
      if (pages.length === 0)
        return [{ pageNumber: 1, text: result.text }];
      return pages.map((text: string, i: number) => ({
        pageNumber: i + 1,
        text: text.trim(),
      }));
    }

    if (name.endsWith(".pptx")) {
      const officeparser = await import("officeparser");
      const text = await officeparser.parseOfficeAsync(buffer);
      const slideTexts = text
        .split(/\n{3,}/)
        .filter((s: string) => s.trim());
      if (slideTexts.length <= 1)
        return [{ pageNumber: 1, text: text.trim() }];
      return slideTexts.map((text: string, i: number) => ({
        pageNumber: i + 1,
        text: text.trim(),
      }));
    }

    if (/\.(jpe?g|png|webp)$/.test(name)) {
      const base64 = buffer.toString("base64");
      const resolvedMimeType = mimeType || "image/jpeg";

      const response = await this.getOpenAI().chat.completions.create({
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
                image_url: {
                  url: `data:${resolvedMimeType};base64,${base64}`,
                },
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
      `Unsupported file type: ${name}. Supported: .txt, .md, .csv, .pdf, .pptx, .jpg, .jpeg, .png, .webp`,
    );
  }

  async extractTextFromBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const pages = await this.extractTextPerPageFromBuffer(
      buffer,
      filename,
      mimeType,
    );
    return pages.map((p) => p.text).join("\n\n");
  }
}
