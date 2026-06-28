import { FormEvent, useState } from 'react';
import {
  AccessProfile,
  BranchDepartmentsResponse,
  BranchesResponse,
  createPharmaBranchDepartment,
  getBranchDepartments,
  getPharmaBranches,
  updatePharmaBranch,
  updatePharmaBranchDepartment,
} from '../lib/api';

type PharmaCoreEditorProps = {
  token: string;
  profile: AccessProfile;
};

export function PharmaCoreEditor({ token, profile }: PharmaCoreEditorProps) {
  const [branches, setBranches] = useState<BranchesResponse | null>(null);
  const [departments, setDepartments] = useState<BranchDepartmentsResponse | null>(null);
  const [branchForm, setBranchForm] = useState({
    phone: '',
    email: '',
    address: '',
  });
  const [departmentForm, setDepartmentForm] = useState({
    name: 'Night Counter',
    code: 'NIGHT_COUNTER',
    department_type: 'extended_hours_service',
    opening_time: '20:00',
    closing_time: '23:00',
    is_revenue_center: true,
    notes: 'Evening customer service and urgent medicine counter.',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const tenantSlug =
    profile.tenant_assignments?.[0]?.tenant?.slug ||
    (profile.scope.is_tenant ? 'vitapharma' : '');

  const firstBranch = branches?.branches[0] ?? null;

  async function loadEditableData() {
    if (!tenantSlug) {
      setError('No tenant assignment is available for this account.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const branchResponse = await getPharmaBranches(token, tenantSlug);
      const branch = branchResponse.branches[0] ?? null;
      const departmentResponse = branch
        ? await getBranchDepartments(token, tenantSlug, branch.id)
        : null;

      setBranches(branchResponse);
      setDepartments(departmentResponse);

      if (branch) {
        setBranchForm({
          phone: branch.phone ?? '',
          email: branch.email ?? '',
          address: branch.address ?? '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load editable PharmaCo360 data.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBranchSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !firstBranch) return;

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await updatePharmaBranch(token, tenantSlug, firstBranch.id, {
        phone: branchForm.phone || null,
        email: branchForm.email || null,
        address: branchForm.address || null,
      });

      setMessage(response.message);
      await loadEditableData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update branch.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantSlug || !firstBranch) return;

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await createPharmaBranchDepartment(token, tenantSlug, firstBranch.id, {
        name: departmentForm.name,
        code: departmentForm.code,
        department_type: departmentForm.department_type,
        opening_time: departmentForm.opening_time || null,
        closing_time: departmentForm.closing_time || null,
        is_revenue_center: departmentForm.is_revenue_center,
        notes: departmentForm.notes || null,
      });

      setMessage(response.message);
      setDepartmentForm({
        name: '',
        code: '',
        department_type: '',
        opening_time: '',
        closing_time: '',
        is_revenue_center: false,
        notes: '',
      });
      await loadEditableData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create department.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleDepartmentStatus(departmentId: number, currentStatus: string) {
    if (!tenantSlug || !firstBranch) return;

    const nextStatus = currentStatus === 'maintenance' ? 'active' : 'maintenance';

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await updatePharmaBranchDepartment(
        token,
        tenantSlug,
        firstBranch.id,
        departmentId,
        {
          operating_status: nextStatus,
          notes:
            nextStatus === 'maintenance'
              ? 'Temporarily marked for operational review from dashboard.'
              : 'Returned to active operational status from dashboard.',
        },
      );

      setMessage(response.message);
      await loadEditableData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update department.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="panel wide pharmaco-editor-panel">
      <div className="panel-heading-row">
        <div>
          <h2>PharmaCo360 branch and department editor</h2>
          <p className="muted">
            Controlled edits use tenant-scoped APIs and are recorded in audit logs.
          </p>
        </div>

        <button type="button" onClick={loadEditableData} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load editable branch data'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {firstBranch && (
        <form className="inline-edit-form" onSubmit={handleBranchSave}>
          <h4>Edit main branch contact</h4>

          <label>
            Phone
            <input
              type="text"
              value={branchForm.phone}
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="+250..."
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={branchForm.email}
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="hq@vitapharmaafrica.com"
            />
          </label>

          <label>
            Address
            <input
              type="text"
              value={branchForm.address}
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, address: event.target.value }))
              }
              placeholder="Kigali, Rwanda"
            />
          </label>

          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save branch contact'}
          </button>
        </form>
      )}

      {departments && (
        <div className="department-preview editor-departments">
          <h3>{departments.branch.name} departments</h3>

          {departments.departments.map((department) => (
            <div key={department.id}>
              <strong>{department.name}</strong>
              <span>{department.code}</span>
              <span>{department.operating_status}</span>
              <small>{department.is_revenue_center ? 'Revenue center' : 'Support unit'}</small>
              <button
                type="button"
                onClick={() => handleToggleDepartmentStatus(department.id, department.operating_status)}
                disabled={isSaving}
              >
                {department.operating_status === 'maintenance' ? 'Mark active' : 'Mark maintenance'}
              </button>
            </div>
          ))}

          <form className="inline-edit-form department-form" onSubmit={handleCreateDepartment}>
            <h4>Create department or counter</h4>

            <label>
              Name
              <input
                type="text"
                value={departmentForm.name}
                onChange={(event) =>
                  setDepartmentForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Night Counter"
                required
              />
            </label>

            <label>
              Code
              <input
                type="text"
                value={departmentForm.code}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase().replaceAll(' ', '_'),
                  }))
                }
                placeholder="NIGHT_COUNTER"
                required
              />
            </label>

            <label>
              Type
              <input
                type="text"
                value={departmentForm.department_type}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    department_type: event.target.value,
                  }))
                }
                placeholder="extended_hours_service"
                required
              />
            </label>

            <label>
              Opening
              <input
                type="time"
                value={departmentForm.opening_time}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    opening_time: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Closing
              <input
                type="time"
                value={departmentForm.closing_time}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    closing_time: event.target.value,
                  }))
                }
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={departmentForm.is_revenue_center}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    is_revenue_center: event.target.checked,
                  }))
                }
              />
              Revenue center
            </label>

            <label className="wide-field">
              Notes
              <input
                type="text"
                value={departmentForm.notes}
                onChange={(event) =>
                  setDepartmentForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Operational note"
              />
            </label>

            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Create department'}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
