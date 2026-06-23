import { useState, useEffect, useMemo } from 'react';
import rawRolePermissions from '../../utils/role_permission';
import { validateRoles } from "../../utils/customValidation";
import { createRole, getRoles, deleteRole, getAdminUsers } from '../../api/admin';
import { authAPI } from '../../api/auth';
import { useNavigate} from 'react-router-dom';

// ─── Permission Modules ────────────────────────────────────────────────────────

const adminModules = Object.values(
    rawRolePermissions.admin_roles[0].permissions.reduce((acc, perm) => {
        if (!acc[perm.slug]) acc[perm.slug] = perm;
        return acc;
    }, {})
);

const clientModules = Object.values(
    rawRolePermissions.client_roles[0].permissions.reduce((acc, perm) => {
        if (!acc[perm.slug]) acc[perm.slug] = perm;
        return acc;
    }, {})
);

const submitterModules = Object.values(
    rawRolePermissions.submitter_roles[0].permissions.reduce((acc, perm) => {
        if (!acc[perm.slug]) acc[perm.slug] = perm;
        return acc;
    }, {})
);

// Used by the permission matrix (admin scope)
// const roleModules = adminModules;

const portalModulesMap = {
    admin: adminModules,
    client: clientModules,
    submitter: submitterModules,
};




function ModuleCheckbox({ allChecked, someChecked, onChange }) {
    return (
        <input
            type="checkbox"
            className="w-4 h-4 accent-blue-600 cursor-pointer"
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            onChange={onChange}
        />
    );
}


function isModuleAllSelected(actions, moduleSelected) {
    const seenGroups = new Set();
    return actions.every((a) => {
        if (a.radioGroup) {
            if (seenGroups.has(a.radioGroup)) return true;
            seenGroups.add(a.radioGroup);
            return actions.some((b) => b.radioGroup === a.radioGroup && moduleSelected.includes(b.slug));
        }
        return moduleSelected.includes(a.slug);
    });
}

