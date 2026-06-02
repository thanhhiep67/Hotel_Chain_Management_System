import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { getAdminUsers, updateUserStatus, deleteAdminUser } from '../../api/admin';

const ROLE_STYLE = {
  ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  OWNER: 'bg-blue-50   text-blue-700   border-blue-200',
  STAFF: 'bg-teal-50   text-teal-700   border-teal-200',
  USER:  'bg-gray-100  text-gray-600   border-gray-200',
};
const ROLE_LABEL = { ADMIN: 'Admin', OWNER: 'Chủ KS', STAFF: 'Nhân viên', USER: 'Khách' };

const STATUS_STYLE = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  LOCKED: 'bg-red-50   text-red-700   border-red-200',
};
const STATUS_LABEL = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa' };

const ROLE_FILTERS = [
  { value: '',       label: 'Tất cả' },
  { value: 'ADMIN',  label: 'Admin' },
  { value: 'OWNER',  label: 'Chủ KS' },
  { value: 'STAFF',  label: 'Nhân viên' },
  { value: 'USER',   label: 'Khách' },
];
const STATUS_FILTERS = [
  { value: '',       label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'LOCKED', label: 'Đã khóa' },
];
const PAGE_SIZE = 15;

/* ── Confirm modal ── */
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl
              hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-xl transition cursor-pointer
              disabled:opacity-50 ${confirmClass}`}>
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button onClick={() => onChange(page - 1)} disabled={page === 0}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
          disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer">
        ← Trước
      </button>
      {start > 0 && <span className="px-2 text-gray-400">…</span>}
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`w-9 h-9 text-sm rounded-xl transition cursor-pointer
            ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
          {p + 1}
        </button>
      ))}
      {end < totalPages - 1 && <span className="px-2 text-gray-400">…</span>}
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
          disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer">
        Sau →
      </button>
    </div>
  );
}

/* ── User row ── */
function UserRow({ user, onToggleLock, onDelete }) {
  const isLocked = user.status === 'LOCKED';
  const isAdmin  = user.role  === 'ADMIN';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 text-sm">{user.fullName}</div>
        <div className="text-xs text-gray-400 mt-0.5">{user.email}</div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs
          font-medium border ${ROLE_STYLE[user.role]}`}>
          {ROLE_LABEL[user.role] ?? user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs
          font-medium border ${STATUS_STYLE[user.status] ?? STATUS_STYLE.ACTIVE}`}>
          {STATUS_LABEL[user.status] ?? user.status}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          {!isAdmin && (
            <button
              onClick={() => onToggleLock(user)}
              className={`px-3 py-1.5 text-xs rounded-xl transition cursor-pointer font-medium
                ${isLocked
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {isLocked ? '✓ Mở khóa' : '🔒 Khóa'}
            </button>
          )}
          {!isAdmin && (
            <button
              onClick={() => onDelete(user)}
              className="px-3 py-1.5 text-xs border border-red-200 text-red-600
                hover:bg-red-50 rounded-xl transition cursor-pointer">
              Xóa
            </button>
          )}
          {isAdmin && (
            <span className="text-xs text-gray-300 italic">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Main page ── */
export default function AdminUsersPage() {
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [users,        setUsers]        = useState([]);
  const [page,         setPage]         = useState(0);
  const [totalPages,   setTotalPages]   = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [confirm,      setConfirm]      = useState(null); // { user, type: 'lock'|'unlock'|'delete' }
  const [actionLoading, setActionLoading] = useState(false);
  const [toast,        setToast]        = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async (role, status, p) => {
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (role)   params.role   = role;
      if (status) params.status = status;
      const res = await getAdminUsers(params);
      const d   = res.data.data;
      setUsers(d.content);
      setTotalPages(d.totalPages);
      setTotalElements(d.totalElements);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(roleFilter, statusFilter, page); }, [roleFilter, statusFilter, page, load]);

  const handleRoleFilter = (val) => { setRoleFilter(val); setPage(0); };
  const handleStatusFilter = (val) => { setStatusFilter(val); setPage(0); };

  const handleToggleLock = (user) => {
    const type = user.status === 'LOCKED' ? 'unlock' : 'lock';
    setConfirm({ user, type });
  };
  const handleDelete = (user) => setConfirm({ user, type: 'delete' });

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      if (confirm.type === 'lock') {
        await updateUserStatus(confirm.user.id, 'LOCKED');
        showToast(`Đã khóa tài khoản ${confirm.user.fullName}.`);
      } else if (confirm.type === 'unlock') {
        await updateUserStatus(confirm.user.id, 'ACTIVE');
        showToast(`Đã mở khóa tài khoản ${confirm.user.fullName}.`);
      } else {
        await deleteAdminUser(confirm.user.id);
        showToast(`Đã xóa tài khoản ${confirm.user.fullName}.`);
      }
      setConfirm(null);
      load(roleFilter, statusFilter, page);
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Có lỗi xảy ra');
    } finally {
      setActionLoading(false);
    }
  };

  const modalProps = confirm && (() => {
    const { user, type } = confirm;
    if (type === 'lock') return {
      title: 'Khóa tài khoản',
      message: <>Xác nhận khóa tài khoản <strong>{user.fullName}</strong>? Người dùng sẽ không thể đăng nhập.</>,
      confirmLabel: 'Khóa',
      confirmClass: 'bg-red-600 hover:bg-red-700',
    };
    if (type === 'unlock') return {
      title: 'Mở khóa tài khoản',
      message: <>Xác nhận mở khóa tài khoản <strong>{user.fullName}</strong>?</>,
      confirmLabel: 'Mở khóa',
      confirmClass: 'bg-green-600 hover:bg-green-700',
    };
    return {
      title: 'Xóa tài khoản',
      message: <>Xác nhận xóa vĩnh viễn tài khoản <strong>{user.fullName}</strong>? Thao tác này không thể hoàn tác.</>,
      confirmLabel: 'Xóa',
      confirmClass: 'bg-red-600 hover:bg-red-700',
    };
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Xem, khóa và xóa tài khoản người dùng</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4
          flex flex-wrap gap-x-6 gap-y-3 items-center">
          {/* Role filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium shrink-0">Vai trò:</span>
            {ROLE_FILTERS.map((f) => (
              <button key={f.value} onClick={() => handleRoleFilter(f.value)}
                className={`px-3 py-1 text-xs rounded-lg border transition cursor-pointer font-medium
                  ${roleFilter === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium shrink-0">Trạng thái:</span>
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} onClick={() => handleStatusFilter(f.value)}
                className={`px-3 py-1 text-xs rounded-lg border transition cursor-pointer font-medium
                  ${statusFilter === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-sm text-gray-400 shrink-0">
            {totalElements} người dùng
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="space-y-0">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-14 border-b border-gray-100 animate-pulse bg-white last:border-0" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-500 font-medium">Không có người dùng nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Người dùng
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                      Vai trò
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                      Ngày tạo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u}
                      onToggleLock={handleToggleLock}
                      onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
      </main>

      {confirm && (
        <ConfirmModal
          {...modalProps}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          loading={actionLoading}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3
          bg-gray-900 text-white text-sm rounded-2xl shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
