/**
 * Centralized Permission Checking System
 * Defines what each user type can and cannot do
 */


export type UserType = 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator' | 'owner'


/**
 * Can this user type access the Admin Panel?
 */
export const canAccessAdmin = (userType: UserType | string): boolean => {
  return ['master', 'property_manager', 'corporate_administrator'].includes(userType)
}


/**
 * Can this user type manage companies?
 * Master and Corporate Administrators can create/edit/delete companies
 */
export const canManageCompanies = (userType: UserType | string): boolean => {
  return ['master', 'corporate_administrator'].includes(userType)
}


/**
 * Can this user type create new users?
 */
export const canCreateUser = (userType: UserType | string): boolean => {
  return ['master', 'property_manager', 'corporate_administrator'].includes(userType)
}


/**
 * Can this user type create new buildings?
 */
export const canCreateBuilding = (userType: UserType | string): boolean => {
  return ['master', 'property_manager', 'corporate_administrator'].includes(userType)
}


/**
 * Can this user type create meetings?
 */
export const canCreateMeeting = (userType: UserType | string): boolean => {
  return ['master', 'property_manager', 'corporate_administrator'].includes(userType)
}


/**
 * Can this user type edit meetings?
 * Attendees and Vendors can only VIEW meetings
 * Owners can view and edit meetings (like regular users)
 */
export const canEditMeeting = (userType: UserType | string): boolean => {
  return !['attendee', 'vendor'].includes(userType)
}


/**
 * Can this user type see ALL buildings across ALL companies?
 * Only Masters see everything
 */
export const canManageAllBuildings = (userType: UserType | string): boolean => {
  return userType === 'master'
}


/**
 * Can this user type see ALL users across ALL companies?
 * Only Masters see everyone
 */
export const canManageAllUsers = (userType: UserType | string): boolean => {
  return userType === 'master'
}


/**
 * Can this user type see all data in their company?
 * Corporate Administrators see everything in their company
 */
export const canManageCompanyData = (userType: UserType | string): boolean => {
  return ['master', 'corporate_administrator'].includes(userType)
}


/**
 * Can this user type assign tasks to others?
 */
export const canAssignTasks = (userType: UserType | string): boolean => {
  return ['master', 'property_manager', 'corporate_administrator'].includes(userType)
}


/**
 * Is this user type read-only?
 * Attendees can only VIEW, not edit anything
 */
export const isReadOnly = (userType: UserType | string): boolean => {
  return userType === 'attendee'
}


/**
 * Can this user type update task status?
 * Vendors can update tasks assigned to them
 * Owners can update task status (like regular users)
 */
export const canUpdateTaskStatus = (userType: UserType | string): boolean => {
  return ['master', 'property_manager', 'corporate_administrator', 'vendor', 'user', 'owner'].includes(userType)
}


/**
 * Should this user type see vendor management features?
 */
export const canManageVendors = (userType: UserType | string): boolean => {
  return ['master', 'property_manager', 'corporate_administrator'].includes(userType)
}


/**
 * Get user-friendly display name for user type
 */
export const getUserTypeDisplayName = (userType: UserType | string): string => {
  const names: Record<string, string> = {
    master: 'System Administrator',
    property_manager: 'Property Manager',
    user: 'User',
    vendor: 'Vendor',
    attendee: 'Meeting Attendee',
    corporate_administrator: 'Corporate Administrator',
    owner: 'Owner'
  }
  return names[userType] || userType
}


/**
 * Get description of what this user type can do
 */
export const getUserTypeDescription = (userType: UserType | string): string => {
  const descriptions: Record<string, string> = {
    master: 'Full system access - manages everything across all companies',
    property_manager: 'Manages buildings and meetings within their company',
    user: 'Basic access to assigned buildings',
    vendor: 'Receives and updates assigned tasks',
    attendee: 'View-only access to meetings they attend',
    corporate_administrator: 'Manages multiple property managers and buildings within their company',
    owner: 'Property owner with access to assigned buildings and meetings'
  }
  return descriptions[userType] || 'User with standard access'
}


/**
 * Check if two users are in the same company
 */
export const isSameCompany = (companyId1: number | null | undefined, companyId2: number | null | undefined): boolean => {
  if (!companyId1 || !companyId2) return false
  return companyId1 === companyId2
}


/**
 * Should filter data by company?
 * Master sees all, Corporate Admin and Property Manager see only their company
 */
export const shouldFilterByCompany = (userType: UserType | string): boolean => {
  return ['corporate_administrator', 'property_manager'].includes(userType)
}
