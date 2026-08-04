import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "../EmptyState/EmptyState.js";
import { ErrorState } from "../ErrorState/ErrorState.js";
import { Table } from "./Table.js";
import type { TableColumn } from "./Table.js";

interface Alumno {
  id: string;
  nombre: string;
  nivel: string;
  horas: number;
}

const columnas: TableColumn<Alumno>[] = [
  { key: "nombre", header: "Nombre", render: (alumno) => alumno.nombre },
  { key: "nivel", header: "Nivel", render: (alumno) => alumno.nivel },
  { key: "horas", header: "Horas", numeric: true, render: (alumno) => String(alumno.horas) },
];

const alumnos: Alumno[] = [
  { id: "1", nombre: "Ana García", nivel: "B2", horas: 12 },
  { id: "2", nombre: "Bruno Díaz", nivel: "B1", horas: 8 },
  { id: "3", nombre: "Carla López", nivel: "C1", horas: 21 },
];

const meta: Meta<typeof Table<Alumno>> = {
  title: "Molecules/Table",
  component: Table<Alumno>,
  tags: ["autodocs"],
  args: {
    columns: columnas,
    rows: alumnos,
    getRowKey: (alumno) => alumno.id,
    caption: "Alumnos del grupo B2 de los martes",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const ConDatos: Story = {};

export const LeyendaOculta: Story = {
  args: { captionVisuallyHidden: true },
};

export const Cargando: Story = {
  args: { isLoading: true, rows: [] },
};

export const Vacia: Story = {
  args: {
    rows: [],
    emptyState: (
      <EmptyState
        title="Todavía no hay alumnos en este grupo"
        description="Cuando añadas el primero aparecerá aquí."
      />
    ),
  },
};

export const ConError: Story = {
  args: {
    rows: [],
    error: <ErrorState title="No se pudo cargar la lista de alumnos" />,
  },
};
