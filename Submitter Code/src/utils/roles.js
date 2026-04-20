// Canonical role logic: treat userType as role, map all submitter types to 'submitter'
// export const getCanonicalRole = (userType) => {
//   if (!userType) return null;

//   const submitterTypes = [
//     'submitter',
//     'real_estate_professional',
//     'wholesaler',
//     'birddogger',
//     'realtor',
//   ];

//   return submitterTypes.includes(userType) ? 'submitter' : userType;
// };

export const ROLES = {
  submitter: 'submitter',
  
};

const ALL_ROLES = Object.values(ROLES);

export function getCanonicalRole(input) {
  if (!input) return null;

  const role = String(input).toLowerCase().trim().replace(/\s+/g, '_');

  return ALL_ROLES.includes(role) ? role : null;
}
