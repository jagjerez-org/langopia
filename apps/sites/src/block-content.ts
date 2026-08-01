export type HeroView = {
  headline: string;
  subtitle: string;
  imageUrl: string | null;
  imageAlt: string;
  ctaLabel: string | null;
  ctaHref: string | null;
};

export type FaqView = {
  question: string;
  answer: string;
};

export type TextNodeView = {
  kind: "heading" | "paragraph";
  text: string;
};

export type TeacherView = {
  displayName: string;
  imageUrl: string | null;
};

export type TestimonialView = {
  authorName: string;
  quote: string;
};

export function heroContent(props: Record<string, unknown>): HeroView {
  const image = objectProp(props.image);
  const cta = objectProp(props.callToAction) ?? objectProp(props.cta);
  const imageUrl = textProp(image?.url) ?? imageKeyToPath(textProp(props.imageKey));

  return {
    headline: textProp(props.headline) ?? "Aprende idiomas con Langopia",
    subtitle: textProp(props.subtitle) ?? textProp(props.subheadline) ?? "",
    imageUrl,
    imageAlt: textProp(image?.alt) ?? "Clase de idiomas",
    ctaLabel: textProp(cta?.label),
    ctaHref: textProp(cta?.href),
  };
}

export function faqItems(props: Record<string, unknown>): FaqView[] {
  return arrayProp(props.items).flatMap((item) => {
    const record = objectProp(item);
    if (!record) return [];
    const question = textProp(record.question) ?? textProp(record.q);
    const answer = textProp(record.answer) ?? textProp(record.a);
    return question && answer ? [{ question, answer }] : [];
  });
}

export function textContent(props: Record<string, unknown>): TextNodeView[] {
  const content = arrayProp(props.content).flatMap((node) => {
    const record = objectProp(node);
    const kind: TextNodeView["kind"] | null =
      record?.kind === "heading" || record?.kind === "paragraph" ? record.kind : null;
    const text = textProp(record?.text);
    return kind && text ? [{ kind, text }] : [];
  });
  if (content.length > 0) return content;

  return legacyHtmlToTextNodes(textProp(props.html) ?? "");
}

export function teacherCards(props: Record<string, unknown>): TeacherView[] {
  return arrayProp(props.teachers).flatMap((teacher) => {
    const record = objectProp(teacher);
    const displayName = textProp(record?.displayName);
    if (!displayName) return [];
    return [{ displayName, imageUrl: textProp(record?.imageUrl) }];
  });
}

export function testimonialCards(props: Record<string, unknown>): TestimonialView[] {
  return arrayProp(props.testimonials).flatMap((testimonial) => {
    const record = objectProp(testimonial);
    const authorName = textProp(record?.authorName);
    const quote = textProp(record?.quote);
    return authorName && quote ? [{ authorName, quote }] : [];
  });
}

export function selectedIds(props: Record<string, unknown>, key: string): string[] {
  const direct = arrayProp(props[key]).flatMap((value) => {
    const text = textProp(value);
    return text ? [text] : [];
  });
  if (direct.length > 0) return direct;

  const source = objectProp(props.source);
  return arrayProp(source?.courseIds).flatMap((value) => {
    const text = textProp(value);
    return text ? [text] : [];
  });
}

export function booleanProp(props: Record<string, unknown>, key: string): boolean {
  return props[key] === true;
}

function imageKeyToPath(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${value}`;
}

function legacyHtmlToTextNodes(html: string): TextNodeView[] {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const nodes: TextNodeView[] = [];
  const pattern = /<(h1|h2|h3|p)[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of withoutScripts.matchAll(pattern)) {
    const tag = match[1]?.toLowerCase();
    const text = stripTags(match[2] ?? "");
    if (!text) continue;
    nodes.push({ kind: tag?.startsWith("h") ? "heading" : "paragraph", text });
  }
  return nodes;
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function objectProp(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayProp(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textProp(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
