import type { Meta, StoryObj } from "@storybook/react";
import { UserAvatar } from "./UserAvatar.js";
import type { UserAvatarSize } from "./UserAvatar.js";

/** Retrato de ejemplo en SVG incrustado: la story no depende de la red. */
const SAMPLE_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%230154e9'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%23ffffff'/%3E%3Cellipse cx='20' cy='35' rx='11' ry='8' fill='%23ffffff'/%3E%3C/svg%3E";

const meta: Meta<typeof UserAvatar> = {
  title: "Atoms/UserAvatar",
  component: UserAvatar,
  tags: ["autodocs"],
  argTypes: {
    name: { control: "text", description: "Nombre del usuario (iniciales y nombre accesible)" },
    src: { control: "text", description: "URL de la imagen, ya resuelta" },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"] satisfies UserAvatarSize[],
    },
  },
  args: {
    name: "Andrea Gil",
    size: "md",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const WithImage: Story = {
  args: { src: SAMPLE_AVATAR },
};

export const BrokenImage: Story = {
  args: { src: "/esta-imagen-no-existe.png" },
  name: "Imagen rota (cae a iniciales)",
};

export const SingleName: Story = {
  args: { name: "Andrea" },
};

export const AllSizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <UserAvatar key={size} name={args.name ?? "Andrea Gil"} src={args.src} size={size} />
      ))}
    </div>
  ),
};

export const AllSizesWithImage: Story = {
  ...AllSizes,
  args: { src: SAMPLE_AVATAR },
};
