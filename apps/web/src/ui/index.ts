/**
 * Punto de entrada del sistema de diseño (Tarea 4 del panel).
 *
 * `./tokens.css` no se reexporta desde aquí — ya se importa una vez desde
 * `apps/web/src/index.css`. Quien construya una pantalla solo necesita
 * `import { Button, Input, ... } from "../ui"`.
 */
export { Button } from "./Button.js";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button.js";

export { Input } from "./Input.js";
export type { InputProps } from "./Input.js";

export { Select } from "./Select.js";
export type { SelectProps, SelectOption } from "./Select.js";

export { Table } from "./Table.js";
export type { TableProps, TableColumn } from "./Table.js";

export { Card } from "./Card.js";
export type { CardProps } from "./Card.js";

export { Tag } from "./Tag.js";
export type { TagProps, TagVariant } from "./Tag.js";

export { Dialog } from "./Dialog.js";
export type { DialogProps } from "./Dialog.js";

export { ToastProvider } from "./Toast.js";
export type { ToastProviderProps } from "./Toast.js";
export { useToast } from "./toast-context.js";
export type { ToastOptions, ToastVariant } from "./toast-context.js";

export { EmptyState } from "./EmptyState.js";
export type { EmptyStateProps } from "./EmptyState.js";

export { ErrorState } from "./ErrorState.js";
export type { ErrorStateProps } from "./ErrorState.js";

export { Skeleton } from "./Skeleton.js";
export type { SkeletonProps } from "./Skeleton.js";
