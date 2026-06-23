export const validateRoles = ({ roleName, selected, portal }) => {
    let errors = {};

    if (!roleName.trim()) {
        errors.roleName = "Role name is required";
    }

    const hasSelection = Object.values(selected).some(
        (arr) => Array.isArray(arr) && arr.length > 0
    );

    if (!hasSelection) {
        errors.selected = "Please select at least one permission";
    }

    if(!portal){
        errors.portal = "Please select which portal to assign the role to.";
    }

    return errors;
};