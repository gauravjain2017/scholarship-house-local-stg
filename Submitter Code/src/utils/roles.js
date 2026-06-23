import { useAuth } from '../contexts/AuthContext';

export function getCanonicalRole(input) {
  if (!input) return null;
  return String(input).toLowerCase().trim().replace(/\s+/g, '_');
}

export function hasPermission(user, allRoles, slug) {
  if (!user) return false;

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


// export const ROLES = {
//   submitter: 'submitter',
  
// };

// const ALL_ROLES = Object.values(ROLES);

// export function getCanonicalRole(input) {
//   if (!input) return null;

//   const role = String(input).toLowerCase().trim().replace(/\s+/g, '_');

//   return ALL_ROLES.includes(role) ? role : null;
// }
