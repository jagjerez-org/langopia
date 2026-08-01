import type { BlockSnapshot } from "../../domain/model/block.vo.js";

export const SITE_EDITOR_REPOSITORY = Symbol("SiteEditorRepository");

export type EditableSitePage = {
  id: string;
  slug: string;
  title: string;
  locale: string;
  isHome: boolean;
  published: boolean;
  blocks: BlockSnapshot[];
};

export type EditableTeacherOption = {
  teacherId: string;
  displayName: string;
  imageUrl: string | null;
  imageRights: boolean;
};

export type EditableSite = {
  site: {
    id: string;
    status: "draft" | "published" | "unpublished";
    primaryLocale: string;
    theme: Record<string, unknown>;
    previewUrl: string;
  };
  locales: string[];
  pages: EditableSitePage[];
  teacherOptions: EditableTeacherOption[];
};

export interface SiteEditorRepository {
  getEditableSite(previewBaseUrl: string): Promise<EditableSite | null>;
  replacePageBlocks(pageId: string, blocks: readonly BlockSnapshot[]): Promise<EditableSitePage | null>;
  publishSite(): Promise<EditableSite["site"] | null>;
  unpublishSite(): Promise<EditableSite["site"] | null>;
}
