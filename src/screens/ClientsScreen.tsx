'use client';

import {
  EnvelopeSimple,
  MagnifyingGlass,
  PencilSimple,
  Phone,
  Plus,
  Trash,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Client } from '@/src/types';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import { calcEarned, calcSubtotal, calcBalance } from '@/src/lib/calculations';
import { fmtUSD, fmtDate } from '@/src/lib/formatters';
import { uid } from '@/src/lib/id';
import { PAGE_SIZE, STORAGE_KEYS } from '@/src/config/constants';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import SearchInput from '@/src/components/SearchInput';
import Pagination from '@/src/components/Pagination';
import { PageHeader, EmptyCard } from '@/src/components/PageHeader';
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

const inputCls =
  'h-11 rounded-xl border border-line bg-subtle px-4 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand focus:bg-surface transition w-full';

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
      // Latest invoice date (YYYY-MM-DD strings sort correctly as text)
      const lastDate = ci.reduce((max, inv) => (inv.date > max ? inv.date : max), '');
      return [c.id, { count: ci.length, earned, remaining, lastDate }];
    })
  );

  // Most recently invoiced clients first; clients with no invoices last, A–Z
  const sortedClients = [...filteredClients].sort((a, b) => {
    const da = statsMap.get(a.id)?.lastDate ?? '';
    const db = statsMap.get(b.id)?.lastDate ?? '';
    if (da !== db) return db.localeCompare(da);
    return a.name.localeCompare(b.name);
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
      <PageHeader
        title="Clients"
        sub={`${clients.length} total`}
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 h-11 px-5 rounded-full bg-brand text-on-brand text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark transition shadow-brand"
          >
            <Plus className="w-4 h-4" weight="bold" aria-hidden />
            Add client
          </button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, phone, address…"
        className="mb-5 md:max-w-md"
      />

      {/* Empty states */}
      {clients.length === 0 ? (
        <EmptyCard
          icon={<UsersThree className="w-9 h-9 text-brand-ink" weight="duotone" aria-hidden />}
          title="No clients yet"
          text="Add your first client to start invoicing."
          action={
            <button
              onClick={openAdd}
              className="mt-4 h-11 px-5 rounded-full bg-brand text-on-brand text-sm font-semibold hover:bg-brand-hover transition"
            >
              Add client
            </button>
          }
        />
      ) : sortedClients.length === 0 ? (
        <EmptyCard
          icon={<MagnifyingGlass className="w-9 h-9 text-brand-ink" weight="duotone" aria-hidden />}
          title="Nothing found"
          text="No clients match your search."
          action={
            <button
              onClick={() => setSearch('')}
              className="mt-3 text-sm font-semibold text-brand-ink hover:underline"
            >
              Clear search
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 md:gap-4">
          {pagedClients.map((client) => {
            const stats = statsMap.get(client.id);
            const owed = stats?.remaining ?? 0;
            return (
              <article
                key={client.id}
                className="relative bg-surface rounded-2xl shadow-card hover:shadow-float transition-shadow flex flex-col"
              >
                <button
                  onClick={() => setViewClientId(client.id)}
                  className="flex-1 text-left p-4 pr-14 flex items-start gap-3 rounded-t-2xl active:bg-subtle transition"
                >
                  <span className="w-12 h-12 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center text-lg font-semibold shrink-0">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{client.name}</p>
                    {client.contactPerson && (
                      <p className="text-sm text-muted truncate">{client.contactPerson}</p>
                    )}
                    {(client.phone || client.email) && (
                      <p className="text-xs text-faint mt-1.5 flex items-center gap-1 min-w-0">
                        {client.phone ? (
                          <Phone className="w-3.5 h-3.5 shrink-0" weight="duotone" aria-hidden />
                        ) : (
                          <EnvelopeSimple
                            className="w-3.5 h-3.5 shrink-0"
                            weight="duotone"
                            aria-hidden
                          />
                        )}
                        <span className="truncate">{client.phone || client.email}</span>
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => openEdit(client)}
                  aria-label={`Edit ${client.name}`}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-subtle hover:text-ink transition"
                >
                  <PencilSimple className="w-4 h-4" weight="duotone" aria-hidden />
                </button>

                {/* Stats footer */}
                <div className="grid grid-cols-3 border-t border-line text-center">
                  <div className="py-2.5 px-1">
                    <p className="text-sm font-semibold text-ink">{stats?.count ?? 0}</p>
                    <p className="text-[11px] text-muted">Invoices</p>
                  </div>
                  <div className="py-2.5 px-1 border-x border-line min-w-0">
                    <p className="text-sm font-semibold text-brand-ink truncate amt">
                      {fmt(stats?.earned ?? 0)}
                    </p>
                    <p className="text-[11px] text-muted">Earned</p>
                  </div>
                  <div className="py-2.5 px-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate amt ${owed > 0 ? 'text-amber-600' : 'text-faint'}`}
                    >
                      {owed > 0 ? fmt(owed) : '—'}
                    </p>
                    <p className="text-[11px] text-muted">Owed</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
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
          const stats = statsMap.get(c.id);

          return (
            <ModalShell onClose={() => setViewClientId(null)}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-line shrink-0">
                <div>
                  <h2 className="text-base font-bold text-ink">{c.name}</h2>
                  {c.contactPerson && (
                    <p className="text-xs text-muted mt-0.5">{c.contactPerson}</p>
                  )}
                </div>
                <button
                  onClick={() => setViewClientId(null)}
                  className="p-1.5 rounded-xl text-muted hover:bg-black/[0.04] hover:text-ink transition shrink-0"
                >
                  <X className="w-5 h-5" weight="bold" aria-hidden />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                {/* Stats */}
                {stats?.count || stats?.earned || (stats?.remaining ?? 0) > 0 ? (
                  <div className="flex gap-2">
                    {stats?.count ? (
                      <div className="flex-1 bg-subtle rounded-xl p-2.5 text-center">
                        <p className="font-bold text-ink text-sm">{stats.count}</p>
                        <p className="text-muted text-xs mt-0.5">Invoices</p>
                      </div>
                    ) : null}
                    {stats?.earned ? (
                      <div className="flex-1 bg-subtle rounded-xl p-2.5 text-center">
                        <p className="font-bold text-ink text-sm amt">{fmt(stats.earned)}</p>
                        <p className="text-muted text-xs mt-0.5">Earned</p>
                      </div>
                    ) : null}
                    {(stats?.remaining ?? 0) > 0 ? (
                      <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                        <p className="font-bold text-amber-600 text-sm amt">
                          {fmt(stats!.remaining)}
                        </p>
                        <p className="text-amber-600 text-xs mt-0.5">Owed</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Contact info */}
                {(c.phone || c.email || c.address || c.vat_tin || c.note) && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {c.phone && (
                      <div>
                        <p className="text-muted mb-0.5">Phone</p>
                        <p className="text-ink">{c.phone}</p>
                      </div>
                    )}
                    {c.email && (
                      <div>
                        <p className="text-muted mb-0.5">Email</p>
                        <p className="text-ink break-all">{c.email}</p>
                      </div>
                    )}
                    {c.vat_tin && (
                      <div>
                        <p className="text-muted mb-0.5">VAT / TIN</p>
                        <p className="text-ink">{c.vat_tin}</p>
                      </div>
                    )}
                    {c.address && (
                      <div className="col-span-2">
                        <p className="text-muted mb-0.5">Address</p>
                        <p className="text-ink">{c.address}</p>
                      </div>
                    )}
                    {c.note && (
                      <div className="col-span-2">
                        <p className="text-muted mb-0.5">Note</p>
                        <p className="text-muted whitespace-pre-wrap">{c.note}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Invoices */}
                <div>
                  <p className="text-sm font-semibold text-ink mb-2">Invoices</p>
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
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-subtle hover:bg-black/[0.04] transition text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">{inv.number}</p>
                              {inv.projectName && (
                                <p className="text-xs text-muted truncate">{inv.projectName}</p>
                              )}
                              <p className="text-xs text-muted">{fmtDate(inv.date)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-ink-2 amt">
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
                    <p className="text-xs text-faint italic">No invoices for this client</p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-line shrink-0 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setViewClientId(null);
                    openEdit(c);
                  }}
                  className="h-11 w-full flex items-center justify-center gap-2 rounded-full border border-line-strong text-ink-2 text-sm font-medium hover:bg-black/[0.04] transition"
                >
                  <PencilSimple className="w-4 h-4" weight="duotone" aria-hidden />
                  Edit Client
                </button>
                <button
                  onClick={() => {
                    setViewClientId(null);
                    setDeleteId(c.id);
                  }}
                  className="h-10 w-full flex items-center justify-center gap-2 rounded-full border border-red-200 text-red-600 text-sm hover:bg-red-100 hover:text-red-600 transition"
                >
                  <Trash className="w-4 h-4" weight="duotone" aria-hidden />
                  Delete Client
                </button>
              </div>
            </ModalShell>
          );
        })()}

      {/* Add / Edit modal */}
      {modalOpen && (
        <ModalShell onClose={closeModal}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
            <h2 className="text-base font-bold text-ink">
              {editingClient ? 'Edit client' : 'Add client'}
            </h2>
            <button
              onClick={closeModal}
              className="p-2 rounded-xl text-muted hover:text-ink hover:bg-black/[0.04] transition"
            >
              <X className="w-5 h-5" weight="bold" aria-hidden />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4">
            {[
              { label: 'Company Name *', key: 'name', placeholder: 'ANYMIND CO., LTD' },
              { label: 'Contact Person', key: 'contactPerson', placeholder: 'Mr. Smith' },
              { label: 'Email', key: 'email', placeholder: 'billing@example.com' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-2">{label}</label>
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
              <label className="text-sm font-medium text-ink-2">Phone *</label>
              <div className="flex h-11 rounded-xl border border-line bg-subtle focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand focus-within:bg-surface transition overflow-hidden">
                <span className="flex items-center px-3 text-sm font-medium text-muted border-r border-line-strong shrink-0 select-none">
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
                  className="flex-1 px-3 text-sm text-ink placeholder:text-faint focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {[
              { label: 'VAT TIN', key: 'vat_tin', placeholder: 'K008-100069509' },
              { label: 'Address', key: 'address', placeholder: '123 Street, City, Country' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-2">{label}</label>
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
              <label className="text-sm font-medium text-ink-2">Note</label>
              <textarea
                value={form.note ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Internal notes…"
                rows={3}
                className={`${inputCls} h-auto py-3 resize-none`}
              />
            </div>
          </div>
          {formError && <p className="px-5 pb-2 text-sm text-red-600 shrink-0">{formError}</p>}
          <div className="flex gap-3 px-5 py-4 border-t border-line shrink-0">
            <button
              onClick={closeModal}
              className="flex-1 h-11 rounded-full border border-line-strong text-sm font-medium text-ink-2 hover:bg-black/[0.04] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 h-11 rounded-full bg-brand text-on-brand text-sm font-semibold hover:bg-brand-hover transition"
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
