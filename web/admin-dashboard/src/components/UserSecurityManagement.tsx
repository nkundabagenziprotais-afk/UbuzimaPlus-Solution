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

const defaultPermissions = [
  'roles.manage',
  'pharmaco.pos.use',
  'pharmaco.sales.manage',
  'pharmaco.inventory.manage',
  'pharmaco.suppliers.manage',
  'pharmaco.reports.view',
  'pharmaco.chat.manage',
  'notifications.manage',
  'ai.use',
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  job_title: '',
  role_code: 'cashier',
  permissions: ['pharmaco.pos.use', 'pharmaco.sales.manage'],
  password: '',
  status: 'active',
};

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
    return Array.from(new Set([...defaultPermissions, ...roles.flatMap((role) => role.permissions)])).sort();
  }, [roles]);

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
    setEditingUserId(user.id);
    setTemporaryPassword('');
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      job_title: user.job_title ?? role?.name ?? '',
      role_code: role?.code?.replace(`${tenantSlug}-`, '') || 'cashier',
      permissions: role?.permissions?.length ? role.permissions : ['pharmaco.pos.use'],
      password: '',
      status: user.status || 'active',
    });
    setNotice(`Editing ${user.name}. Update the role or permissions and save changes.`);
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

  return (
    <section className="tenant-user-security-panel">
      <div className="section-heading">
        <div>
          <h2>Vita Pharma user creation</h2>
          <span>Create tenant users, assign default role rights, and adjust permissions before saving.</span>
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

      <form className="tenant-user-form-grid" onSubmit={handleSubmit}>
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
          Role template
          <select value={form.role_code} onChange={(event) => selectRole(event.target.value)}>
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
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

        <div className="tenant-user-permissions">
          <strong>Permissions</strong>
          <span>Defaults are loaded from the selected role. You can amend them before saving.</span>
          <div>
            {allPermissions.map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  checked={form.permissions.includes(permission)}
                  onChange={() => togglePermission(permission)}
                />
                <span>{permission}</span>
              </label>
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
