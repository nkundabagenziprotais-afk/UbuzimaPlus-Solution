import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createTenantSecurityUser,
  getTenantSecurityRoleTemplates,
  getTenantSecurityUsers,
  type TenantSecurityUser,
  type TenantUserRoleTemplate,
  updateTenantSecurityUser,
} from '../lib/api';

type Props = {
  token: string;
  tenantSlug?: string;
};

const fallbackPermissions = [
  'tenant.dashboard.view',
  'roles.manage',
  'users.view',
  'users.create',
  'users.update',
  'users.permissions.edit',
  'pharmaco.pos.use',
  'pharmaco.sales.manage',
  'pharmaco.inventory.manage',
  'pharmaco.suppliers.manage',
  'pharmaco.procurement.view',
  'pharmaco.finance.view',
  'pharmaco.reports.view',
  'notifications.manage',
  'ai.use',
  'audit.logs.view',
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  job_title: '',
  role_code: 'cashier',
  permissions: ['tenant.dashboard.view', 'pharmaco.pos.use', 'pharmaco.sales.view', 'pharmaco.sales.create'],
  password: '',
  status: 'active',
};

const permissionGroupOrder = [
  'Dashboard & Tenant',
  'Users & Security',
  'POS',
  'Sales & Customers',
  'Pharmacy & Dispensing',
  'Inventory',
  'Procurement',
  'Finance',
  'Reports',
  'HR',
  'Delivery',
  'AI',
  'Notifications',
  'Audit',
  'Other',
];

function permissionGroup(permission: string) {
  if (permission.startsWith('tenant.') || permission.startsWith('branches.')) return 'Dashboard & Tenant';
  if (permission.startsWith('roles.') || permission.startsWith('users.') || permission.startsWith('security.')) return 'Users & Security';
  if (permission.includes('.pos.')) return 'POS';
  if (permission.includes('.sales') || permission.includes('.customers')) return 'Sales & Customers';
  if (permission.includes('.prescriptions') || permission.includes('.dispensing') || permission.includes('.clinical')) return 'Pharmacy & Dispensing';
  if (permission.includes('.inventory') || permission.includes('.product_master') || permission.includes('.product_inventory')) return 'Inventory';
  if (permission.includes('.suppliers') || permission.includes('.procurement')) return 'Procurement';
  if (permission.includes('.finance')) return 'Finance';
  if (permission.includes('.reports')) return 'Reports';
  if (permission.includes('.hr') || permission.includes('.staff_schedule')) return 'HR';
  if (permission.includes('.delivery')) return 'Delivery';
  if (permission.startsWith('ai.')) return 'AI';
  if (permission.startsWith('notifications.')) return 'Notifications';
  if (permission.includes('audit')) return 'Audit';
  return 'Other';
}

