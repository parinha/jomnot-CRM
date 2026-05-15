'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Client } from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useProjects } from '@/src/hooks/useProjects';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { calcEarned, calcSubtotal, calcBalance } from '@/src/lib/calculations';
import { fmtUSD, fmtDate } from '@/src/lib/formatters';
import { uid } from '@/src/lib/id';
import { PAGE_SIZE, STORAGE_KEYS } from '@/src/config/constants';
import { STATUS_CONFIG, PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import SearchInput from '@/src/components/SearchInput';
import Pagination from '@/src/components/Pagination';
import ModalShell from '@/src/components/ModalShell';
import InvoicePreviewModal from '@/src/components/InvoicePreviewModal';
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
  'h-11 rounded-xl border border-white/20 bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full';

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

  const [sortCol] = useState<CliSortCol>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem(STORAGE_KEYS.tableCliCol) as CliSortCol) ?? 'name')
      : 'name'
  );
  const [sortDir] = useState<'asc' | 'desc'>(() =>
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
  const [viewClientId, setViewClientId] = useState<string | null>(null);
  const [previewInvId, setPreviewInvId] = useState<string | null>(null);

  // Strip ?new=1 from URL after using it for initial state — no setState here
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      router.replace('/clients');
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
          <div className="flex flex-col gap-3">
            {pagedClients.map((client) => {
              const stats = statsMap.get(client.id);
              return (
                <button
                  key={client.id}
                  onClick={() => setViewClientId(client.id)}
                  className="w-full text-left bg-white/[0.05] border border-white/[0.09] rounded-2xl p-4 active:bg-white/[0.08] transition"
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
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(client);
                      }}
                      className="shrink-0 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
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
                    </span>
                  </div>
                  {stats?.count || stats?.earned || (stats?.remaining ?? 0) > 0 ? (
                    <div className="flex gap-2">
                      {stats?.count ? (
                        <div className="flex-1 bg-white/[0.06] rounded-xl p-2.5 text-center">
                          <p className="font-bold text-white text-sm">{stats.count}</p>
                          <p className="text-white/40 text-xs mt-0.5">Invoices</p>
                        </div>
                      ) : null}
                      {stats?.earned ? (
                        <div className="flex-1 bg-white/[0.06] rounded-xl p-2.5 text-center">
                          <p className="font-bold text-white text-sm amt">{fmt(stats.earned)}</p>
                          <p className="text-white/40 text-xs mt-0.5">Earned</p>
                        </div>
                      ) : null}
                      {(stats?.remaining ?? 0) > 0 ? (
                        <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
                          <p className="font-bold text-amber-400 text-sm amt">
                            {fmt(stats!.remaining)}
                          </p>
                          <p className="text-amber-400/60 text-xs mt-0.5">Owed</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
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

      {/* Client detail sheet */}
      {viewClientId &&
        (() => {
          const c = clients.find((cl) => cl.id === viewClientId);
          if (!c) return null;
          const clientInvs = invoices.filter((inv) => inv.clientId === c.id);
          const clientProjs = projects.filter((p) => p.clientId === c.id);
          const stats = statsMap.get(c.id);

          return (
            <ModalShell onClose={() => setViewClientId(null)}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white">{c.name}</h2>
                  {c.contactPerson && (
                    <p className="text-xs text-white/40 mt-0.5">{c.contactPerson}</p>
                  )}
                </div>
                <button
                  onClick={() => setViewClientId(null)}
                  className="p-1.5 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition shrink-0"
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

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                {/* Stats */}
                {stats?.count || stats?.earned || (stats?.remaining ?? 0) > 0 ? (
                  <div className="flex gap-2">
                    {stats?.count ? (
                      <div className="flex-1 bg-white/[0.06] rounded-xl p-2.5 text-center">
                        <p className="font-bold text-white text-sm">{stats.count}</p>
                        <p className="text-white/40 text-xs mt-0.5">Invoices</p>
                      </div>
                    ) : null}
                    {stats?.earned ? (
                      <div className="flex-1 bg-white/[0.06] rounded-xl p-2.5 text-center">
                        <p className="font-bold text-white text-sm amt">{fmt(stats.earned)}</p>
                        <p className="text-white/40 text-xs mt-0.5">Earned</p>
                      </div>
                    ) : null}
                    {(stats?.remaining ?? 0) > 0 ? (
                      <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
                        <p className="font-bold text-amber-400 text-sm amt">
                          {fmt(stats!.remaining)}
                        </p>
                        <p className="text-amber-400/60 text-xs mt-0.5">Owed</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Contact info */}
                {(c.phone || c.email || c.address || c.vat_tin || c.note) && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {c.phone && (
                      <div>
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">Phone</p>
                        <p className="text-white">{c.phone}</p>
                      </div>
                    )}
                    {c.email && (
                      <div>
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">Email</p>
                        <p className="text-white break-all">{c.email}</p>
                      </div>
                    )}
                    {c.vat_tin && (
                      <div>
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">VAT / TIN</p>
                        <p className="text-white">{c.vat_tin}</p>
                      </div>
                    )}
                    {c.address && (
                      <div className="col-span-2">
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">Address</p>
                        <p className="text-white">{c.address}</p>
                      </div>
                    )}
                    {c.note && (
                      <div className="col-span-2">
                        <p className="text-white/40 uppercase tracking-wider mb-0.5">Note</p>
                        <p className="text-white/60 whitespace-pre-wrap">{c.note}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Invoices */}
                <div>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Invoices
                  </p>
                  {clientInvs.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {clientInvs.map((inv) => {
                        const sc = STATUS_CONFIG[inv.status ?? 'draft'];
                        const sub = calcSubtotal(inv);
                        return (
                          <button
                            key={inv.id}
                            onClick={() => {
                              setViewClientId(null);
                              setPreviewInvId(inv.id);
                            }}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{inv.number}</p>
                              <p className="text-xs text-white/40">{fmtDate(inv.date)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white/70 amt">
                                {fmt(sub)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                              >
                                {sc.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 italic">No invoices for this client</p>
                  )}
                </div>

                {/* Projects */}
                <div>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Projects
                  </p>
                  {clientProjs.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {clientProjs.map((p) => {
                        const sc = PROJECT_STATUS_CONFIG[p.status] ?? {
                          label: 'Unknown',
                          cls: 'bg-zinc-700 text-zinc-300',
                        };
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08]"
                          >
                            <p className="text-sm text-white/80 truncate">{p.name}</p>
                            <span
                              className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                            >
                              {sc.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 italic">No projects for this client</p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/[0.08] shrink-0 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setViewClientId(null);
                    openEdit(c);
                  }}
                  className="h-11 w-full flex items-center justify-center gap-2 rounded-xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition"
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
                  Edit Client
                </button>
                <button
                  onClick={() => {
                    setViewClientId(null);
                    setDeleteId(c.id);
                  }}
                  className="h-10 w-full flex items-center justify-center gap-2 rounded-xl border border-red-400/25 text-red-400/80 text-sm hover:bg-red-500/10 hover:text-red-400 transition"
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
                  Delete Client
                </button>
              </div>
            </ModalShell>
          );
        })()}

      {/* Add / Edit modal */}
      {modalOpen && (
        <ModalShell onClose={closeModal}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
            <h2 className="text-base font-bold text-white">
              {editingClient ? 'Edit client' : 'Add client'}
            </h2>
            <button
              onClick={closeModal}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
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
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4">
            {[
              { label: 'Company Name *', key: 'name', placeholder: 'ANYMIND CO., LTD' },
              { label: 'Contact Person', key: 'contactPerson', placeholder: 'Mr. Smith' },
              { label: 'Email', key: 'email', placeholder: 'billing@example.com' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
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
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Phone *
              </label>
              <div className="flex h-11 rounded-xl border border-white/20 bg-white/[0.06] focus-within:ring-2 focus-within:ring-[#FFC206] focus-within:border-transparent transition overflow-hidden">
                <span className="flex items-center px-3 text-sm font-medium text-white/40 border-r border-white/20 shrink-0 select-none">
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
                  className="flex-1 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {[
              { label: 'VAT TIN', key: 'vat_tin', placeholder: 'K008-100069509' },
              { label: 'Address', key: 'address', placeholder: '123 Street, City, Country' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
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
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
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
          {formError && <p className="px-5 pb-2 text-sm text-red-400 shrink-0">{formError}</p>}
          <div className="flex gap-3 px-5 py-4 border-t border-white/[0.08] shrink-0">
            <button
              onClick={closeModal}
              className="flex-1 h-11 rounded-xl border border-white/20 text-sm font-medium text-white/70 hover:bg-white/10 transition"
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

      {/* Invoice preview */}
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
