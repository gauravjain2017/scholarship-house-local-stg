import { useAuth } from '../contexts/AuthContext';
import globalVariable from './globalVariable';

export function getCanonicalRole(input) {
  if (!input) return null;
  return String(input).toLowerCase().trim().replace(/\s+/g, '_');
}

export function hasPermission(user, allRoles, slug) {
  if (!user) return false;

  if (globalVariable.super_admin.includes(user.email)) {
    return true;
  }

  const userRole = getCanonicalRole(user.role);
  if (!userRole) return false;

  // find role config
  const roleData = allRoles?.find(
    (r) => getCanonicalRole(r.role_slug) === userRole
  );

  if (!roleData) return false;

  return Object.values(roleData.role_permission || {}).some((permissions) =>
    permissions.includes(slug)
  );
}

export function useHasPermission(slug) {
  const { user, roles: allRoles } = useAuth();
  return hasPermission(user, allRoles, slug);
}