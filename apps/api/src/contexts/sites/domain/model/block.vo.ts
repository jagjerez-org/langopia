import { InvalidSiteBlockError } from "../errors/sites.errors.js";

export const SiteBlockType = {
  Hero: "hero",
  Courses: "courses",
  Teachers: "teachers",
  Pricing: "pricing",
  Testimonials: "testimonials",
  Faq: "faq",
  Contact: "contact",
  Text: "text",
} as const;

export type SiteBlockType = (typeof SiteBlockType)[keyof typeof SiteBlockType];

const SITE_BLOCK_TYPES = new Set<string>(Object.values(SiteBlockType));
const MAX_TEXT_BLOCKS = 20;
const MAX_TEXT_LENGTH = 2_000;

export type ImageReference = {
  url: string;
  alt: string;
};

export type HeroBlockProps = {
  headline: string;
  subtitle: string;
  image: ImageReference;
  callToAction: {
    label: string;
    href: string;
  };
};

export type CourseSource =
  | { kind: "all_active" }
  | { kind: "selected"; courseIds: readonly string[] };

export type TeacherSiteProfile = {
  teacherId: string;
  displayName: string;
  imageUrl: string | null;
  imageRights: boolean;
};

export type PricingBlockProps = {
  planIds: readonly string[];
};

export type TestimonialSiteEntry = {
  testimonialId: string;
  authorName: string;
  quote: string;
  public: boolean;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type ContactBlockProps = {
  title: string;
  submitLabel: string;
  leadSource: "school_site";
};

export type RichTextNode =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string };

type BlockPropsByType = {
  [SiteBlockType.Hero]: HeroBlockProps;
  [SiteBlockType.Courses]: { source: CourseSource };
  [SiteBlockType.Teachers]: { teachers: readonly TeacherSiteProfile[] };
  [SiteBlockType.Pricing]: PricingBlockProps;
  [SiteBlockType.Testimonials]: { testimonials: readonly TestimonialSiteEntry[] };
  [SiteBlockType.Faq]: { items: readonly FaqItem[] };
  [SiteBlockType.Contact]: ContactBlockProps;
  [SiteBlockType.Text]: { content: readonly RichTextNode[] };
};

export type BlockSnapshot = {
  [Type in SiteBlockType]: {
    id: string;
    type: Type;
    props: BlockPropsByType[Type];
  };
}[SiteBlockType];

export class Block {
  private constructor(
    private readonly _id: string,
    private readonly _type: SiteBlockType,
    private readonly _props: BlockPropsByType[SiteBlockType],
  ) {}

