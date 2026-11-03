'use client';

import {
  Buildings,
  ClipboardText,
  FileText,
  ImageSquare,
  PlugsConnected,
  QrCode,
  SignOut,
  Signature,
  SlidersHorizontal,
  TelegramLogo,
} from '@phosphor-icons/react';
import { useState, useRef, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/AuthProvider';
import type {
  CompanyProfile,
  InvoicingSettings,
  PaymentInfo,
  PaymentMethod,
  QuotationSettings,
} from '@/src/types';
import { uid } from '@/src/lib/id';
import {
  useCompanyProfile,
  usePaymentInfo,
  usePaymentMethods,
  useInvoicingSettings,
  useScopeOfWork,
  useQuotationSettings,
  useSettingsMutations,
} from '@/src/hooks/useSettings';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';

const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  logo: '',
  address: '',
  phone: '',
  website: '',
  signatoryName: '',
  signatorySignature: '',
};
const EMPTY_PAYMENT: PaymentInfo = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  swiftCode: '',
  currency: '',
  qrImage: '',
};

type Tab = 'company' | 'invoicing' | 'quotations' | 'workspace' | 'integrations';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'company',
    label: 'Company',
    icon: <Buildings className="w-5 h-5" weight="duotone" aria-hidden />,
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    icon: <FileText className="w-5 h-5" weight="duotone" aria-hidden />,
  },
  {
    id: 'quotations',
    label: 'Quotations',
    icon: <ClipboardText className="w-5 h-5" weight="duotone" aria-hidden />,
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: <SlidersHorizontal className="w-5 h-5" weight="duotone" aria-hidden />,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <PlugsConnected className="w-5 h-5" weight="duotone" aria-hidden />,
  },
];

export default function SettingsScreen() {
  const { data: companyProfile, isLoading: loadingProfile } = useCompanyProfile();
  const { data: paymentInfo, isLoading: loadingPayment } = usePaymentInfo();
  const { data: paymentMethods } = usePaymentMethods();
  const { data: invoicingSettings, isLoading: loadingInvoicing } = useInvoicingSettings();
  const { data: scopeOfWork } = useScopeOfWork();
  const { data: quotationSettings } = useQuotationSettings();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;

  if (loadingProfile || loadingPayment || loadingInvoicing) return <TablePageSkeleton rows={8} />;

  return (
    <SettingsForm
      companyProfile={companyProfile ?? EMPTY_PROFILE}
      paymentInfo={paymentInfo ?? EMPTY_PAYMENT}
      paymentMethods={paymentMethods}
      invoicingSettings={invoicingSettings}
      scopeOfWork={scopeOfWork ?? []}
      quotationSettings={quotationSettings}
      initialTab={tabParam ?? 'company'}
    />
  );
}

