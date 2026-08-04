import type { Meta, StoryObj } from "@storybook/react";
import { List } from "./List.js";
import { listItems, listSortOptions } from "../../fixtures/lists.js";

const meta: Meta<typeof List> = {
  title: "Molecules/List",
  component: List,
  tags: ["autodocs"],
  args: {
    items: listItems,
    ariaLabel: "Documentos",
    title: "Documentos",
    rowActionsLabel: "Acciones de la fila",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Completa: Story = {
  args: {
    searchLabel: "Buscar",
    searchPlaceholder: "Filtrar por título o fecha",
    sortLabel: "Ordenar por",
    sortOptions: listSortOptions,
    pageSize: 3,
  },
};

export const Cargando: Story = {
  args: {
    isLoading: true,
    loadingLabel: "Cargando documentos…",
  },
};

export const Vacia: Story = {
  args: {
    items: [],
    emptyLabel: "No hay documentos todavía",
  },
};

export const SinControles: Story = {
  args: {
    title: undefined,
  },
};
