import { useState, useMemo } from 'react';
import rolePermissions from '../utils/role_permission';

const modules = Object.values(
  rolePermissions.admin_roles[0].permissions.reduce((acc, perm) => {
    if (!acc[perm.slug]) acc[perm.slug] = perm;
    return acc;
  }, {})
);

const MODULE_TOP = {
  user_management:     'border-t-blue-400',
  property_management: 'border-t-violet-400',
  submit_property:     'border-t-emerald-400',
  browse_property:     'border-t-amber-400',
  favorite_property:   'border-t-rose-400',
  settings:            'border-t-slate-400',
};

export default function RolePermissions() {
  const [roleName, setRoleName] = useState('');
  const [checked, setChecked] = useState({});

  const moduleState = useMemo(() => {
    return modules.reduce((acc, mod) => {
      const total = mod.actions.length;
      const selected = mod.actions.filter((a) => checked[a.slug]).length;
      acc[mod.slug] = {
        total,
        selected,
        all: selected === total,
        some: selected > 0 && selected < total,
      };
      return acc;
    }, {});
  }, [checked]);

  function toggleAction(slug) {
    setChecked((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }

  function toggleModule(mod) {
    const { all } = moduleState[mod.slug];
    setChecked((prev) => {
      const next = { ...prev };
      mod.actions.forEach((a) => { next[a.slug] = !all; });
      return next;
    });
  }

  function toggleAll() {
    const allSelected = modules.every((m) => moduleState[m.slug].all);
    setChecked(() => {
      const next = {};
      modules.forEach((m) => m.actions.forEach((a) => { next[a.slug] = !allSelected; }));
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const selectedPermissions = Object.entries(checked)
      .filter(([, val]) => val)
      .map(([slug]) => slug);
    console.log('Role saved:', { roleName, permissions: selectedPermissions });
  }

  const totalActions  = modules.reduce((s, m) => s + m.actions.length, 0);
  const totalSelected = Object.values(checked).filter(Boolean).length;
  const allSelected   = totalSelected === totalActions;
  const progressPct   = totalActions > 0 ? Math.round((totalSelected / totalActions) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-28">

      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Role Permissions</h1>
        <p className="text-sm text-gray-400 mt-0.5">Define a role and assign module-level permissions.</p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Role name + Select All ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 mb-5">
          <div className="flex flex-wrap items-end gap-6">

            {/* Role name */}
            <div className="min-w-0 w-72">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Admin, Editor, Viewer"
                required
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>

            <div className="flex-1" />

            {/* Select all + count */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                />
                <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                  Select All Permissions
                </span>
              </label>
              <span className="text-sm font-medium text-gray-400 tabular-nums">
                {totalSelected} / {totalActions}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-gray-400">Permissions enabled</span>
              <span className="text-xs font-semibold text-gray-500">{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: progressPct === 100 ? '#10b981' : '#3b82f6',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Module cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
          {modules.map((mod) => {
            const { all, some, selected, total } = moduleState[mod.slug];
            const topColor = MODULE_TOP[mod.slug] || 'border-t-indigo-400';

            return (
              <div
                key={mod.slug}
                className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden border-t-[3px] ${topColor}`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={all}
                      ref={(el) => { if (el) el.indeterminate = some; }}
                      onChange={() => toggleModule(mod)}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm font-bold text-gray-800 truncate group-hover:text-gray-900">
                      {mod.module}
                    </span>
                  </label>
                  <span className={`ml-3 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums ${
                    all && total > 0
                      ? 'bg-blue-100 text-blue-600'
                      : some
                      ? 'bg-amber-50 text-amber-500'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {selected}/{total}
                  </span>
                </div>

                {/* Permission checkboxes */}
                <div className="px-5 py-4 space-y-3">
                  {mod.actions.map((action) => (
                    <label
                      key={action.slug}
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                    >
                      <input
                        type="checkbox"
                        checked={!!checked[action.slug]}
                        onChange={() => toggleAction(action.slug)}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                      />
                      <span className={`text-sm leading-snug transition-colors ${
                        checked[action.slug]
                          ? 'text-gray-900 font-medium'
                          : 'text-gray-500 group-hover:text-gray-700'
                      }`}>
                        {action.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="fixed bottom-0 left-0 right-0 md:left-[240px] bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-8 py-4 z-20">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              {totalSelected > 0
                ? <><span className="font-semibold text-gray-700">{totalSelected}</span> permission{totalSelected !== 1 ? 's' : ''} selected</>
                : 'No permissions selected yet'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setRoleName(''); setChecked({}); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all"
              >
                Save Role
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