function humanizePermission(permission: string) {
  return permission
    .replace(/^pharmaco\./, '')
    .replaceAll('_', ' ')
    .replaceAll('.', ' / ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function UserSecurityManagement({ token, tenantSlug = 'vitapharma' }: Props) {
  const [roles, setRoles] = useState<TenantUserRoleTemplate[]>([]);
  const [users, setUsers] = useState<TenantSecurityUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const allPermissions = useMemo(() => {
    return Array.from(new Set([...fallbackPermissions, ...roles.flatMap((role) => role.permissions)])).sort();
  }, [roles]);

  const groupedPermissions = useMemo(() => {
    const grouped = new Map<string, string[]>();

    allPermissions.forEach((permission) => {
      const group = permissionGroup(permission);
      grouped.set(group, [...(grouped.get(group) ?? []), permission]);
    });

    return permissionGroupOrder
      .map((group) => ({
        group,
        permissions: (grouped.get(group) ?? []).sort(),
      }))
      .filter((item) => item.permissions.length > 0);
  }, [allPermissions]);

  async function loadSecurityUsers() {
    const [roleResponse, userResponse] = await Promise.all([
      getTenantSecurityRoleTemplates(token, tenantSlug),
      getTenantSecurityUsers(token, tenantSlug),
    ]);

    setRoles(roleResponse.roles);
    setUsers(userResponse.users);
  }

  useEffect(() => {
    loadSecurityUsers().catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to load users and roles.');
    });
  }, [token, tenantSlug]);

  function selectRole(code: string) {
    const role = roles.find((item) => item.code === code);
    setForm((current) => ({
      ...current,
      role_code: code,
      permissions: role?.permissions ?? current.permissions,
      job_title: current.job_title || role?.name || '',
    }));
  }

  function togglePermission(permission: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  }

  function editUser(user: TenantSecurityUser) {
    const role = user.roles[0];
    const cleanRoleCode =
      roles.find((template) => role?.code === template.code || role?.code?.endsWith(`-${template.code}`))?.code
      || role?.code?.replace(`${tenantSlug}-`, '')
      || 'cashier';

    setEditingUserId(user.id);
    setTemporaryPassword('');
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      job_title: user.job_title ?? role?.name ?? '',
      role_code: cleanRoleCode,
      permissions: role?.permissions?.length ? role.permissions : ['tenant.dashboard.view'],
      password: '',
      status: user.status || 'active',
    });
    setNotice(`Editing ${user.name}. Update role or permissions, then save changes.`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setError('');
    setNotice('');
    setTemporaryPassword('');

    try {
      if (editingUserId) {
        const response = await updateTenantSecurityUser(token, tenantSlug, editingUserId, {
          tenant_slug: tenantSlug,
          name: form.name,
          phone: form.phone,
          job_title: form.job_title,
          role_code: form.role_code,
          permissions: form.permissions,
          status: form.status,
        });

        setNotice(response.message);
      } else {
        const response = await createTenantSecurityUser(token, tenantSlug, {
          tenant_slug: tenantSlug,
          name: form.name,
          email: form.email,
          phone: form.phone,
          job_title: form.job_title,
          role_code: form.role_code,
          permissions: form.permissions,
          password: form.password || undefined,
          status: form.status,
        });

        setTemporaryPassword(response.temporary_password);
        setNotice(`${response.message} Share the temporary password securely and ask the user to change it after login.`);
      }

      setForm(emptyForm);
      setEditingUserId(null);
      await loadSecurityUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save user.');
    } finally {
      setIsSaving(false);
    }
  }

  const selectedRole = roles.find((role) => role.code === form.role_code);

  return (
    <section className="tenant-user-security-panel">
      <div className="section-heading">
        <div>
          <h2>Vita Pharma user creation</h2>
          <span>Create tenant users, assign role-based default rights, and amend permissions before saving.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingUserId(null);
            setForm(emptyForm);
            setTemporaryPassword('');
          }}
        >
          New user
        </button>
      </div>

      {notice && <div className="notice success">{notice}</div>}
      {error && <div className="notice error">{error}</div>}
      {temporaryPassword && (
        <div className="tenant-user-password-box">
          <strong>Temporary password</strong>
          <span>{temporaryPassword}</span>
          <small>Copy it now. This value is shown only after creation.</small>
        </div>
      )}

      <form className="tenant-user-form-grid tenant-user-form-grid--professional" onSubmit={handleSubmit}>
        <div className="tenant-user-form-section tenant-user-form-section--identity">
          <div className="tenant-user-form-section-heading">
            <strong>Staff identity</strong>
            <span>Basic login and staff details for Vita Pharma.</span>
          </div>

          <label>
            Full name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>

          <label>
            Email / login
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              disabled={!!editingUserId}
              required
            />
          </label>

          <label>
            Phone
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>

          <label>
            Job title
            <input value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} />
          </label>

          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>

          {!editingUserId && (
            <label>
              Temporary password
              <input
                type="text"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Leave blank to auto-generate"
              />
            </label>
          )}
        </div>

        <div className="tenant-user-form-section tenant-user-form-section--role">
          <div className="tenant-user-form-section-heading">
            <strong>Role template</strong>
            <span>Choose a practical pharmacy role. Permissions remain editable below.</span>
          </div>

          <label>
            Role
            <select value={form.role_code} onChange={(event) => selectRole(event.target.value)}>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>

          {selectedRole && (
            <div className="tenant-user-selected-role-card">
              <strong>{selectedRole.name}</strong>
              <span>{selectedRole.description}</span>
              <small>{selectedRole.permissions.length} default permissions loaded</small>
            </div>
          )}

          <div className="tenant-user-permission-summary">
            <strong>{form.permissions.length}</strong>
            <span>permissions selected for this user</span>
          </div>
        </div>

        <div className="tenant-user-permissions tenant-user-permissions--grouped">
          <div className="tenant-user-form-section-heading">
            <strong>Permission rights</strong>
            <span>Defaults come from the selected role. Tick or untick rights before saving.</span>
          </div>

          <div className="tenant-user-permission-groups">
            {groupedPermissions.map((group) => (
              <article key={group.group} className="tenant-user-permission-group">
                <header>
                  <strong>{group.group}</strong>
                  <small>{group.permissions.filter((permission) => form.permissions.includes(permission)).length}/{group.permissions.length} selected</small>
                </header>

                <div>
                  {group.permissions.map((permission) => (
                    <label key={permission}>
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                      <span>
                        <b>{humanizePermission(permission)}</b>
                        <small>{permission}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="inventory-form-actions tenant-user-form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving user…' : editingUserId ? 'Update user access' : 'Create Vita Pharma user'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingUserId(null);
              setForm(emptyForm);
              setTemporaryPassword('');
            }}
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="tenant-user-role-cards">
        {roles.map((role) => (
          <article key={role.code}>
            <strong>{role.name}</strong>
            <span>{role.description}</span>
            <small>{role.permissions.length} default permissions</small>
          </article>
        ))}
      </div>

      <div className="tenant-user-list">
        <div className="tenant-user-list__header">
          <strong>Name</strong>
          <strong>Email</strong>
          <strong>Role</strong>
          <strong>Status</strong>
          <strong>Actions</strong>
        </div>

        {users.length === 0 ? (
          <div>
            <span>No Vita Pharma users found yet.</span>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id}>
              <span>{user.name}</span>
              <span>{user.email}</span>
              <span>{user.roles[0]?.name ?? 'No role assigned'}</span>
              <span>{user.status ?? 'active'}</span>
              <span className="table-action-row">
                <button type="button" onClick={() => editUser(user)}>
                  Edit access
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
