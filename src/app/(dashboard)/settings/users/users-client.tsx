"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { Plus, Users, Search, X, MoreHorizontal, KeyRound, ShieldOff, Lock } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { SlideOver } from "@/components/ui/slide-over";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createUserAction,
  updateUserAction,
  deactivateUserAction,
  resetPasswordAction,
  resetPinAction,
} from "@/lib/actions/user-actions";
import { UserRole, USER_ROLE_LABELS, USER_DIVISION_LABELS, type UserDivision } from "@/types/enums";
import type { UserCreateInput, UserUpdateInput } from "@/lib/validators";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  division: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserListResult {
  users: UserRow[];
  total: number;
  pageCount: number;
}

// ─── UserForm component ────────────────────────────────────────────────────────

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user?: UserRow | null;
  currentUserId: string;
}

interface UserFormState {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role: string;
  division: string;
  phone: string;
  email: string;
  pin: string;
}

function UserForm({ open, onClose, onSuccess, user, currentUserId }: UserFormProps) {
  const isEditing = !!user;
  const isSelf = user?.id === currentUserId;

  const [form, setForm] = useState<UserFormState>({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    role: "TECHNICIAN",
    division: "ALL",
    phone: "",
    email: "",
    pin: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});

  // Populate form when editing
  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        password: "",
        role: user.role,
        division: user.division || "ALL",
        phone: user.phone ?? "",
        email: user.email ?? "",
        pin: "",
      });
    } else {
      setForm({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        role: "TECHNICIAN",
        division: "ALL",
        phone: "",
        email: "",
        pin: "",
      });
    }
    setErrors({});
  }, [user, open]);

  function setField<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    if (isEditing) {
      const payload: UserUpdateInput = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        email: form.email || undefined,
      };
      // Only include role/division if not self
      if (!isSelf) {
        payload.role = form.role as UserUpdateInput["role"];
        payload.division = form.division as UserDivision;
      }

      const result = await updateUserAction(user!.id, payload);
      setSubmitting(false);

      if (result.success) {
        toast.success("User updated.");
        onSuccess();
        onClose();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    } else {
      const payload: UserCreateInput = {
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
        password: form.password,
        role: form.role as UserCreateInput["role"],
        division: form.division as UserDivision,
        phone: form.phone || undefined,
        email: form.email || undefined,
        pin: form.pin || undefined,
      };

      const result = await createUserAction(payload);
      setSubmitting(false);

      if (result.success) {
        toast.success("User created.");
        onSuccess();
        onClose();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-surface-300 transition-colors";
  const labelClass = "block text-xs font-medium text-surface-500 mb-1";

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit User" : "New User"}
      description={
        isEditing
          ? `Editing ${user?.firstName} ${user?.lastName}`
          : "Add a new user to the system"
      }
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors touch-target"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-600 disabled:opacity-50 transition-colors touch-target"
          >
            {submitting
              ? "Saving..."
              : isEditing
              ? "Save Changes"
              : "Add User"}
          </button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name *</label>
            <input
              type="text"
              className={cn(inputClass, errors.firstName && "border-danger")}
              placeholder="Juan"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              required
            />
            {errors.firstName && (
              <p className="text-xs text-danger mt-1">{errors.firstName}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input
              type="text"
              className={cn(inputClass, errors.lastName && "border-danger")}
              placeholder="dela Cruz"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              required
            />
            {errors.lastName && (
              <p className="text-xs text-danger mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Username */}
        <div>
          <label className={labelClass}>Username *</label>
          <input
            type="text"
            className={cn(inputClass, errors.username && "border-danger")}
            placeholder="juandc"
            value={form.username}
            onChange={(e) => setField("username", e.target.value)}
            required
            minLength={3}
            disabled={isEditing}
          />
          {isEditing && (
            <p className="text-xs text-surface-400 mt-1">Username cannot be changed.</p>
          )}
          {errors.username && (
            <p className="text-xs text-danger mt-1">{errors.username}</p>
          )}
        </div>

        {/* Password */}
        {!isEditing && (
          <div>
            <label className={labelClass}>Password *</label>
            <input
              type="password"
              className={cn(inputClass, errors.password && "border-danger")}
              placeholder="Min 6 characters"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              required
              minLength={6}
            />
            {errors.password && (
              <p className="text-xs text-danger mt-1">{errors.password}</p>
            )}
          </div>
        )}

        {/* Role */}
        <div>
          <label className={labelClass}>Role *</label>
          <select
            className={cn(inputClass, errors.role && "border-danger")}
            value={form.role}
            onChange={(e) => setField("role", e.target.value)}
            disabled={isSelf}
          >
            {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {isSelf && (
            <p className="text-xs text-surface-400 mt-1">You cannot change your own role.</p>
          )}
        </div>

        {/* Division */}
        <div>
          <label className={labelClass}>Division *</label>
          <select
            className={inputClass}
            value={form.division}
            onChange={(e) => setField("division", e.target.value)}
            disabled={isSelf}
          >
            {Object.entries(USER_DIVISION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {isSelf && (
            <p className="text-xs text-surface-400 mt-1">You cannot change your own division.</p>
          )}
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              className={inputClass}
              placeholder="09XX XXX XXXX"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={cn(inputClass, errors.email && "border-danger")}
              placeholder="user@example.com"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
            {errors.email && (
              <p className="text-xs text-danger mt-1">{errors.email}</p>
            )}
          </div>
        </div>

        {/* PIN (create only) */}
        {!isEditing && (
          <div>
            <label className={labelClass}>PIN (optional)</label>
            <input
              type="password"
              className={inputClass}
              placeholder="4-6 digit PIN for quick login"
              value={form.pin}
              onChange={(e) => setField("pin", e.target.value)}
              maxLength={6}
            />
            <p className="text-xs text-surface-400 mt-1">
              Used for shop floor quick login. 4-6 digits.
            </p>
          </div>
        )}
      </form>
    </SlideOver>
  );
}

// ─── Action Menu ─────────────────────────────────────────────────────────────

interface ActionMenuProps {
  user: UserRow;
  currentUserId: string;
  onEdit: (user: UserRow) => void;
  onDeactivate: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
  onResetPin: (user: UserRow) => void;
}

function ActionMenu({
  user,
  currentUserId,
  onEdit,
  onDeactivate,
  onResetPassword,
  onResetPin,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isSelf = user.id === currentUserId;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const btnClass =
    "w-full text-left px-3 py-2 text-sm hover:bg-surface-50 transition-colors flex items-center gap-2";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4 text-surface-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-48 bg-white border border-surface-200 rounded-xl shadow-lg py-1 animate-in fade-in slide-in-from-top-1">
          <button
            className={btnClass}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit(user);
            }}
          >
            <MoreHorizontal className="w-4 h-4" />
            Edit Details
          </button>
          <button
            className={btnClass}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onResetPassword(user);
            }}
          >
            <Lock className="w-4 h-4" />
            Reset Password
          </button>
          <button
            className={btnClass}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onResetPin(user);
            }}
          >
            <KeyRound className="w-4 h-4" />
            Reset PIN
          </button>
          {!isSelf && user.isActive && (
            <>
              <div className="border-t border-surface-100 my-1" />
              <button
                className={cn(btnClass, "text-danger hover:bg-danger-50")}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onDeactivate(user);
                }}
              >
                <ShieldOff className="w-4 h-4" />
                Deactivate
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reset Password Dialog ──────────────────────────────────────────────────

interface ResetDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message: string;
  confirmLabel: string;
  inputType: "password" | "text";
  inputPlaceholder: string;
  loading?: boolean;
}

function ResetInputDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  inputType,
  inputPlaceholder,
  loading,
}: ResetDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-white rounded-xl shadow-2xl p-6">
          <h3 className="font-semibold text-primary">{title}</h3>
          <p className="text-sm text-surface-500 mt-1">{message}</p>
          <input
            type={inputType}
            className="w-full mt-4 px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 placeholder:text-surface-300 transition-colors"
            placeholder={inputPlaceholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors touch-target"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(value)}
              disabled={loading || !value}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-600 transition-colors disabled:opacity-50 touch-target"
            >
              {loading ? "Processing..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function roleVariant(role: string): "accent" | "warning" | "success" | "default" | "outline" {
  switch (role) {
    case "OWNER":
      return "accent";
    case "MANAGER":
      return "warning";
    case "ADVISOR":
    case "ESTIMATOR":
      return "success";
    default:
      return "outline";
  }
}

export function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [data, setData] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "firstName", desc: false },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  // Dialogs
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<UserRow | null>(null);
  const [resetPinTarget, setResetPinTarget] = useState<UserRow | null>(null);

  const [isPending, startTransition] = useTransition();

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPageIndex(0);
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageIndex + 1),
        pageSize: "25",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");

      const result: UserListResult = await res.json();
      setData(result.users);
      setTotal(result.total);
      setPageCount(result.pageCount);
    } catch {
      toast.error("Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [pageIndex, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  function handleNewUser() {
    setEditUser(null);
    setShowForm(true);
  }

  function handleEdit(user: UserRow) {
    setEditUser(user);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditUser(null);
  }

  function handleFormSuccess() {
    fetchData();
  }

  function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    const id = deactivateTarget.id;
    startTransition(async () => {
      const result = await deactivateUserAction(id);
      if (result.success) {
        toast.success("User deactivated.");
        fetchData();
      } else {
        toast.error(result.error ?? "Failed to deactivate user.");
      }
      setDeactivateTarget(null);
    });
  }

  function handleResetPasswordConfirm(newPassword: string) {
    if (!resetPwTarget) return;
    const id = resetPwTarget.id;
    startTransition(async () => {
      const result = await resetPasswordAction(id, newPassword);
      if (result.success) {
        toast.success("Password reset successfully.");
      } else {
        toast.error(result.error ?? "Failed to reset password.");
      }
      setResetPwTarget(null);
    });
  }

  function handleResetPinConfirm(newPin: string) {
    if (!resetPinTarget) return;
    const id = resetPinTarget.id;
    startTransition(async () => {
      const result = await resetPinAction(id, newPin);
      if (result.success) {
        toast.success("PIN reset successfully.");
      } else {
        toast.error(result.error ?? "Failed to reset PIN.");
      }
      setResetPinTarget(null);
    });
  }

  // Table columns
  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      accessorKey: "firstName",
      header: "Name",
      enableSorting: true,
      cell: ({ row }) => (
        <div className="font-medium text-primary">
          {row.original.firstName} {row.original.lastName}
          {row.original.id === currentUserId && (
            <span className="ml-1.5 text-xs text-surface-400 font-normal">(you)</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "username",
      header: "Username",
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-surface-600">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      enableSorting: false,
      cell: ({ getValue }) => {
        const role = getValue() as string;
        return (
          <Badge variant={roleVariant(role)}>
            {USER_ROLE_LABELS[role as UserRole] ?? role}
          </Badge>
        );
      },
    },
    {
      accessorKey: "division",
      header: "Division",
      enableSorting: false,
      cell: ({ getValue }) => {
        const div = getValue() as string;
        return (
          <span className="text-xs font-medium text-surface-500">
            {USER_DIVISION_LABELS[div as UserDivision] ?? div}
          </span>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      enableSorting: false,
      cell: ({ getValue }) => {
        const phone = getValue() as string | null;
        return phone ? (
          <span className="font-mono text-sm">{phone}</span>
        ) : (
          <span className="text-surface-300 text-sm">&mdash;</span>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      enableSorting: false,
      cell: ({ getValue }) => {
        const active = getValue() as boolean;
        return (
          <Badge variant={active ? "success" : "danger"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <ActionMenu
          user={row.original}
          currentUserId={currentUserId}
          onEdit={handleEdit}
          onDeactivate={setDeactivateTarget}
          onResetPassword={setResetPwTarget}
          onResetPin={setResetPinTarget}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">User Management</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {loading ? "Loading..." : `${total.toLocaleString()} user${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={handleNewUser}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors touch-target shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New User
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-100 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-surface-400" />
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={25}
        sorting={sorting}
        onSortingChange={setSorting}
        onPageChange={setPageIndex}
        isLoading={loading}
        emptyState={
          <EmptyState
            icon={Users}
            title={search ? "No users found" : "No users yet"}
            description={
              search
                ? `No users match "${search}". Try a different search.`
                : "Add your first user to get started."
            }
            action={
              !search ? (
                <button
                  onClick={handleNewUser}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              ) : undefined
            }
          />
        }
      />

      {/* User Form SlideOver */}
      <UserForm
        open={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        user={editUser}
        currentUserId={currentUserId}
      />

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateConfirm}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${deactivateTarget?.firstName} ${deactivateTarget?.lastName}? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={isPending}
      />

      {/* Reset Password Dialog */}
      <ResetInputDialog
        open={!!resetPwTarget}
        onClose={() => setResetPwTarget(null)}
        onConfirm={handleResetPasswordConfirm}
        title="Reset Password"
        message={`Set a new password for ${resetPwTarget?.firstName} ${resetPwTarget?.lastName}.`}
        confirmLabel="Reset Password"
        inputType="password"
        inputPlaceholder="New password (min 6 characters)"
        loading={isPending}
      />

      {/* Reset PIN Dialog */}
      <ResetInputDialog
        open={!!resetPinTarget}
        onClose={() => setResetPinTarget(null)}
        onConfirm={handleResetPinConfirm}
        title="Reset PIN"
        message={`Set a new PIN for ${resetPinTarget?.firstName} ${resetPinTarget?.lastName}.`}
        confirmLabel="Reset PIN"
        inputType="password"
        inputPlaceholder="New PIN (4-6 digits)"
        loading={isPending}
      />
    </div>
  );
}
