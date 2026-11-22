import React, { useState } from 'react';
import { Check, Shield, UserCheck, UserPlus, X } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface AuthRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  onUserCreated: (user: UserProfile) => void;
}

const NEIGHBORHOODS = [
  'Bellandur',
  'Whitefield',
  'Koramangala',
  'Indiranagar',
  'HSR Layout',
  'Electronic City',
];

export const AuthRoleModal: React.FC<AuthRoleModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser,
  onUserCreated,
}) => {
  const [tab, setTab] = useState<'switch' | 'register'>('switch');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('donor');
  const [organization, setOrganization] = useState('');
  const [subType, setSubType] = useState('Wedding Caterer');
  const [neighborhood, setNeighborhood] = useState('Bellandur');
  const [capacityKg, setCapacityKg] = useState(150);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          role,
          organization,
          subType,
          neighborhood,
          capacityKg,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      onUserCreated(data.user);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to register');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Multi-Role Authentication &amp; Partner Directory
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Switch Active Stakeholder or Register Node
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('switch')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'switch'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Pre-Loaded Corridor Accounts ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create New Partner Account
            </button>
          </div>
        </div>

        {tab === 'switch' ? (
          <div className="p-6 space-y-2.5 max-h-[420px] overflow-y-auto">
            {users.map((u) => {
              const active = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onSelectUser(u);
                    onClose();
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-4 cursor-pointer ${
                    active
                      ? 'border-orange-600 bg-orange-50/50 dark:bg-orange-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold uppercase text-slate-800 dark:text-slate-200">
                        {u.role}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{u.subType}</span>
                      <span aria-hidden="true">·</span>
                      <span>{u.neighborhood}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {u.organization}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {u.name} · {u.email} · {u.contactSynthetic}
                    </div>
                  </div>
                  {active && (
                    <Check className="w-5 h-5 text-orange-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={handleRegister} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="donor">Food Donor (Caterer / Canteen)</option>
                  <option value="receiver">
                    Receiver (NGO / Shelter Kitchen)
                  </option>
                  <option value="volunteer">Delivery Volunteer</option>
                  <option value="sponsor">CSR / Municipal Sponsor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Bengaluru Corridor Hub
                </label>
                <select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {NEIGHBORHOODS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Organization / Facility Name (Use Sample Name)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sri Krishna Convention Caterers or Hope Shelter"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Coordinator Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Vikram Shetty"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Handling Capacity (kg per batch)
                </label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Assigns synthetic corridor ID automatically</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg cursor-pointer"
              >
                {submitting ? 'Creating Account...' : 'Register & Switch Role'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
