/**
 * Centralized Permission Checking System
 * Defines what each user type can and cannot do
 */

export type UserType =
  | "master"
  | "property_manager"
  | "user"
  | "vendor"
  | "attendee"
  | "corporate_administrator"
  | "owner"

export type UserRolesInput =
  | UserType
  | string
  | Array<UserType | string>
  | { user_type?: string; roles?: string[] }

/**
 * Normalize various inputs (single type, array of types, or user object)
 * into a flat array of role strings.
 */
const normalizeRoles = (input: UserRolesInput): string[] => {
  if (Array.isArray(input)) {
    return input as string[]
  }

  // If it's a user-like object with roles / user_type
  if (typeof input === "object" && input !== null) {
    const roles: string[] = []

    if (Array.isArray((input as any).roles)) {
      roles.push(...((input as any).roles as string[]))
    }

    if (typeof (input as any).user_type === "string") {
      roles.push((input as any).user_type as string)
    }

    return roles
  }

  // Single string role
  if (typeof input === "string") {
    return [input]
  }

  return []
}

/**
 * Helper: does the user have ANY of the allowed roles?
 */
const hasAnyRole = (
  input: UserRolesInput,
  allowed: (UserType | string)[],
): boolean => {
  const roles = normalizeRoles(input)
  if (roles.length === 0) return false
  return roles.some((r) => allowed.includes(r))
}

/**
 * Can this user type access the Admin Panel?
 */
export const canAccessAdmin = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "property_manager", "corporate_administrator"])
}

/**
 * Can this user type manage companies?
 * Master and Corporate Administrators can create/edit/delete companies
 */
export const canManageCompanies = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "corporate_administrator"])
}

/**
 * Can this user type create new users?
 */
export const canCreateUser = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "property_manager", "corporate_administrator"])
}

/**
 * Can this user type create new buildings?
 */
export const canCreateBuilding = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "property_manager", "corporate_administrator"])
}

/**
 * Can this user type create meetings?
 */
export const canCreateMeeting = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "property_manager", "corporate_administrator"])
}

/**
 * Can this user type edit meetings?
 * Attendees and Vendors can only VIEW meetings
 * Owners can view and edit meetings (like regular users)
 *
 * Logic: if ALL roles are attendee/vendor -> read-only.
 * If user has at least one stronger role, allow editing.
 */
export const canEditMeeting = (user: UserRolesInput): boolean => {
  const roles = normalizeRoles(user)
  if (roles.length === 0) return false
  const blocked = roles.every((r) => ["attendee", "vendor"].includes(r))
  return !blocked
}

/**
 * Can this user type see ALL buildings across ALL companies?
 * Only Masters see everything
 */
export const canManageAllBuildings = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master"])
}

/**
 * Can this user type see ALL users across ALL companies?
 * Only Masters see everyone
 */
export const canManageAllUsers = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master"])
}

/**
 * Can this user type see all data in their company?
 * Corporate Administrators see everything in their company
 */
export const canManageCompanyData = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "corporate_administrator"])
}

/**
 * Can this user type assign tasks to others?
 */
export const canAssignTasks = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "property_manager", "corporate_administrator"])
}

/**
 * Is this user type read-only?
 * Attendees can only VIEW, not edit anything
 *
 * If user has ANY non-attendee role, they are not read-only.
 */
export const isReadOnly = (user: UserRolesInput): boolean => {
  const roles = normalizeRoles(user)
  if (roles.length === 0) return false
  const allAttendee = roles.every((r) => r === "attendee")
  return allAttendee
}

/**
 * Can this user type update task status?
 * Vendors can update tasks assigned to them
 * Owners can update task status (like regular users)
 */
export const canUpdateTaskStatus = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, [
    "master",
    "property_manager",
    "corporate_administrator",
    "vendor",
    "user",
    "owner",
  ])
}

/**
 * Should this user type see vendor management features?
 */
export const canManageVendors = (user: UserRolesInput): boolean => {
  return hasAnyRole(user, ["master", "property_manager", "corporate_administrator"])
}

/**
 * Get user-friendly display name for user type
 */
export const getUserTypeDisplayName = (userType: UserType | string): string => {
  const names: Record<string, string> = {
    master: "System Administrator",
    property_manager: "Property Manager",
    user: "User",
    vendor: "Vendor",
    attendee: "Meeting Attendee",
    corporate_administrator: "Corporate Administrator",
    owner: "Owner",
  }
  return names[userType] || userType
}

/**
 * Get description of what this user type can do
 */
export const getUserTypeDescription = (userType: UserType | string): string => {
  const descriptions: Record<string, string> = {
    master: "Full system access - manages everything across all companies",
    property_manager: "Manages buildings and meetings within their company",
    user: "Basic access to assigned buildings",
    vendor: "Receives and updates assigned tasks",
    attendee: "View-only access to meetings they attend",
    corporate_administrator:
      "Manages multiple property managers and buildings within their company",
    owner: "Property owner with access to assigned buildings and meetings",
  }
  return descriptions[userType] || "User with standard access"
}

/**
 * Check if two users are in the same company
 */
export const isSameCompany = (
  companyId1: number | null | undefined,
  companyId2: number | null | undefined,
): boolean => {
  if (!companyId1 || !companyId2) return false
  return companyId1 === companyId2
}

/**
 * Should filter data by company?
 * Master sees all, Corporate Admin and Property Manager see only their company
 */
export const shouldFilterByCompany = (user: UserRolesInput): boolean => {
  // Masters see everything -> no filter
  if (hasAnyRole(user, ["master"])) return false
  return hasAnyRole(user, ["corporate_administrator", "property_manager"])
}