function NewRoleModal({ open, onClose, editRole, onSuccess }) {
    const [roleName, setRoleName] = useState(editRole?.role_name || '');
    const [roleDesc, setRoleDesc] = useState(editRole?.role_description || '');
    const [portal, setPortal] = useState(editRole?.portal_type || '');
    const [errors, setErrors] = useState({});
    const [selected, setSelected] = useState(editRole?.role_permission || {});
    const [loading, setLoading] = useState(false);

    const isEditing = !!editRole;

    const activeModules =
        portal === 'client' ? clientModules :
            portal === 'submitter' ? submitterModules :
                adminModules;

    if (!open) return null;

    const togglePermission = (moduleId, perm) => {
        setSelected((prev) => {
            const current = prev[moduleId] || [];
            const updated = current.includes(perm)
                ? current.filter((p) => p !== perm)
                : [...current, perm];
            return { ...prev, [moduleId]: updated };
        });
    };

    const selectRadioPermission = (moduleId, perm, radioGroup) => {
        setSelected((prev) => {
            const module = activeModules.find((m) => m.slug === moduleId);
            const groupSlugs = (module?.actions || [])
                .filter((a) => a.radioGroup === radioGroup)
                .map((a) => a.slug);
            const current = (prev[moduleId] || []).filter((p) => !groupSlugs.includes(p));
            return { ...prev, [moduleId]: [...current, perm] };
        });
    };

    const toggleModule = (moduleId, actions) => {
        const current = selected[moduleId] || [];
        const allSelected = isModuleAllSelected(actions, current);
        if (allSelected) {
            setSelected((prev) => ({ ...prev, [moduleId]: [] }));
        } else {
            const seenGroups = new Set();
            const toSelect = [];
            for (const action of actions) {
                if (action.radioGroup) {
                    if (!seenGroups.has(action.radioGroup)) {
                        seenGroups.add(action.radioGroup);
                        const already = current.find((s) =>
                            actions.some((a) => a.slug === s && a.radioGroup === action.radioGroup)
                        );
                        toSelect.push(already || action.slug);
                    }
                } else {
                    toSelect.push(action.slug);
                }
            }
            setSelected((prev) => ({ ...prev, [moduleId]: toSelect }));
        }
    };

    const totalSelected = Object.values(selected).reduce((acc, arr) => acc + arr.length, 0);
    const totalPerms = activeModules.reduce((acc, m) => {
        const groups = new Set(m.actions.filter((a) => a.radioGroup).map((a) => a.radioGroup));
        return acc + m.actions.filter((a) => !a.radioGroup).length + groups.size;
    }, 0);

    const handleCreate = async () => {
        const errors = validateRoles({ roleName, selected, portal });
        if (Object.keys(errors).length > 0) {
            setErrors(errors);
            return;
        }
        setErrors({});
        setLoading(true);
        try {
            const payload = {
                role_name: roleName,
                role_description: roleDesc,
                permissions: selected,
                portal_type: portal
            };

            await createRole(payload);
            onSuccess?.();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

                {/* Header */}
                <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">✨</span>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{'Custom role'}</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Define a name and pick the permissions this role should have.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1 cursor-pointer">✕</button>
                </div>

                {/* Scrollable body */}
                <div className="px-8 py-6 space-y-5 overflow-y-auto flex-1">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Role Name
                            </label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/10 transition"
                                placeholder="e.g. Marketing Manager"
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                            />
                            {errors.roleName && (
                                <p className="text-red-500 text-xs mt-1">{errors.roleName}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Assign Role To Portal
                            </label>

                            <select
                                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 bg-white outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/10 transition"
                                value={portal}
                                onChange={(e) => { setPortal(e.target.value); setSelected({}); }}
                            >
                                <option value="">Select Portal</option>
                                <option value="admin">Admin</option>
                                <option value="client">Client</option>
                                <option value="submitter">Buy Box</option>
                            </select>

                            {errors.portal && (
                                <p className="text-red-500 text-xs mt-1">{errors.portal}</p>
                            )}
                        </div>

                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                        <textarea
                            className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/10 transition resize-y min-h-[72px]"
                            placeholder="What can this role do?"
                            value={roleDesc}
                            onChange={(e) => setRoleDesc(e.target.value)}
                        />
                    </div>

                    {/* Permissions block — only visible after a portal is chosen */}
                    {portal && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">

                            {/* Manage Roles header */}
                            <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-gray-800">Manage Roles &amp; Permissions</div>
                                    <div className="text-xs text-gray-500">Allow this team member to manage specific module permissions</div>
                                </div>
                            </div>

                            <div className="px-4 pt-4 pb-2">
                                <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Select permissions this member can manage</p>
                            </div>

                            {/* Module list */}
                            <div className="px-4 pb-4 space-y-2.5">

                                {activeModules.map((role) => {
                                    const moduleSelected = selected[role.slug] || [];
                                    const allChecked = isModuleAllSelected(role.actions, moduleSelected);
                                    const someChecked = !allChecked && role.actions.some((a) => moduleSelected.includes(a.slug));
                                    const uniqueGroups = new Set(role.actions.filter((a) => a.radioGroup).map((a) => a.radioGroup));
                                    const effectiveTotal = role.actions.filter((a) => !a.radioGroup).length + uniqueGroups.size;
                                    return (
                                        <div key={role.slug} className="border border-gray-200 rounded-lg overflow-hidden">
                                            {/* Module header row */}
                                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                                                <label className="flex items-center gap-2.5 cursor-pointer">
                                                    <ModuleCheckbox
                                                        allChecked={allChecked}
                                                        someChecked={someChecked}
                                                        onChange={() => toggleModule(role.slug, role.actions)}
                                                    />
                                                    <span className="text-sm font-semibold text-gray-800">{role.module}</span>
                                                </label>
                                                <span className="text-xs text-gray-400 font-medium">
                                                    {moduleSelected.length}/{effectiveTotal}
                                                </span>
                                            </div>

                                            {/* Sub-permissions grid */}
                                            <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5 bg-white">
                                                {role.actions.map((action) => (
                                                    <label key={action.slug} className="flex items-center gap-2 cursor-pointer group">
                                                        {action.radioGroup ? (
                                                            <input
                                                                type="radio"
                                                                name={`${role.slug}-${action.radioGroup}`}
                                                                className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                                                checked={moduleSelected.includes(action.slug)}
                                                                onChange={() => selectRadioPermission(role.slug, action.slug, action.radioGroup)}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                                                checked={moduleSelected.includes(action.slug)}
                                                                onChange={() => togglePermission(role.slug, action.slug)}
                                                            />
                                                        )}
                                                        <span className="text-sm text-gray-600 group-hover:text-gray-800 transition">{action.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {errors.selected && (
                                    <p className="text-red-500 text-xs mt-2">{errors.selected}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {portal && (
                        <p className="text-xs text-gray-400 text-right">{totalSelected} of {totalPerms} permissions selected</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-8 py-5 border-t border-gray-100 flex-shrink-0">
                    <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={handleCreate} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-green-900 rounded-lg hover:bg-green-800 transition cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                        {loading && (
                            <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                        )}
                        {isEditing ? 'Save changes' : 'Create role'}
                    </button>
                </div>
            </div>
        </div>
    );
}


function DeleteConfirmModal({ role, onClose, onConfirm, loading, errorMessage }) {
    if (!role) return null;
    return (
        <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-8 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 text-xl flex-shrink-0">🗑</span>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Delete role</h2>
                        <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
                    </div>
                </div>
                {errorMessage ? (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        <p className="text-sm text-red-700">{errorMessage}</p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-700">
                        Are you sure you want to delete the <span className="font-semibold text-gray-900">{role.role_name}</span> role?
                        Users assigned this role will lose its permissions.
                    </p>
                )}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                    >
                        {errorMessage ? 'Close' : 'Cancel'}
                    </button>
                    {!errorMessage && (
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading && (
                                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                            )}
                            Delete role
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}


const ManageRoles = () => {
    const [modalOpen, setModalOpen] = useState(false);
    const [roles, setRoles] = useState([]);
    const [modalKey, setModalKey] = useState(0);
    const [editRole, setEditRole] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState(null);
    const [matrixPortal, setMatrixPortal] = useState('admin');
    const [users, setUsers] = useState([]);
    const [pendingRegs, setPendingRegs] = useState([]);
    const [rejectRegs, setRejectRegs] = useState([]);
    const navigate = useNavigate();
    const handleOpenModal = (role = null) => {
        setEditRole(role);
        setModalKey(prev => prev + 1);
        setModalOpen(true);
    };

    const fetchRoles = async () => {
        try {
            const res = await getRoles();
            console.log('roles : ', res)
            setRoles(res.data.data || []);
        } catch (err) {
            console.error("Failed to fetch roles:", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const [usersRes, pendingRes, rejectRes] = await Promise.all([
                getAdminUsers(),
                authAPI.getPendingRegistrations(),
                authAPI.getRejectRegistrations(),
            ]);
            setUsers(usersRes?.data || []);
            setPendingRegs(
                pendingRes?.registrations || pendingRes?.data || (Array.isArray(pendingRes) ? pendingRes : [])
            );
            setRejectRegs(
                rejectRes?.registrations || rejectRes?.data || (Array.isArray(rejectRes) ? rejectRes : [])
            );
        } catch (err) {
            console.error('Failed to fetch users for role counts:', err);
        }
    };

    const roleCounts = useMemo(() => {
        const normalizedPending = pendingRegs.map((reg) => ({
            role: reg.requestedUserType || reg.userType || reg.UserType || '',
            email: (reg.email || reg.Email || '').toLowerCase(),
        }));
        const normalizedReject = rejectRegs.map((reg) => ({
            role: reg.requestedUserType || reg.userType || reg.UserType || '',
            email: (reg.email || reg.Email || '').toLowerCase(),
        }));
        const pendingEmails = new Set(normalizedPending.map((r) => r.email));
        const allUsers = [
            ...users.filter((u) => !pendingEmails.has((u.email || '').toLowerCase())).map((u) => ({ role: u.role })),
            ...normalizedPending,
            ...normalizedReject,
        ];
        const counts = {};
        allUsers.forEach((u) => {
            if (u.role) counts[u.role] = (counts[u.role] || 0) + 1;
        });
        return counts;
    }, [users, pendingRegs, rejectRegs]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        setDeleteError(null);
        try {
            await deleteRole(deleteTarget.role_slug);
            setDeleteTarget(null);
            fetchRoles();
        } catch (err) {
            const message = err?.response?.data?.message || 'Failed to delete role.';
            setDeleteError(message);
        } finally {
            setDeleteLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
        fetchUsers();
    }, []);



    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto px-8 py-8">

                {/* Page heading card */}
                <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 flex items-center justify-between mb-6 shadow-sm">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Roles &amp; Permissions</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Review your members roles and allocate permissions</p>
                    </div>
                    <button
                        onClick={handleOpenModal}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition cursor-pointer"
                    >
                        + New Role
                    </button>
                </div>

                {/* Roles grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {roles.map((r) => {
                        const permCount = Object.values(r.role_permission || {}).flat().length;
                        return (
                            <div
                                key={r.role_name}
                                className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow duration-200"
                            >
                                {/* Header row */}
                                {/* Header row */}
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-[17px] font-bold text-gray-900 leading-snug">
                                            {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
                                        </h3>
                                        <p className="text-[13px] text-gray-400 mt-0.5">Scope: {r.portal_type}</p>
                                        <p className="text-[13px] text-gray-400 mt-0.5">Slug: {r.role_slug}</p>
                                    </div>

                                    {/* Right side badges */}
                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                            {permCount} {permCount === 1 ? 'Permission' : 'Permissions'}
                                        </span>
                                        {/* <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5M12 12a4 4 0 100-8 4 4 0 000 8z" />
                                            </svg>
                                            {roleCounts[r.role_slug] ?? 0} {(roleCounts[r.role_slug] ?? 0) === 1 ? 'User' : 'Users'}
                                        </span> */}
                                        <button
                                            onClick={() => navigate(`/admin/users?role=${r.role_slug}`)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full hover:bg-indigo-100 transition cursor-pointer"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5M12 12a4 4 0 100-8 4 4 0 000 8z" />
                                            </svg>
                                            {roleCounts[r.role_slug] ?? 0} {(roleCounts[r.role_slug] ?? 0) === 1 ? 'User' : 'Users'}
                                        </button>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-[13.5px] text-gray-600 leading-relaxed flex-1">
                                    {r.role_description || <span className="italic text-gray-300">No description provided.</span>}
                                </p>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-1">
                                    <button
                                        onClick={() => handleOpenModal(r)}
                                        className="text-[13px] font-semibold text-gray-700 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition cursor-pointer"
                                    >
                                        Manage Role
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(r)}
                                        className="text-[13px] font-semibold text-indigo-600 border border-indigo-400 rounded-lg px-4 py-2 hover:bg-indigo-50 transition cursor-pointer"
                                    >
                                        Delete Role
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Create new role — dashed card */}
                    <button
                        onClick={handleOpenModal}
                        className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-3 p-6 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-200 cursor-pointer min-h-[180px]"
                    >
                        <div className="w-9 h-9 rounded-full border-2 border-gray-400 flex items-center justify-center text-gray-400 text-xl font-light">
                            +
                        </div>
                        <span className="text-sm font-semibold text-gray-500">Create New Role</span>
                    </button>
                </div>

                {/* Permission matrix */}
                {/* Permission matrix */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-800">Permission matrix</h3>

                        {/* Portal filter checkboxes */}
                        <div className="flex items-center gap-5">
                            {[
                                { value: 'admin', label: 'Admin' },
                                { value: 'client', label: 'Client' },
                                { value: 'submitter', label: 'Buy Box' },
                            ].map(({ value, label }) => (
                                <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="radio"
                                        name="matrixPortal"
                                        value={value}
                                        checked={matrixPortal === value}
                                        onChange={() => setMatrixPortal(value)}
                                        className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                    />
                                    <span className={`text-sm font-medium transition ${matrixPortal === value ? 'text-indigo-600' : 'text-gray-500'
                                        }`}>
                                        {label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr>
                                    <th className="text-left py-2 px-3 text-gray-500 font-semibold border-b-2 border-gray-200 w-2/5">
                                        Capability
                                    </th>
                                    {roles
                                        .filter((r) => r.portal_type === matrixPortal)
                                        .map((r) => (
                                            <th
                                                key={r.role_name}
                                                className="text-center py-2 px-2 text-gray-500 font-semibold border-b-2 border-gray-200 whitespace-nowrap"
                                            >
                                                {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
                                            </th>
                                        ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(portalModulesMap[matrixPortal] || []).map((mod) => (
                                    <>
                                        {/* Module group header */}
                                        <tr key={`mod-${mod.slug}`} className="bg-gray-50">
                                            <td
                                                colSpan={roles.filter((r) => r.portal_type === matrixPortal).length + 1}
                                                className="py-2 px-3 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wide"
                                            >
                                                {mod.module}
                                            </td>
                                        </tr>

                                        {/* Action rows */}
                                        {mod.actions.map((action, ai) => (
                                            <tr key={action.slug} className={ai % 2 === 0 ? '' : 'bg-gray-50/40'}>
                                                <td className="py-2 pl-7 pr-3 text-gray-500 border-b border-gray-100">
                                                    {action.label}
                                                </td>
                                                {roles
                                                    .filter((r) => r.portal_type === matrixPortal)
                                                    .map((r) => {
                                                        const perms = r.role_permission?.[mod.slug];
                                                        const hasAccess = Array.isArray(perms) && perms.includes(action.slug);
                                                        return (
                                                            <td key={r.role_name} className="py-2 px-2 text-center border-b border-gray-100">
                                                                {hasAccess
                                                                    ? <span className="text-green-700 font-bold text-sm">✓</span>
                                                                    : <span className="text-gray-300 text-sm">—</span>
                                                                }
                                                            </td>
                                                        );
                                                    })}
                                            </tr>
                                        ))}
                                    </>
                                ))}
                            </tbody>
                        </table>

                        {/* Empty state */}
                        {roles.filter((r) => r.portal_type === matrixPortal).length === 0 && (
                            <p className="text-center text-sm text-gray-400 py-8">
                                No roles found for the <span className="font-semibold capitalize">{matrixPortal}</span> portal.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <NewRoleModal
                key={modalKey}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                editRole={editRole}
                onSuccess={fetchRoles}
            />
            <DeleteConfirmModal
                role={deleteTarget}
                onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
                onConfirm={handleDelete}
                loading={deleteLoading}
                errorMessage={deleteError}
            />
        </div>
    );
};

export default ManageRoles;