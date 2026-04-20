const ROLES = {
  admin: 'admin',
  team_member: 'team_member',
  submitter: 'submitter',
  client: 'client',
};

const ALL_ROLES = Object.values(ROLES);

function getCanonicalRole(input) {
  if (!input) return null;

  const role = String(input).toLowerCase().trim().replace(/\s+/g, '_');

  return ALL_ROLES.includes(role) ? role : null;
}

module.exports = {
  ROLES,
  ALL_ROLES,
  getCanonicalRole,
};
