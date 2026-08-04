import type { ReactElement } from "react";

export interface ChoiceGroupProps {
  /** El enunciado de la pregunta, que hace de `<legend>` del grupo. */
  legend: string;
  options: string[];
  /** Prefijo del `name` de los radios: dos grupos con el mismo `name` serían uno solo. */
  name: string;
  selected: number | null;
  onSelect: (index: number) => void;
}

/**
 * Grupo de opciones excluyentes, compartido por los tres tipos que se
 * responden igual (`multiple_choice`, `listening_comprehension` y
 * `reading_comprehension`): los tres traen `question` + `options[]` y los tres
 * devuelven `{ correct: índice }`.
 *
 * `<fieldset>`/`<legend>` y radios nativos: el navegador ya da el recorrido
 * con flechas dentro del grupo y anuncia la pregunta como etiqueta del
 * conjunto. Sin literales: todo el texto que se pinta viene del ejercicio.
 */
export function ChoiceGroup({ legend, options, name, selected, onSelect }: ChoiceGroupProps): ReactElement {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 font-medium">{legend}</legend>
      {options.map((option, index) => (
        <label key={index} className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            value={String(index)}
            checked={selected === index}
            onChange={() => onSelect(index)}
          />
          <span>{option}</span>
        </label>
      ))}
    </fieldset>
  );
}
