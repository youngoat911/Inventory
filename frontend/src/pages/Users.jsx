import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { usePageTitle } from '../hooks/usePageTitle'

const ROLE_OPTIONS = ['super_admin', 'org_admin', 'berm_incharge', 'borrower', 'auditor']

const emptyUser = {
  full_name: '',
  institute_email: '',
  roll_no: '',
  phone: '',
  programme: '',
  password: '',
}

export default function Users() {
  usePageTitle('Users')
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [rolesUser, setRolesUser] = useState(null)
  const [roles, setRoles] = useState([])
  const [form, setForm] = useState(emptyUser)
  const [editForm, setEditForm] = useState({})
  const [roleForm, setRoleForm] = useState({ role: 'borrower', position_title: '', academic_year: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await usersApi.list({ page, limit: 20, q: q || undefined })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.create({
        full_name: form.full_name.trim(),
        institute_email: form.institute_email.trim(),
        roll_no: form.roll_no.trim(),
        phone: form.phone.trim() || undefined,
        programme: form.programme.trim() || undefined,
        password: form.password,
      })
      setShowCreate(false)
      setForm(emptyUser)
      setPage(1)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.update(editUser.id, {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || undefined,
        programme: editForm.programme.trim() || undefined,
        is_active: editForm.is_active,
      })
      setEditUser(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this user?')) return
    try {
      await usersApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function openRoles(user) {
    setRolesUser(user)
    setError('')
    try {
      const res = await usersApi.listRoles(user.id)
      setRoles(res.data || [])
    } catch (err) {
      setError(err.message)
      setRoles([])
    }
  }

  async function handleAddRole(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.addRole(rolesUser.id, {
        role: roleForm.role,
        position_title: roleForm.position_title.trim() || undefined,
        academic_year: roleForm.academic_year.trim() || undefined,
      })
      setRoleForm({ role: 'borrower', position_title: '', academic_year: '' })
      const res = await usersApi.listRoles(rolesUser.id)
      setRoles(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveRole(roleId) {
    if (!confirm('Remove this role?')) return
    try {
      await usersApi.removeRole(rolesUser.id, roleId)
      const res = await usersApi.listRoles(rolesUser.id)
      setRoles(res.data || [])
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Manage accounts and assign roles.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Add user
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search users…"
          value={q}
          onChange={(e) => {
            setPage(1)
            setQ(e.target.value)
          }}
        />
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="users"
              title="No users found"
              description="Register users or add accounts to manage access."
              action={{ label: 'New user', onClick: () => { setForm(emptyUser); setShowCreate(true) } }}
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Roll</th>
                  <th scope="col">Active</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Name" data-card-title>{user.full_name}</td>
                    <td className="muted" data-label="Email">{user.institute_email}</td>
                    <td className="muted" data-label="Roll">{user.roll_no}</td>
                    <td data-label="Active">
                      <span className={`badge ${user.is_active !== false ? 'badge-ok' : 'badge-danger'}`}>
                        {user.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-actions>
                      <div className="row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openRoles(user)}>
                          Roles
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditUser(user)
                            setEditForm({
                              full_name: user.full_name || '',
                              phone: user.phone || '',
                              programme: user.programme || '',
                              is_active: user.is_active !== false,
                            })
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(user.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {showCreate ? (
        <Modal
          title="Add user"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-user" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </button>
            </>
          }
        >
          <form id="create-user" className="form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="institute_email">Institute email</label>
              <input
                id="institute_email"
                type="email"
                value={form.institute_email}
                onChange={(e) => setForm((p) => ({ ...p, institute_email: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="roll_no">Roll no.</label>
                <input
                  id="roll_no"
                  value={form.roll_no}
                  onChange={(e) => setForm((p) => ({ ...p, roll_no: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="programme">Programme</label>
              <input
                id="programme"
                value={form.programme}
                onChange={(e) => setForm((p) => ({ ...p, programme: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                required
              />
            </div>
          </form>
        </Modal>
      ) : null}

      {editUser ? (
        <Modal
          title="Edit user"
          onClose={() => setEditUser(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setEditUser(null)}>
                Cancel
              </button>
              <button type="submit" form="edit-user" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <form id="edit-user" className="form" onSubmit={handleUpdate}>
            <div className="field">
              <label htmlFor="edit_full_name">Full name</label>
              <input
                id="edit_full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="edit_phone">Phone</label>
                <input
                  id="edit_phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="edit_programme">Programme</label>
                <input
                  id="edit_programme"
                  value={editForm.programme}
                  onChange={(e) => setEditForm((p) => ({ ...p, programme: e.target.value }))}
                />
              </div>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                />{' '}
                Active
              </label>
            </div>
          </form>
        </Modal>
      ) : null}

      {rolesUser ? (
        <Modal
          title={`Roles — ${rolesUser.full_name}`}
          onClose={() => setRolesUser(null)}
          footer={
            <button type="button" className="btn btn-ghost" onClick={() => setRolesUser(null)}>
              Close
            </button>
          }
        >
          <form className="form" onSubmit={handleAddRole}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={roleForm.role}
                  onChange={(e) => setRoleForm((p) => ({ ...p, role: e.target.value }))}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="academic_year">Academic year</label>
                <input
                  id="academic_year"
                  value={roleForm.academic_year}
                  onChange={(e) => setRoleForm((p) => ({ ...p, academic_year: e.target.value }))}
                  placeholder="2025-2026"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="position_title">Position title</label>
              <input
                id="position_title"
                value={roleForm.position_title}
                onChange={(e) => setRoleForm((p) => ({ ...p, position_title: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add role'}
            </button>
          </form>
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            {roles.length === 0 ? (
              <EmptyState message="No roles assigned." />
            ) : (
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Title</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td data-label="Role" data-card-title>{role.role}</td>
                      <td className="muted" data-label="Title">{role.position_title || role.academic_year || '—'}</td>
                      <td data-actions>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveRole(role.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
