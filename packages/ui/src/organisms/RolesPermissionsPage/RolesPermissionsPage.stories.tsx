import type { Meta, StoryObj } from "@storybook/react";
import {
  managementPermissionCatalog,
  managementRoles,
  rolesPermissionsLabels,
} from "../../fixtures/management.js";
import { RolesPermissionsPage } from "./RolesPermissionsPage.js";

const meta = {
  title: "Organisms/RolesPermissionsPage",
  component: RolesPermissionsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    roles: managementRoles,
    permissionCatalog: managementPermissionCatalog,
    labels: rolesPermissionsLabels,
    onTogglePermission: () => {},
    onCreateRole: () => {},
    onDeleteRole: () => {},
  },
} satisfies Meta<typeof RolesPermissionsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    roles: [],
  },
};
