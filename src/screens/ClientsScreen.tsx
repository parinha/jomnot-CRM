'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Client } from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useProjects } from '@/src/hooks/useProjects';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import {
  calcEarned,
  calcNet,
  calcSubtotal,
  calcBalance,
} from '@/src/features/invoices/lib/calculations';
import { fmtUSD, fmtDate } from '@/src/lib/formatters';
import { uid } from '@/src/lib/id';
import { PAGE_SIZE, STORAGE_KEYS } from '@/src/config/constants';
import { STATUS_CONFIG, PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import SortTh from '@/src/components/SortTh';
import SearchInput from '@/src/components/SearchInput';
import Pagination from '@/src/components/Pagination';
import ModalShell from '@/src/components/ModalShell';
import InvoicePreviewModal from '@/src/features/invoices/components/InvoicePreviewModal';
import ConfirmDeleteModal from '@/src/components/ConfirmDeleteModal';
import { useClientMutations } from '@/src/hooks/useClients';

const fmt = fmtUSD;
const EMPTY_FORM: Omit<Client, 'id'> = {
  name: '',
  contactPerson: '',
  phone: '',
  address: '',
  email: '',
  vat_tin: '',
  note: '',
};
type CliSortCol = 'name' | 'invoices' | 'earned';

const inputCls =
  'h-11 rounded-xl border border-zinc-200 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full bg-white';

function formatKhmerLocal(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
}

function phoneToLocal(full: string): string {
  return full.replace(/^\+855\s*/, '');
}

function phoneToFull(local: string): string {
  return local.trim() ? `+855 ${local}` : '';
}

export default function ClientsScreen() {
  const { data: clients, isLoading } = useClients();
  const { data: invoices } = useInvoices();
  const { data: projects } = useProjects();

  const [, startTransition] = useTransition();
  const { upsert, remove } = useClientMutations();

  const searchParams = useSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState('');

  const filteredClients = search.trim()
    ? clients.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          (c.contactPerson ?? '').toLowerCase().includes(q) ||
          (c.note ?? '').toLowerCase().includes(q)
        );
      })
    : clients;

  const [sortCol, setSortCol] = useState<CliSortCol>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem(STORAGE_KEYS.tableCliCol) as CliSortCol) ?? 'name')
      : 'name'
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem(STORAGE_KEYS.tableCliDir) as 'asc' | 'desc') ?? 'asc')
      : 'asc'
  );
  const [page, setPage] = useState<number>(() =>
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem(STORAGE_KEYS.tableCliPage) ?? '1') || 1
      : 1
  );

  const [prevSearch, setPrevSearch] = useState(search);
  const [prevClientsLen, setPrevClientsLen] = useState(clients.length);
  if (prevSearch !== search || prevClientsLen !== clients.length) {
    setPrevSearch(search);
    setPrevClientsLen(clients.length);
    setPage(1);
    localStorage.setItem(STORAGE_KEYS.tableCliPage, '1');
  }

  function handleSort(col: string) {
    const nextDir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc';
    setSortCol(col as CliSortCol);
    setSortDir(nextDir);
    setPage(1);
    localStorage.setItem(STORAGE_KEYS.tableCliCol, col);
    localStorage.setItem(STORAGE_KEYS.tableCliDir, nextDir);
    localStorage.setItem(STORAGE_KEYS.tableCliPage, '1');
  }
  function goToPage(p: number) {
    setPage(p);
    localStorage.setItem(STORAGE_KEYS.tableCliPage, String(p));
  }

  const statsMap = new Map(
    clients.map((c) => {
      const ci = invoices.filter((inv) => inv.clientId === c.id);
      const earned = ci.reduce((s, inv) => s + calcEarned(inv), 0);
      const remaining = ci
        .filter(
          (inv) => inv.status === 'sent' || inv.status === 'partial' || inv.status === 'overdue'
        )
        .reduce((s, inv) => s + calcBalance(inv), 0);
      const projectCount = projects.filter((p) => p.clientId === c.id).length;
      return [c.id, { count: ci.length, earned, remaining, projectCount }];
    })
  );

  const sortedClients = [...filteredClients].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'name') cmp = a.name.localeCompare(b.name);
    if (sortCol === 'invoices')
      cmp = (statsMap.get(a.id)?.count ?? 0) - (statsMap.get(b.id)?.count ?? 0);
    if (sortCol === 'earned')
      cmp = (statsMap.get(a.id)?.earned ?? 0) - (statsMap.get(b.id)?.earned ?? 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedClients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedClients = sortedClients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const [modalOpen, setModalOpen] = useState(() => searchParams.get('new') === '1');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Strip ?new=1 from URL after using it for initial state — no setState here
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      router.replace('/dashboard/clients');
    }
  }, [router, searchParams]);

  function openAdd() {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({
      name: client.name,
      contactPerson: client.contactPerson ?? '',
      phone: client.phone,
      address: client.address,
      email: client.email,
      vat_tin: client.vat_tin ?? '',
      note: client.note ?? '',
    });
    setFormError('');
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function handleSave() {
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!form.phone.trim()) {
      setFormError('Phone is required.');
      return;
    }
    const client: Client = editingClient ? { ...editingClient, ...form } : { id: uid(), ...form };
    closeModal();
    startTransition(async () => {
      await upsert(client);
    });
  }
  function handleDelete(id: string) {
    setDeleteId(null);
    startTransition(async () => {
      await remove(id);
    });
  }

  const [previewInvId, setPreviewInvId] = useState<string | null>(null);
  const [invoicesClientId, setInvoicesClientId] = useState<string | null>(null);
  const [projectsClientId, setProjectsClientId] = useState<string | null>(null);

  if (isLoading) return <TablePageSkeleton />;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-sm text-white/45 mt-0.5">{clients.length} total</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-11 px-5 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 active:bg-amber-500 transition shadow-lg shadow-amber-500/20"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add client
        </button>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, phone, address…"
        className="mb-4"
      />

      {/* Empty states */}
      {clients.length === 0 ? (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl flex flex-col items-center justify-center py-20 text-white/35">
          <svg
            className="w-12 h-12 mb-3 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-sm">No clients yet. Add your first one.</p>
        </div>
      ) : sortedClients.length === 0 ? (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl flex flex-col items-center justify-center py-14 text-white/35">
          <p className="text-sm">No clients match your search.</p>
          <button
            onClick={() => setSearch('')}
            className="mt-2 text-xs text-[#FFC206] hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {pagedClients.map((client) => {
              const stats = statsMap.get(client.id);
              return (
                <div
                  key={client.id}
                  className="bg-white/[0.05] border border-white/[0.09] rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{client.name}</p>
                      {client.contactPerson && (
                        <p className="text-xs text-white/50 mt-0.5 truncate">
                          {client.contactPerson}
                        </p>
                      )}
                      {client.phone && (
                        <p className="text-xs text-white/35 mt-0.5">{client.phone}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(client)}
                        className="h-9 w-9 rounded-xl border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteId(client.id)}
                        className="h-9 w-9 rounded-xl border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/15 transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {stats?.count || stats?.earned || stats?.remaining ? (
                    <div className="flex gap-2">
                      {stats?.count ? (
                        <button
                          onClick={() => setInvoicesClientId(client.id)}
                          className="flex-1 bg-white/[0.06] rounded-xl p-2.5 text-center hover:bg-white/10 transition"
                        >
                          <p className="font-bold text-white text-sm">{stats.count}</p>
                          <p className="text-white/40 text-xs mt-0.5">Invoices</p>
                        </button>
                      ) : null}
                      {stats?.earned ? (
                        <div className="flex-1 bg-white/[0.06] rounded-xl p-2.5 text-center">
                          <p className="font-bold text-white text-sm amt">{fmt(stats.earned)}</p>
                          <p className="text-white/40 text-xs mt-0.5">Earned</p>
                        </div>
                      ) : null}
                      {stats?.remaining > 0 ? (
                        <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
                          <p className="font-bold text-amber-400 text-sm amt">
                            {fmt(stats.remaining)}
                          </p>
                          <p className="text-amber-400/60 text-xs mt-0.5">Owed</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                  <SortTh
                    col="name"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-left px-4 py-3.5"
                  >
                    Name
                  </SortTh>
                  <th className="text-left px-4 py-3.5 font-medium text-white/45">Contact</th>
                  <th className="text-left px-4 py-3.5 font-medium text-white/45 hidden md:table-cell">
                    Phone
                  </th>

                  <th className="text-center px-4 py-3.5 font-medium text-white/45 hidden md:table-cell">
                    Projects
                  </th>
                  <SortTh
                    col="invoices"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-center px-4 py-3.5"
                  >
                    Invoices
                  </SortTh>
                  <SortTh
                    col="earned"
                    active={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    className="text-right px-4 py-3.5"
                  >
                    Earned
                  </SortTh>
                  <th className="text-right px-4 py-3.5 font-medium text-white/45 hidden md:table-cell">
                    Remaining
                  </th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {pagedClients.map((client, i) => {
                  const stats = statsMap.get(client.id);
                  return (
                    <tr
                      key={client.id}
                      className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-4 py-3.5 font-semibold text-white">{client.name}</td>
                      <td className="px-4 py-3.5">
                        {client.contactPerson ? (
                          <>
                            <div className="text-white/80 text-sm">{client.contactPerson}</div>
                            <div className="text-xs text-white/40">{client.email}</div>
                          </>
                        ) : (
                          <span className="text-white/60">{client.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-white/60 hidden md:table-cell">
                        {client.phone || '—'}
                      </td>

                      <td className="px-4 py-3.5 text-center hidden md:table-cell">
                        {stats && stats.projectCount > 0 ? (
                          <button
                            onClick={() => setProjectsClientId(client.id)}
                            className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/15 transition"
                          >
                            {stats.projectCount}
                          </button>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {stats && stats.count > 0 ? (
                          <button
                            onClick={() => setInvoicesClientId(client.id)}
                            className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/70 hover:bg-white/15 transition"
                          >
                            {stats.count}
                          </button>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-white">
                        {stats && stats.count > 0 ? (
                          <span className="amt">{fmt(stats.earned)}</span>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right hidden md:table-cell">
                        {stats && stats.remaining > 0 ? (
                          <span className="font-semibold text-amber-400 amt">
                            {fmt(stats.remaining)}
                          </span>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(client)}
                            className="h-9 px-4 rounded-xl border border-white/20 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteId(client.id)}
                            className="h-9 px-4 rounded-xl border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={sortedClients.length}
        pageSize={PAGE_SIZE}
        onPageChange={goToPage}
      />

      {/* Add / Edit modal */}
      {modalOpen && (
        <ModalShell onClose={closeModal}>
          <div className="p-6">
            <h2 className="text-lg font-bold text-zinc-900 mb-5">
              {editingClient ? 'Edit client' : 'Add client'}
            </h2>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Company Name *', key: 'name', placeholder: 'ANYMIND CO., LTD' },
                { label: 'Contact Person', key: 'contactPerson', placeholder: 'Mr. Smith' },
                { label: 'Email', key: 'email', placeholder: 'billing@example.com' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={(form as Record<string, string>)[key] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}

              {/* Phone with +855 prefix */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                  Phone *
                </label>
                <div className="flex h-11 rounded-xl border border-zinc-200 focus-within:ring-2 focus-within:ring-[#FFC206] focus-within:border-transparent transition bg-white overflow-hidden">
                  <span className="flex items-center px-3 text-sm font-medium text-zinc-500 bg-zinc-50 border-r border-zinc-200 shrink-0 select-none">
                    +855
                  </span>
                  <input
                    type="tel"
                    value={phoneToLocal(form.phone)}
                    onChange={(e) => {
                      const formatted = formatKhmerLocal(e.target.value);
                      setForm((p) => ({ ...p, phone: phoneToFull(formatted) }));
                    }}
                    placeholder="12 123 1234"
                    className="flex-1 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {[
                { label: 'VAT TIN', key: 'vat_tin', placeholder: 'K008-100069509' },
                { label: 'Address', key: 'address', placeholder: '123 Street, City, Country' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={(form as Record<string, string>)[key] ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                  Note
                </label>
                <textarea
                  value={form.note ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Internal notes…"
                  rows={3}
                  className={`${inputCls} h-auto py-3 resize-none`}
                />
              </div>
            </div>
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 h-11 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 h-11 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition"
              >
                {editingClient ? 'Save changes' : 'Add client'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <ConfirmDeleteModal
          title="Delete client?"
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}

      {/* Client projects popup */}
      {projectsClientId &&
        (() => {
          const client = clients.find((c) => c.id === projectsClientId);
          const clientProjects = projects.filter((p) => p.clientId === projectsClientId);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setProjectsClientId(null);
              }}
            >
              <div className="w-full max-w-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-white">{client?.name}</h2>
                    <p className="text-sm text-white/45 mt-0.5">
                      {clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setProjectsClientId(null)}
                    className="p-2.5 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {clientProjects.length === 0 ? (
                    <p className="text-sm text-white/35 text-center py-10">
                      No projects for this client.
                    </p>
                  ) : (
                    <>
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-800/90 border-b border-white/[0.08]">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-white/45">
                              Project
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-white/45 hidden sm:table-cell">
                              Status
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-white/45 hidden md:table-cell">
                              Progress
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-white/45 hidden md:table-cell">
                              Deliver
                            </th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-white/45">
                              Net Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientProjects.map((p, i) => {
                            const sc = PROJECT_STATUS_CONFIG[p.status] ?? {
                              label: 'Unknown',
                              cls: 'bg-zinc-700 text-zinc-300',
                            };
                            const doneCount = p.items.filter((it) => it.status === 'done').length;
                            const totalItems = p.items.length;
                            const pct =
                              totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
                            // Net from linked invoices; fall back to budget
                            const linkedInvNet = p.invoiceIds
                              .map((id) => invoices.find((inv) => inv.id === id))
                              .filter(Boolean)
                              .reduce((s, inv) => s + calcNet(inv!), 0);
                            const netValue = linkedInvNet > 0 ? linkedInvNet : (p.budget ?? 0);
                            return (
                              <tr
                                key={p.id}
                                className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                              >
                                <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                                <td className="px-4 py-3 hidden sm:table-cell">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}
                                  >
                                    {sc.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  {totalItems > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-[#FFC206]"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-white/50">
                                        {doneCount}/{totalItems}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-white/25 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-white/60 text-xs hidden md:table-cell">
                                  {p.deliverDate ? (
                                    fmtDate(p.deliverDate)
                                  ) : (
                                    <span className="text-white/25">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {netValue > 0 ? (
                                    <span className="font-semibold text-white amt">
                                      {fmt(netValue)}
                                    </span>
                                  ) : (
                                    <span className="text-white/25 text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Totals footer */}
                      {clientProjects.length > 0 &&
                        (() => {
                          const totalNet = clientProjects.reduce((s, p) => {
                            const linked = p.invoiceIds
                              .map((id) => invoices.find((inv) => inv.id === id))
                              .filter(Boolean)
                              .reduce((sum, inv) => sum + calcNet(inv!), 0);
                            return s + (linked > 0 ? linked : (p.budget ?? 0));
                          }, 0);
                          const earned = invoices
                            .filter(
                              (inv) =>
                                inv.clientId === projectsClientId &&
                                (inv.status === 'paid' || inv.status === 'partial')
                            )
                            .reduce((s, inv) => s + calcEarned(inv), 0);
                          return (
                            <div className="border-t border-white/[0.08] px-4 py-3 flex justify-between text-xs text-white/50">
                              <span>
                                {clientProjects.length} project
                                {clientProjects.length !== 1 ? 's' : ''}
                              </span>
                              <div className="flex gap-4">
                                <span>
                                  Earned:{' '}
                                  <span className="text-emerald-400 font-semibold amt">
                                    {fmt(earned)}
                                  </span>
                                </span>
                                <span>
                                  Total Net:{' '}
                                  <span className="text-white font-semibold amt">
                                    {fmt(totalNet)}
                                  </span>
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Client invoices popup */}
      {invoicesClientId &&
        (() => {
          const client = clients.find((c) => c.id === invoicesClientId);
          const clientInvs = invoices.filter((inv) => inv.clientId === invoicesClientId);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setInvoicesClientId(null);
              }}
            >
              <div className="w-full max-w-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-white">{client?.name}</h2>
                    <p className="text-sm text-white/45 mt-0.5">
                      {clientInvs.length} invoice{clientInvs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setInvoicesClientId(null)}
                    className="p-2.5 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {clientInvs.length === 0 ? (
                    <p className="text-sm text-white/35 text-center py-10">
                      No invoices for this client.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-800/90 border-b border-white/[0.08]">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-white/45">
                            Invoice #
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-white/45 hidden sm:table-cell">
                            Date
                          </th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-white/45">
                            Amount
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-white/45">
                            Status
                          </th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {clientInvs.map((inv, i) => {
                          const sub = calcSubtotal(inv);
                          const sc = STATUS_CONFIG[inv.status ?? 'draft'];
                          return (
                            <tr
                              key={inv.id}
                              className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                            >
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setPreviewInvId(inv.id)}
                                  className="font-semibold text-white hover:text-[#FFC206] transition text-left"
                                >
                                  {inv.number}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-white/50 hidden sm:table-cell">
                                {fmtDate(inv.date)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-white amt">
                                {fmt(sub)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}
                                >
                                  {sc.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <a
                                  href={`/invoices/${inv.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2.5 rounded-xl border border-white/15 text-white/50 hover:bg-white/10 hover:text-white transition inline-flex"
                                  title="PDF"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                    />
                                  </svg>
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {previewInvId &&
        (() => {
          const inv = invoices.find((i) => i.id === previewInvId) ?? null;
          const client = inv ? (clients.find((c) => c.id === inv.clientId) ?? null) : null;
          return (
            <InvoicePreviewModal inv={inv} client={client} onClose={() => setPreviewInvId(null)} />
          );
        })()}
    </>
  );
}
