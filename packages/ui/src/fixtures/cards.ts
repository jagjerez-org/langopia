import type { CardAction, CardImage, CardTag } from "../molecules/Card/Card.js";

/**
 * Datos ficticios neutros para stories y specs de `Card`.
 */

export const cardImage: CardImage = {
  src: "https://picsum.photos/seed/langopia-card/640/360",
  alt: "Paisaje de montañas al amanecer",
};

export const cardTags: CardTag[] = [
  { label: "Nuevo", variant: "accent" },
  { label: "Destacado", variant: "success" },
];

export const cardActions: CardAction[] = [
  { label: "Guardar", variant: "secondary" },
  { label: "Abrir", variant: "primary" },
];
