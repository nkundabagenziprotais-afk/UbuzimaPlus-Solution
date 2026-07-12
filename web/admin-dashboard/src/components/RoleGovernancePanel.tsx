import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  archiveGovernedRole,
  assessRolePermissions,
  cloneGovernedRole,
  createGovernedRole,
  getRoleGovernance,
  updateGovernedRole,
  type GovernedRole,
  type RoleGovernanceResponse,
  type SodAssessment,
} from '../lib/api';

type Props = {
  token: string;
  tenantSlug: string;
};

type RoleForm = {
  id: number | null;
  name: string;
  description: string;
  permissions: string[];
};

const emptyForm: RoleForm = {
  id: null,
  name: '',
  description: '',
  permissions: [],
};

export function RoleGovernancePanel({
  token,
  tenantSlug,
}: Props) {
  const [data, setData] =
    useState<RoleGovernanceResponse | null>(
      null,
    );

  const [form, setForm] =
    useState<RoleForm>(emptyForm);

  const [assessment, setAssessment] =
    useState<SodAssessment | null>(null);

  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadRoles() {
    setIsLoading(true);
    setError('');

    try {
      setData(
        await getRoleGovernance(
          token,
          tenantSlug,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load role governance.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRoles();
  }, [token, tenantSlug]);

  useEffect(() => {
    if (!showEditor) {
      setAssessment(null);
      return;
    }

    const timeout = window.setTimeout(
      async () => {
        if (form.permissions.length === 0) {
          setAssessment(null);
          return;
        }

        try {
          const response =
            await assessRolePermissions(
              token,
              tenantSlug,
              form.permissions,
            );

          setAssessment(
            response.assessment,
          );
        } catch {
          setAssessment(null);
        }
      },
      350,
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    form.permissions,
    showEditor,
    tenantSlug,
    token,
  ]);

  const filteredRoles = useMemo(() => {
    const normalized =
      search.trim().toLowerCase();

    return (data?.roles ?? []).filter(
      (role) =>
        !normalized ||
        [
          role.name,
          role.code,
          role.description ?? '',
          ...role.permissions,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalized),
    );
  }, [data, search]);

  const permissionGroups =
    data?.permission_catalogue ?? [];

  function beginCreate() {
    setForm(emptyForm);
    setAssessment(null);
    setError('');
    setNotice('');
    setShowEditor(true);
  }

  function beginEdit(role: GovernedRole) {
    setForm({
      id: role.id,
      name: role.name,
      description:
        role.description ?? '',
      permissions: role.permissions,
    });

    setAssessment(role.sod);
    setError('');
    setNotice('');
    setShowEditor(true);
  }

  function togglePermission(
    permission: string,
  ) {
    setForm((current) => ({
      ...current,
      permissions:
        current.permissions.includes(
          permission,
        )
          ? current.permissions.filter(
              (item) =>
                item !== permission,
            )
          : [
              ...current.permissions,
              permission,
            ],
    }));
  }

  async function saveRole() {
    if (
      !form.name.trim()
      || form.permissions.length === 0
    ) {
      setError(
        'Role name and at least one permission are required.',
      );
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      const response = form.id
        ? await updateGovernedRole(
            token,
            tenantSlug,
            form.id,
            {
              name: form.name.trim(),
              description:
                form.description.trim()
                || undefined,
              permissions:
                form.permissions,
            },
          )
        : await createGovernedRole(
            token,
            tenantSlug,
            {
              name: form.name.trim(),
              description:
                form.description.trim()
                || undefined,
              permissions:
                form.permissions,
            },
          );

      setNotice(response.message);
      setShowEditor(false);
      setForm(emptyForm);
      await loadRoles();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save role.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function cloneRole(
    role: GovernedRole,
  ) {
    setError('');
    setNotice('');

    try {
      const response =
        await cloneGovernedRole(
          token,
          tenantSlug,
          role.id,
          {
            name:
              `${role.name} Custom Copy`,
          },
        );

      setNotice(response.message);
      await loadRoles();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to clone role.',
      );
    }
  }

  async function archiveRole(
    role: GovernedRole,
  ) {
    setError('');
    setNotice('');

    try {
      const response =
        await archiveGovernedRole(
          token,
          tenantSlug,
          role.id,
        );

      setNotice(response.message);
      await loadRoles();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to archive role.',
      );
    }
  }

  return (
    <section className="role-governance-panel">
      <header className="role-governance-heading">
        <div>
          <p className="eyebrow">
            Controlled access design
          </p>
          <h2>
            Role &amp; Permission Governance
          </h2>
          <span>
            Start with managed roles, clone
            safely, create tenant-specific
            roles, and prevent conflicting
            duties before access is granted.
          </span>
        </div>

        <button
          type="button"
          onClick={beginCreate}
        >
          Create custom role
        </button>
      </header>

      {notice && (
        <div className="notice success">
          {notice}
        </div>
      )}

      {error && (
        <div className="notice error">
          {error}
        </div>
      )}

      <div className="role-governance-summary">
        <article>
          <span>Total roles</span>
          <strong>
            {data?.summary.total_roles ?? 0}
          </strong>
        </article>

        <article>
          <span>Custom roles</span>
          <strong>
            {data?.summary.custom_roles ?? 0}
          </strong>
        </article>

        <article>
          <span>Managed roles</span>
          <strong>
            {data?.summary.managed_roles ?? 0}
          </strong>
        </article>

        <article>
          <span>Conflict review</span>
          <strong>
            {data?.summary
              .roles_with_conflicts ?? 0}
          </strong>
        </article>
      </div>

      <label className="role-governance-search">
        Search roles and permissions
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Role name, code, permission…"
        />
      </label>

      {isLoading ? (
        <div className="security-operations-state">
          Loading role governance…
        </div>
      ) : (
        <div className="role-governance-grid">
          {filteredRoles.map((role) => (
            <article
              key={role.id}
              className="role-governance-card"
            >
              <header>
                <div>
                  <span>
                    {role.role_type}
                  </span>
                  <h3>{role.name}</h3>
                  <small>{role.code}</small>
                </div>

                <strong
                  className={
                    `role-risk is-${role.sod.risk_level}`
                  }
                >
                  {role.sod.risk_level}
                </strong>
              </header>

              <p>
                {role.description
                  ?? 'No role description.'}
              </p>

              <div className="role-governance-card-metrics">
                <span>
                  <strong>
                    {role.permission_count}
                  </strong>
                  permissions
                </span>

                <span>
                  <strong>
                    {role.active_user_count}
                  </strong>
                  active users
                </span>

                <span>
                  <strong>
                    {role.sod.conflict_count}
                  </strong>
                  conflicts
                </span>
              </div>

              {role.sod.conflicts.length > 0 && (
                <ul>
                  {role.sod.conflicts.map(
                    (conflict) => (
                      <li key={conflict.code}>
                        {conflict.message}
                      </li>
                    ),
                  )}
                </ul>
              )}

              <footer>
                <button
                  type="button"
                  onClick={() =>
                    void cloneRole(role)
                  }
                >
                  Clone role
                </button>

                {role.role_type ===
                  'custom' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        beginEdit(role)
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger"
                      disabled={
                        role.active_user_count > 0
                      }
                      onClick={() =>
                        void archiveRole(role)
                      }
                    >
                      Archive
                    </button>
                  </>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {showEditor && (
        <div
          className="security-action-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Custom role editor"
        >
          <section className="role-governance-editor">
            <header>
              <div>
                <p className="eyebrow">
                  Segregation-of-duties
                  protected
                </p>
                <h3>
                  {form.id
                    ? 'Edit custom role'
                    : 'Create custom role'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowEditor(false)
                }
              >
                Close
              </button>
            </header>

            <div className="role-governance-editor-fields">
              <label>
                Role name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name:
                        event.target.value,
                    }))
                  }
                  maxLength={100}
                />
              </label>

              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={500}
                />
              </label>
            </div>

            <div className="role-sod-assessment">
              <div>
                <span>Risk score</span>
                <strong>
                  {assessment?.risk_score
                    ?? 0}
                  /100
                </strong>
              </div>

              <div>
                <span>Risk level</span>
                <strong>
                  {assessment?.risk_level
                    ?? 'not assessed'}
                </strong>
              </div>

              <div>
                <span>Conflicts</span>
                <strong>
                  {assessment
                    ?.conflict_count ?? 0}
                </strong>
              </div>
            </div>

            {assessment &&
              !assessment.compliant && (
              <div className="notice error">
                {assessment.conflicts
                  .map(
                    (conflict) =>
                      conflict.message,
                  )
                  .join(' ')}
              </div>
            )}

            <div className="role-permission-catalogue">
              {permissionGroups.map(
                (group) => (
                  <section key={group.group}>
                    <header>
                      <strong>
                        {group.group}
                      </strong>
                      <span>
                        {
                          group.permissions
                            .filter(
                              (permission) =>
                                form.permissions
                                  .includes(
                                    permission.code,
                                  ),
                            ).length
                        }
                        /
                        {group.permissions.length}
                        {' '}selected
                      </span>
                    </header>

                    <div>
                      {group.permissions.map(
                        (permission) => (
                          <label
                            key={permission.code}
                          >
                            <input
                              type="checkbox"
                              checked={
                                form.permissions
                                  .includes(
                                    permission.code,
                                  )
                              }
                              onChange={() =>
                                togglePermission(
                                  permission.code,
                                )
                              }
                            />

                            <span>
                              <strong>
                                {permission.name}
                              </strong>
                              <small>
                                {permission.code}
                              </small>
                            </span>
                          </label>
                        ),
                      )}
                    </div>
                  </section>
                ),
              )}
            </div>

            <footer>
              <button
                type="button"
                disabled={
                  isSaving
                  || assessment?.compliant
                    === false
                }
                onClick={() =>
                  void saveRole()
                }
              >
                {isSaving
                  ? 'Saving…'
                  : 'Save governed role'}
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  setShowEditor(false)
                }
              >
                Cancel
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
