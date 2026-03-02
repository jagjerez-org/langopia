export enum Permission {
  MANAGE_MEMBERS = "manage_members",
  MANAGE_SETTINGS = "manage_settings",
  CREATE_CLASS = "create_class",
  EDIT_CLASS = "edit_class",
  CANCEL_CLASS = "cancel_class",
  VIEW_ALL_CLASSES = "view_all_classes",
  VIEW_OWN_CLASSES = "view_own_classes",
  JOIN_CLASS = "join_class",
  MANAGE_EXERCISES = "manage_exercises",
  MANAGE_LESSONS = "manage_lessons",
  MANAGE_LEARNING_PATHS = "manage_learning_paths",
  MANAGE_TEACHERS = "manage_teachers",
  INVITE_TEACHER = "invite_teacher",
  VIEW_ALL_REPORTS = "view_all_reports",
  VIEW_OWN_REPORTS = "view_own_reports",
  VIEW_STUDENTS = "view_students",
  VIEW_USAGE = "view_usage",
  MANAGE_API_KEYS = "manage_api_keys",
}

const ALL_PERMISSIONS = Object.values(Permission);

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(
    (p) => p !== Permission.MANAGE_API_KEYS
  ),
  teacher: [
    Permission.VIEW_OWN_CLASSES,
    Permission.JOIN_CLASS,
    Permission.VIEW_OWN_REPORTS,
    Permission.VIEW_STUDENTS,
  ],
  planner: [
    Permission.CREATE_CLASS,
    Permission.EDIT_CLASS,
    Permission.CANCEL_CLASS,
    Permission.VIEW_ALL_CLASSES,
    Permission.VIEW_STUDENTS,
  ],
  content_creator: [
    Permission.MANAGE_EXERCISES,
    Permission.MANAGE_LESSONS,
    Permission.MANAGE_LEARNING_PATHS,
  ],
  staff: [
    Permission.VIEW_ALL_CLASSES,
    Permission.VIEW_ALL_REPORTS,
    Permission.VIEW_STUDENTS,
    Permission.VIEW_USAGE,
  ],
};

export function hasPermission(roles: string[], permission: Permission): boolean {
  return roles.some((role) => {
    const perms = ROLE_PERMISSIONS[role];
    return perms?.includes(permission) ?? false;
  });
}