  static hero(params: { id: string } & HeroBlockProps): Block {
    const props = {
      headline: requireText(params.headline, "titular"),
      subtitle: requireText(params.subtitle, "subtítulo"),
      image: requireImage(params.image),
      callToAction: {
        label: requireText(params.callToAction.label, "llamada a la acción"),
        href: requireText(params.callToAction.href, "enlace de la llamada a la acción"),
      },
    };
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Hero, props);
  }

  static courses(params: { id: string; source: CourseSource }): Block {
    if (params.source.kind === "selected" && params.source.courseIds.length === 0) {
      throw new InvalidSiteBlockError("El bloque de cursos seleccionados necesita al menos un curso.");
    }
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Courses, {
      source:
        params.source.kind === "all_active"
          ? { kind: "all_active" }
          : { kind: "selected", courseIds: [...params.source.courseIds] },
    });
  }

  static teachers(params: { id: string; teachers: readonly TeacherSiteProfile[] }): Block {
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Teachers, {
      teachers: params.teachers.map((teacher) => ({
        teacherId: requireText(teacher.teacherId, "id del profesor"),
        displayName: requireText(teacher.displayName, "nombre del profesor"),
        imageUrl: teacher.imageUrl,
        imageRights: teacher.imageRights === true,
      })),
    });
  }

  static pricing(params: { id: string } & PricingBlockProps): Block {
    if (params.planIds.length === 0) {
      throw new InvalidSiteBlockError("El bloque de precios necesita al menos un plan real.");
    }
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Pricing, {
      planIds: [...params.planIds],
    });
  }

  static testimonials(params: {
    id: string;
    testimonials: readonly TestimonialSiteEntry[];
  }): Block {
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Testimonials, {
      testimonials: params.testimonials.map((testimonial) => ({
        testimonialId: requireText(testimonial.testimonialId, "id de la reseña"),
        authorName: requireText(testimonial.authorName, "autor de la reseña"),
        quote: requireText(testimonial.quote, "reseña"),
        public: testimonial.public === true,
      })),
    });
  }

  static faq(params: { id: string; items: readonly FaqItem[] }): Block {
    if (params.items.length === 0) {
      throw new InvalidSiteBlockError("El bloque de preguntas frecuentes necesita al menos una pregunta.");
    }
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Faq, {
      items: params.items.map((item) => ({
        question: requireText(item.question, "pregunta"),
        answer: requireText(item.answer, "respuesta"),
      })),
    });
  }

  static contact(params: { id: string } & ContactBlockProps): Block {
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Contact, {
      title: requireText(params.title, "título del formulario"),
      submitLabel: requireText(params.submitLabel, "texto del botón"),
      leadSource: params.leadSource,
    });
  }

  static text(params: { id: string; content: readonly RichTextNode[] }): Block {
    if (params.content.length === 0 || params.content.length > MAX_TEXT_BLOCKS) {
      throw new InvalidSiteBlockError("El bloque de texto necesita entre 1 y 20 fragmentos.");
    }
    return new Block(requireText(params.id, "id del bloque"), SiteBlockType.Text, {
      content: params.content.map((node) => {
        if (node.kind !== "heading" && node.kind !== "paragraph") {
          throw new InvalidSiteBlockError("El texto enriquecido solo admite títulos y párrafos.", {
            kind: (node as { kind?: unknown }).kind,
          });
        }
        const text = requireText(node.text, "texto");
        if (text.length > MAX_TEXT_LENGTH) {
          throw new InvalidSiteBlockError("Un fragmento de texto no puede superar 2000 caracteres.");
        }
        return { kind: node.kind, text };
      }),
    });
  }

  static from(snapshot: { id: string; type: string; props: unknown }): Block {
    if (!SITE_BLOCK_TYPES.has(snapshot.type)) {
      throw new InvalidSiteBlockError(`«${snapshot.type}» no pertenece al catálogo cerrado de bloques.`, {
        type: snapshot.type,
      });
    }
    const typed = snapshot as BlockSnapshot;
    switch (typed.type) {
      case SiteBlockType.Hero:
        return Block.hero({ id: typed.id, ...typed.props });
      case SiteBlockType.Courses:
        return Block.courses({ id: typed.id, ...typed.props });
      case SiteBlockType.Teachers:
        return Block.teachers({ id: typed.id, ...typed.props });
      case SiteBlockType.Pricing:
        return Block.pricing({ id: typed.id, ...typed.props });
      case SiteBlockType.Testimonials:
        return Block.testimonials({ id: typed.id, ...typed.props });
      case SiteBlockType.Faq:
        return Block.faq({ id: typed.id, ...typed.props });
      case SiteBlockType.Contact:
        return Block.contact({ id: typed.id, ...typed.props });
      case SiteBlockType.Text:
        return Block.text({ id: typed.id, ...typed.props });
    }
  }

  get id(): string {
    return this._id;
  }

  get type(): SiteBlockType {
    return this._type;
  }

  get courseSource(): CourseSource {
    return this.expectProps(SiteBlockType.Courses).source;
  }

  get visibleTeachers(): readonly TeacherSiteProfile[] {
    return this.expectProps(SiteBlockType.Teachers).teachers.filter((teacher) => teacher.imageRights);
  }

  get planIds(): readonly string[] {
    return this.expectProps(SiteBlockType.Pricing).planIds;
  }

  get publicTestimonials(): readonly TestimonialSiteEntry[] {
    return this.expectProps(SiteBlockType.Testimonials).testimonials.filter(
      (testimonial) => testimonial.public,
    );
  }

  get faqItems(): readonly FaqItem[] {
    return this.expectProps(SiteBlockType.Faq).items;
  }

  get leadSource(): "school_site" {
    return this.expectProps(SiteBlockType.Contact).leadSource;
  }

  get richText(): readonly RichTextNode[] {
    return this.expectProps(SiteBlockType.Text).content;
  }

  toSnapshot(): BlockSnapshot {
    return {
      id: this._id,
      type: this._type,
      props: structuredClone(this._props),
    } as BlockSnapshot;
  }

  private expectProps<T extends SiteBlockType>(type: T): BlockPropsByType[T] {
    if (this._type !== type) {
      throw new InvalidSiteBlockError(`El bloque ${this._id} no es de tipo ${type}.`);
    }
    return this._props as BlockPropsByType[T];
  }
}

function requireText(value: string, field: string): string {
  const text = value.trim();
  if (text.length === 0) throw new InvalidSiteBlockError(`El campo ${field} es obligatorio.`);
  return text;
}

function requireImage(image: ImageReference): ImageReference {
  return {
    url: requireText(image.url, "imagen"),
    alt: requireText(image.alt, "texto alternativo"),
  };
}