function SettingsForm({
  companyProfile,
  paymentInfo,
  paymentMethods: initialPaymentMethods,
  invoicingSettings,
  scopeOfWork,
  quotationSettings,
  initialTab,
}: {
  companyProfile: CompanyProfile;
  paymentInfo: PaymentInfo;
  paymentMethods: PaymentMethod[];
  invoicingSettings: InvoicingSettings;
  scopeOfWork: string[];
  quotationSettings: QuotationSettings;
  initialTab: Tab;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const router = useRouter();
  const { signOut } = useAuth();

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  }

  const [isPending, startTransition] = useTransition();
  const {
    saveCompanyProfile,
    savePaymentInfo,
    saveScopeOfWork,
    saveInvoicingSettings,
    savePaymentMethods,
    saveQuotationSettings,
  } = useSettingsMutations();
  const [qs, setQsLocal] = useState<QuotationSettings>(quotationSettings);
  const [savedQuotation, setSavedQuotation] = useState(false);

  function setQs<K extends keyof QuotationSettings>(k: K, v: QuotationSettings[K]) {
    setQsLocal((prev) => ({ ...prev, [k]: v }));
    setSavedQuotation(false);
  }

  function handleSaveQuotation() {
    startTransition(async () => {
      await saveQuotationSettings(qs);
      setSavedQuotation(true);
      setTimeout(() => setSavedQuotation(false), 2000);
    });
  }
  const [profile, setProfileLocal] = useState<CompanyProfile>(companyProfile);
  const [payment, setPaymentLocal] = useState<PaymentInfo>(paymentInfo);
  const [inv, setInvLocal] = useState<InvoicingSettings>(invoicingSettings);
  const [paymentMethods, setPaymentMethodsLocal] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [pmEditingId, setPmEditingId] = useState<string | null>(null);
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [pmForm, setPmForm] = useState<Omit<PaymentMethod, 'id' | 'isDefault'>>({
    label: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    swiftCode: '',
    currency: '',
    qrImage: '',
  });

  const [savedProfile, setSavedProfile] = useState(false);
  const [savedInvoicing, setSavedInvoicing] = useState(false);
  const [savedTelegram, setSavedTelegram] = useState(false);

  function setInv<K extends keyof InvoicingSettings>(k: K, v: InvoicingSettings[K]) {
    setInvLocal((prev) => ({ ...prev, [k]: v }));
    setSavedInvoicing(false);
  }

  function handleSaveInvoicing() {
    startTransition(async () => {
      await saveInvoicingSettings(inv);
      setSavedInvoicing(true);
      setTimeout(() => setSavedInvoicing(false), 2000);
    });
  }

  const logoInputRef = useRef<HTMLInputElement>(null);

  function setP<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setProfileLocal((prev) => ({ ...prev, [k]: v }));
    setSavedProfile(false);
  }
  function setPay<K extends keyof PaymentInfo>(k: K, v: PaymentInfo[K]) {
    setPaymentLocal((prev) => ({ ...prev, [k]: v }));
    setSavedTelegram(false);
  }

  function handleImageUpload(file: File, onResult: (b64: string) => void) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const r = e.target?.result;
      if (typeof r === 'string') onResult(r);
    };
    reader.readAsDataURL(file);
  }

  function handleSaveProfile() {
    startTransition(async () => {
      await saveCompanyProfile(profile);
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    });
  }

  function handleSaveTelegram() {
    startTransition(async () => {
      await savePaymentInfo(payment);
      setSavedTelegram(true);
      setTimeout(() => setSavedTelegram(false), 2000);
    });
  }

  const pmInputRef = useRef<HTMLInputElement>(null);

  function openAddPm() {
    setPmEditingId(null);
    setPmForm({
      label: '',
      bankName: '',
      accountName: '',
      accountNumber: '',
      swiftCode: '',
      currency: '',
      qrImage: '',
    });
    setPmModalOpen(true);
  }

  function openEditPm(m: PaymentMethod) {
    setPmEditingId(m.id);
    setPmForm({
      label: m.label,
      bankName: m.bankName,
      accountName: m.accountName,
      accountNumber: m.accountNumber,
      swiftCode: m.swiftCode,
      currency: m.currency,
      qrImage: m.qrImage,
    });
    setPmModalOpen(true);
  }

  function handleSavePm() {
    startTransition(async () => {
      let updated: PaymentMethod[];
      if (pmEditingId) {
        updated = paymentMethods.map((m) => (m.id === pmEditingId ? { ...m, ...pmForm } : m));
      } else {
        const isFirst = paymentMethods.length === 0;
        updated = [...paymentMethods, { id: uid(), ...pmForm, isDefault: isFirst }];
      }
      await savePaymentMethods(updated);
      setPaymentMethodsLocal(updated);
      setPmModalOpen(false);
    });
  }

  function handleDeletePm(id: string) {
    startTransition(async () => {
      let updated = paymentMethods.filter((m) => m.id !== id);
      if (updated.length > 0 && !updated.some((m) => m.isDefault)) {
        updated = updated.map((m, i) => ({ ...m, isDefault: i === 0 }));
      }
      await savePaymentMethods(updated);
      setPaymentMethodsLocal(updated);
    });
  }

  function handleSetDefaultPm(id: string) {
    startTransition(async () => {
      const updated = paymentMethods.map((m) => ({ ...m, isDefault: m.id === id }));
      await savePaymentMethods(updated);
      setPaymentMethodsLocal(updated);
    });
  }

  const inputCls =
    'h-11 rounded-xl border border-line bg-subtle px-4 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand focus:bg-surface transition w-full';
  const labelCls = 'text-sm font-medium text-ink-2';
  const sectionCls = 'bg-surface shadow-card rounded-2xl p-5 md:p-6';
  const saveBtnCls =
    'h-11 px-6 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition shadow-brand disabled:opacity-60';
  const saveRowCls = 'flex items-center justify-end gap-3 mt-6 pt-5 border-t border-line';

  return (
    // Phones: stacked, tabs scroll sideways. iPad+: sticky side menu + content column.
    <div className="w-full flex flex-col gap-5 md:grid md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] md:gap-x-8 md:gap-y-6 md:items-start">
      {/* Header */}
      <div className="md:col-span-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-muted mt-0.5">
          Manage your company info, invoice defaults, and workspace preferences
        </p>
      </div>

      {/* Tab bar / side menu */}
      <nav className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:p-2 md:flex-col md:gap-1 md:sticky md:top-0 md:bg-surface md:shadow-card md:rounded-2xl">
        {TABS.map((tab) => {
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`shrink-0 flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold transition md:w-full md:h-11 md:rounded-xl md:px-3 ${
                on
                  ? 'bg-brand text-white shadow-brand md:bg-brand-soft md:text-brand-ink md:shadow-none'
                  : 'bg-surface text-ink-2 shadow-card hover:bg-subtle md:bg-transparent md:shadow-none md:text-muted md:hover:text-ink'
              }`}
            >
              <span className={on ? 'md:text-brand' : ''}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-6 min-w-0 max-w-3xl">
        {/* ── Company tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'company' && (
          <section className={sectionCls}>
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-base font-semibold text-ink">Company Profile</h2>
              <p className="text-xs text-muted">Appears in the header of every invoice.</p>
            </div>
            <div className="flex flex-col gap-5">
              {/* Logo */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Logo</label>
                <div className="flex items-center gap-4">
                  {profile.logo ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.logo}
                        alt="Logo"
                        className="h-14 max-w-[160px] object-contain rounded-xl border border-line-strong bg-surface p-1"
                      />
                      <button
                        onClick={() => setP('logo', '')}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-line-strong text-ink text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-14 w-28 rounded-xl border-2 border-dashed border-line-strong bg-surface flex items-center justify-center">
                      <ImageSquare className="w-5 h-5 text-faint" weight="duotone" aria-hidden />
                    </div>
                  )}
                  <div>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="h-10 px-4 rounded-full border border-line-strong text-sm text-ink-2 hover:bg-black/[0.04] hover:text-ink transition"
                    >
                      {profile.logo ? 'Replace' : 'Upload logo'}
                    </button>
                    <p className="text-xs text-faint mt-1.5">PNG, JPG, SVG — invoice header</p>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, (b64) => setP('logo', b64));
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              </div>

              {[
                { label: 'Company Name', key: 'name', placeholder: 'Acme Studio Co., Ltd.' },
                { label: 'Phone', key: 'phone', placeholder: '+66 2 000 0000' },
                { label: 'Website', key: 'website', placeholder: 'www.yourstudio.com' },
                {
                  label: 'Authorized Signatory Name',
                  key: 'signatoryName',
                  placeholder: 'Full Name',
                },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className={labelCls}>{label}</label>
                  <input
                    type="text"
                    value={(profile as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => setP(key as keyof CompanyProfile, e.target.value)}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Address</label>
                <textarea
                  value={profile.address}
                  onChange={(e) => setP('address', e.target.value)}
                  placeholder="123 Studio Street, Bangkok 10110"
                  rows={3}
                  className={`${inputCls} h-auto py-3 resize-none`}
                />
              </div>

              {/* Signature */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Signatory Signature</label>
                <div className="flex items-center gap-4">
                  {profile.signatorySignature ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.signatorySignature}
                        alt="Signature"
                        className="h-14 max-w-[180px] object-contain rounded-xl border border-line-strong bg-surface p-1"
                      />
                      <button
                        onClick={() => setP('signatorySignature', '')}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-line-strong text-ink text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-14 w-36 rounded-xl border-2 border-dashed border-line-strong bg-surface flex items-center justify-center">
                      <Signature className="w-5 h-5 text-faint" weight="duotone" aria-hidden />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="sig-upload"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, (b64) => setP('signatorySignature', b64));
                        e.target.value = '';
                      }}
                    />
                    <label
                      htmlFor="sig-upload"
                      className="cursor-pointer h-10 px-4 rounded-full border border-line-strong text-sm text-ink-2 hover:bg-black/[0.04] hover:text-ink transition inline-flex items-center"
                    >
                      {profile.signatorySignature ? 'Replace' : 'Upload signature'}
                    </label>
                    <p className="text-xs text-faint mt-1.5">Shown on printed invoices</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={saveRowCls}>
              {savedProfile && <span className="text-xs text-brand font-semibold">Saved ✓</span>}
              <button onClick={handleSaveProfile} disabled={isPending} className={saveBtnCls}>
                Save profile
              </button>
            </div>
          </section>
        )}

        {/* ── Invoicing tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'invoicing' && (
          <section className={sectionCls}>
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-base font-semibold text-ink">Invoicing</h2>
              <p className="text-xs text-muted">
                Payment details, currency, date format, and tax shown on invoices.
              </p>
            </div>
            <div className="flex flex-col gap-8">
              {/* Payment Methods */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <SectionDivider label="Payment Methods" />
                  <button
                    onClick={openAddPm}
                    className="h-8 px-3 rounded-xl bg-subtle border border-line-strong text-xs font-semibold text-ink hover:bg-black/[0.04] transition shrink-0"
                  >
                    + Add Method
                  </button>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="text-sm text-muted py-2">
                    No payment methods yet. Add one to show bank info on invoices.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {paymentMethods.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 p-4 rounded-xl bg-subtle">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-ink">
                              {m.label || 'Unnamed'}
                            </span>
                            {m.isDefault && (
                              <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-xs font-semibold">
                                Default
                              </span>
                            )}
                          </div>
                          {(m.bankName || m.accountNumber) && (
                            <p className="text-xs text-muted mt-0.5 truncate">
                              {[m.bankName, m.accountNumber].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!m.isDefault && (
                            <button
                              onClick={() => handleSetDefaultPm(m.id)}
                              className="h-7 px-2.5 rounded-lg border border-line-strong text-xs text-muted hover:text-ink hover:bg-black/[0.04] transition"
                            >
                              Set default
                            </button>
                          )}
                          <button
                            onClick={() => openEditPm(m)}
                            className="h-7 px-2.5 rounded-lg border border-line-strong text-xs text-muted hover:text-ink hover:bg-black/[0.04] transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePm(m.id)}
                            className="h-7 px-2.5 rounded-lg border border-red-200 text-xs text-red-600 hover:text-red-600 hover:bg-red-100 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment method add/edit modal */}
                {pmModalOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
                    onClick={() => setPmModalOpen(false)}
                  >
                    <div
                      className="w-full max-w-md bg-surface shadow-float rounded-3xl p-5 flex flex-col gap-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-ink">
                          {pmEditingId ? 'Edit Payment Method' : 'Add Payment Method'}
                        </h3>
                        <button
                          onClick={() => setPmModalOpen(false)}
                          className="text-muted hover:text-ink text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        {(
                          [
                            {
                              label: 'Label',
                              key: 'label',
                              placeholder: 'e.g. Bank Transfer, PayPal',
                            },
                            {
                              label: 'Bank Name',
                              key: 'bankName',
                              placeholder: 'Advanced Bank Of Asia Ltd.',
                            },
                            {
                              label: 'Account Name',
                              key: 'accountName',
                              placeholder: 'Your Company Name',
                            },
                            {
                              label: 'Account Number',
                              key: 'accountNumber',
                              placeholder: '000 000 000',
                            },
                            {
                              label: 'SWIFT / ABA Code',
                              key: 'swiftCode',
                              placeholder: 'ABAAKHPP',
                            },
                            {
                              label: 'Currency',
                              key: 'currency',
                              placeholder: 'United States Dollars',
                            },
                          ] as { label: string; key: keyof typeof pmForm; placeholder: string }[]
                        ).map(({ label, key, placeholder }) => (
                          <div key={key} className="flex flex-col gap-1">
                            <label className={labelCls}>{label}</label>
                            <input
                              type="text"
                              value={pmForm[key]}
                              onChange={(e) =>
                                setPmForm((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              placeholder={placeholder}
                              className={inputCls}
                            />
                          </div>
                        ))}

                        {/* QR Code */}
                        <div className="flex flex-col gap-1.5">
                          <label className={labelCls}>Payment QR Code</label>
                          <div className="flex items-center gap-3">
                            {pmForm.qrImage ? (
                              <div className="relative group shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={pmForm.qrImage}
                                  alt="QR"
                                  className="h-16 w-16 object-contain rounded-xl border border-line-strong bg-surface p-1"
                                />
                                <button
                                  onClick={() => setPmForm((p) => ({ ...p, qrImage: '' }))}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-line-strong text-ink text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-line-strong bg-surface flex items-center justify-center shrink-0">
                                <QrCode
                                  className="w-5 h-5 text-faint"
                                  weight="duotone"
                                  aria-hidden
                                />
                              </div>
                            )}
                            <div>
                              <button
                                onClick={() => pmInputRef.current?.click()}
                                className="h-9 px-3 rounded-full border border-line-strong text-xs text-ink-2 hover:bg-black/[0.04] hover:text-ink transition"
                              >
                                {pmForm.qrImage ? 'Replace QR' : 'Upload QR'}
                              </button>
                              <input
                                ref={pmInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f)
                                    handleImageUpload(f, (b64) =>
                                      setPmForm((p) => ({ ...p, qrImage: b64 }))
                                    );
                                  e.target.value = '';
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          onClick={() => setPmModalOpen(false)}
                          className="h-10 px-4 rounded-full border border-line-strong text-sm text-muted hover:bg-black/[0.04] transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSavePm}
                          disabled={isPending || !pmForm.label.trim()}
                          className={saveBtnCls}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Currency */}
              <div className="flex flex-col gap-3">
                <SectionDivider label="Currency" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Currency Code (ISO 4217)</label>
                    <input
                      type="text"
                      value={inv.currencyCode}
                      onChange={(e) =>
                        setInv('currencyCode', e.target.value.toUpperCase().slice(0, 3))
                      }
                      placeholder="USD"
                      maxLength={3}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Currency Symbol</label>
                    <input
                      type="text"
                      value={inv.currencySymbol}
                      onChange={(e) => setInv('currencySymbol', e.target.value.slice(0, 3))}
                      placeholder="$"
                      maxLength={3}
                      className={inputCls}
                    />
                  </div>
                </div>
                <p className="text-xs text-faint">
                  Common: USD ($) · EUR (€) · GBP (£) · THB (฿) · JPY (¥) · SGD (S$) · KHR (រ)
                </p>
              </div>

              {/* Date format */}
              <div className="flex flex-col gap-3">
                <SectionDivider label="Date Format" />
                <div className="grid grid-cols-2 gap-2">
                  {(['DD/Mon/YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const).map(
                    (fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setInv('dateFormat', fmt)}
                        className={`h-10 px-3 rounded-xl border text-sm font-medium transition text-left ${inv.dateFormat === fmt ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line-strong text-muted hover:bg-black/[0.04] hover:text-ink'}`}
                      >
                        {fmt}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Tax config */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <SectionDivider label="Tax Line" />
                  <button
                    type="button"
                    onClick={() => setInv('taxEnabled', !inv.taxEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${inv.taxEnabled ? 'bg-brand' : 'bg-line'}`}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: inv.taxEnabled ? '22px' : '2px' }}
                    />
                  </button>
                </div>
                {inv.taxEnabled && (
                  <div className="flex flex-col gap-3 rounded-xl bg-subtle p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Tax Label</label>
                        <input
                          type="text"
                          value={inv.taxLabel}
                          onChange={(e) => setInv('taxLabel', e.target.value)}
                          placeholder="VAT"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Rate (%)</label>
                        <input
                          type="number"
                          value={inv.taxRate}
                          onChange={(e) => setInv('taxRate', parseFloat(e.target.value) || 0)}
                          min={0}
                          max={100}
                          step={0.1}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Tax Type</label>
                      <div className="flex gap-2">
                        {(['additive', 'deductive'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setInv('taxType', t)}
                            className={`flex-1 h-10 rounded-full border text-sm font-medium transition ${inv.taxType === t ? 'border-brand/40 bg-brand-soft text-brand' : 'border-line-strong text-muted hover:bg-black/[0.04] hover:text-ink'}`}
                          >
                            {t === 'additive' ? 'Additive (VAT / GST)' : 'Deductive (WHT)'}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-faint">
                        {inv.taxType === 'additive'
                          ? 'Tax is added on top of the subtotal (e.g. VAT, GST).'
                          : 'Tax is withheld from the payment (e.g. WHT).'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={saveRowCls}>
              {savedInvoicing && <span className="text-xs text-brand font-semibold">Saved ✓</span>}
              <button onClick={handleSaveInvoicing} disabled={isPending} className={saveBtnCls}>
                Save invoicing settings
              </button>
            </div>
          </section>
        )}

        {/* ── Quotations tab ───────────────────────────────────────────────────── */}
        {activeTab === 'quotations' && (
          <section className={sectionCls}>
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-base font-semibold text-ink">Quotation Defaults</h2>
              <p className="text-xs text-muted">
                Every new quotation starts with these. You can still change them per quote.
              </p>
            </div>
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls} htmlFor="qs-valid">
                    Valid for (days)
                  </label>
                  <input
                    id="qs-valid"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={qs.validDays || ''}
                    onChange={(e) => setQs('validDays', parseInt(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls} htmlFor="qs-deposit">
                    Deposit to start (%)
                  </label>
                  <input
                    id="qs-deposit"
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={qs.depositPercent}
                    onChange={(e) =>
                      setQs(
                        'depositPercent',
                        Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                      )
                    }
                    className={inputCls}
                  />
                  <p className="text-xs text-faint">Set 0 for no deposit.</p>
                </div>
              </div>
              {(
                [
                  {
                    key: 'intro',
                    label: 'Intro message',
                    rows: 6,
                    hint: 'Use {contact}, {client}, {project}, {company}. Leave a blank line for a new paragraph.',
                  },
                  {
                    key: 'terms',
                    label: 'Terms & conditions',
                    rows: 5,
                    hint: 'One term per line.',
                  },
                  {
                    key: 'usageRights',
                    label: 'Usage rights',
                    rows: 5,
                    hint: 'Wrap words in **double stars** to make them bold.',
                  },
                  {
                    key: 'gear',
                    label: 'Equipment & gear',
                    rows: 5,
                    hint: 'One item per line, shown exactly as typed. Leave empty if you list gear per quote.',
                  },
                ] as const
              ).map(({ key, label, rows, hint }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className={labelCls} htmlFor={`qs-${key}`}>
                    {label}
                  </label>
                  <textarea
                    id={`qs-${key}`}
                    rows={rows}
                    value={qs[key]}
                    onChange={(e) => setQs(key, e.target.value)}
                    className={`${inputCls} h-auto py-2.5 leading-relaxed resize-y`}
                  />
                  <p className="text-xs text-faint">{hint}</p>
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls} htmlFor="qs-taxnote">
                  Note when no tax is added
                </label>
                <input
                  id="qs-taxnote"
                  value={qs.taxNote}
                  onChange={(e) => setQs('taxNote', e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-faint">
                  Shown under the total when a quote has no VAT or WHT.
                </p>
              </div>
            </div>
            <div className={saveRowCls}>
              {savedQuotation && <span className="text-xs text-brand font-semibold">Saved ✓</span>}
              <button onClick={handleSaveQuotation} disabled={isPending} className={saveBtnCls}>
                Save quotation defaults
              </button>
            </div>
          </section>
        )}

        {/* ── Workspace tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'workspace' && (
          <div className="flex flex-col gap-6">
            {/* Scope of Work */}
            <section className={sectionCls}>
              <div className="flex flex-col gap-1 mb-6">
                <h2 className="text-base font-semibold text-ink">Scope of Work Suggestions</h2>
                <p className="text-xs text-muted">
                  Autocomplete suggestions when adding line items to invoices.
                </p>
              </div>
              <ScopeList
                scopes={scopeOfWork}
                onChange={(newScopes) => {
                  startTransition(async () => {
                    await saveScopeOfWork(newScopes);
                  });
                }}
              />
            </section>
          </div>
        )}

        {/* ── Integrations tab ──────────────────────────────────────────────────── */}
        {activeTab === 'integrations' && (
          <div className="flex flex-col gap-6">
            {/* Telegram Bot */}
            <section className={sectionCls}>
              <div className="flex items-start gap-3 mb-6">
                <div className="w-9 h-9 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
                  <TelegramLogo className="w-4 h-4 text-sky-600" weight="duotone" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-ink">Telegram Bot</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Send invoices, quotations and receipts to Telegram. Create a bot via @BotFather
                    and add it to your group.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {/* Bot token */}
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Bot Token</label>
                  <input
                    type="text"
                    value={payment.telegramBotToken ?? ''}
                    onChange={(e) => setPay('telegramBotToken', e.target.value)}
                    placeholder="123456:ABCdef..."
                    className={inputCls}
                  />
                  <p className="text-xs text-faint">
                    Shared across all Telegram destinations below.
                  </p>
                </div>

                {/* Invoices group */}
                <div className="rounded-xl bg-subtle p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <p className="text-sm font-semibold text-ink">Invoices</p>
                  </div>
                  {[
                    {
                      label: 'Chat ID',
                      key: 'telegramChatId',
                      placeholder: '-1001234567890 or @username',
                    },
                    {
                      label: 'Topic ID (optional)',
                      key: 'telegramTopicId',
                      placeholder: 'Leave blank if not using topics',
                    },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className={labelCls}>{label}</label>
                      <input
                        type="text"
                        value={(payment as unknown as Record<string, string>)[key] ?? ''}
                        onChange={(e) => setPay(key as keyof PaymentInfo, e.target.value)}
                        placeholder={placeholder}
                        className={inputCls}
                      />
                    </div>
                  ))}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className={labelCls}>Preview</label>
                      <span className="text-[10px] text-faint italic">sample message</span>
                    </div>
                    <pre className="text-xs text-muted font-mono leading-relaxed bg-subtle rounded-xl p-4 overflow-x-auto whitespace-pre">{`📄 INV-0042\n📅 Date: 20 Apr 2026\n👤 Client: Jane Smith\n\n📎 PDF attached`}</pre>
                  </div>
                </div>

                {/* Quotations group */}
                <div className="rounded-xl bg-subtle p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                    <p className="text-sm font-semibold text-ink">Quotations</p>
                  </div>
                  <p className="text-xs text-muted -mt-2">
                    To post quotes in another topic of the same group, fill in only the Topic ID.
                    Leave both blank to use the invoice chat and topic.
                  </p>
                  {[
                    {
                      label: 'Chat ID (optional)',
                      key: 'telegramQuoteChatId',
                      placeholder: 'Same as invoices',
                    },
                    {
                      label: 'Topic ID (optional)',
                      key: 'telegramQuoteTopicId',
                      placeholder: 'e.g. 42',
                    },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className={labelCls}>{label}</label>
                      <input
                        type="text"
                        value={(payment as unknown as Record<string, string>)[key] ?? ''}
                        onChange={(e) => setPay(key as keyof PaymentInfo, e.target.value)}
                        placeholder={placeholder}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>

                {/* Receipts group */}
                <div className="rounded-xl bg-subtle p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <p className="text-sm font-semibold text-ink">Receipts</p>
                  </div>
                  <p className="text-xs text-muted -mt-2">
                    To post receipts in another topic of the same group, fill in only the Topic ID.
                    Leave both blank to use the invoice chat and topic.
                  </p>
                  {[
                    {
                      label: 'Chat ID (optional)',
                      key: 'telegramReceiptChatId',
                      placeholder: 'Same as invoices',
                    },
                    {
                      label: 'Topic ID (optional)',
                      key: 'telegramReceiptTopicId',
                      placeholder: 'e.g. 42',
                    },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className={labelCls}>{label}</label>
                      <input
                        type="text"
                        value={(payment as unknown as Record<string, string>)[key] ?? ''}
                        onChange={(e) => setPay(key as keyof PaymentInfo, e.target.value)}
                        placeholder={placeholder}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className={saveRowCls}>
                {savedTelegram && <span className="text-xs text-brand font-semibold">Saved ✓</span>}
                <button onClick={handleSaveTelegram} disabled={isPending} className={saveBtnCls}>
                  Save Telegram settings
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Sign out */}
        <div className="pb-4">
          <button
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
            className="flex items-center gap-3 px-4 h-14 rounded-2xl bg-surface shadow-card text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 transition w-full"
          >
            <span className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <SignOut className="w-5 h-5" weight="duotone" aria-hidden />
            </span>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-sm font-semibold text-ink shrink-0">{label}</p>
      <div className="flex-1 h-px bg-subtle" />
    </div>
  );
}

// ── Scope list ────────────────────────────────────────────────────────────────

function ScopeList({ scopes, onChange }: { scopes: string[]; onChange: (s: string[]) => void }) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newValue, setNewValue] = useState('');

  const inputCls =
    'h-11 rounded-xl border border-line bg-subtle px-4 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand focus:bg-surface transition';

  function startEdit(i: number) {
    setEditingIdx(i);
    setEditValue(scopes[i]);
  }
  function commitEdit(i: number) {
    if (!editValue.trim()) {
      setEditingIdx(null);
      return;
    }
    onChange(scopes.map((s, idx) => (idx === i ? editValue.trim() : s)));
    setEditingIdx(null);
  }
  function deleteScope(i: number) {
    onChange(scopes.filter((_, idx) => idx !== i));
  }
  function addScope() {
    if (!newValue.trim()) return;
    onChange([...scopes, newValue.trim()]);
    setNewValue('');
  }

  return (
    <div className="flex flex-col gap-2">
      {scopes.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          {editingIdx === i ? (
            <>
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(i);
                  if (e.key === 'Escape') setEditingIdx(null);
                }}
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={() => commitEdit(i)}
                className="h-11 px-4 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition shrink-0"
              >
                Save
              </button>
              <button
                onClick={() => setEditingIdx(null)}
                className="h-11 px-4 rounded-full border border-line-strong text-sm text-ink-2 hover:bg-black/[0.04] transition shrink-0"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-ink-2 py-3 px-4 bg-subtle rounded-xl border border-line truncate">
                {s}
              </span>
              <button
                onClick={() => startEdit(i)}
                className="h-11 px-4 rounded-full border border-line-strong text-xs font-semibold text-muted hover:bg-black/[0.04] hover:text-ink transition shrink-0"
              >
                Edit
              </button>
              <button
                onClick={() => deleteScope(i)}
                className="h-11 px-4 rounded-full border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-100 transition shrink-0"
              >
                Delete
              </button>
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 mt-2 pt-4 border-t border-line">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addScope();
          }}
          placeholder="Add scope item…"
          className={`${inputCls} flex-1`}
        />
        <button
          onClick={addScope}
          disabled={!newValue.trim()}
          className="h-11 px-4 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition shrink-0 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
