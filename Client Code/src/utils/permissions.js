export const PERMISSIONS_BY_ROLE = {
  admin: {
    VIEW_CUSTOMER: true,
    VIEW_SUBMITTER: true,
    VIEW_ADMIN: true,
    CAN_SUBMIT: true,
    EDIT: true,
    MANAGE_USERS: true,
    SET_ADMIN_ROLE: true,
    PUBLISH_PROPERTY: true,
  },

  team_member: {
    VIEW_CUSTOMER: true,
    VIEW_SUBMITTER: true,
    VIEW_ADMIN: true,
    CAN_SUBMIT: true,
    EDIT: true,
    MANAGE_USERS: true,
    SET_ADMIN_ROLE: false,
    PUBLISH_PROPERTY: false,
  },

  submitter: {
    VIEW_CUSTOMER: false,
    VIEW_SUBMITTER: true,
    VIEW_ADMIN: false,
    CAN_SUBMIT: true,
    EDIT: false,
    MANAGE_USERS: false,
    SET_ADMIN_ROLE: false,
    PUBLISH_PROPERTY: false,
  },

  client: {
    VIEW_CUSTOMER: true,
    VIEW_SUBMITTER: false,
    VIEW_ADMIN: false,
    CAN_SUBMIT: false,
    EDIT: false,
    MANAGE_USERS: false,
    SET_ADMIN_ROLE: false,
    PUBLISH_PROPERTY: false,
  },
};

export function getPermissionsForRole(role) {
  return PERMISSIONS_BY_ROLE[role] || {};
}
