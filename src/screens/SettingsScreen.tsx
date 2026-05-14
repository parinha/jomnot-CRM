'use client';

import { useState, useRef, useTransition, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/AuthProvider';
import { useSendProjectsTelegram } from '@/src/hooks/useTelegram';
import type {
  AppPreferences,
  CompanyProfile,
  InvoicingSettings,
  PaymentInfo,
  KanbanPhase,
  TelegramKanbanTemplate,
  Project,
} from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import { buildProjectsSummaryMessage } from '@/src/lib/telegram-messages';
import { uid } from '@/src/lib/id';
import {
  useCompanyProfile,
  usePaymentInfo,
  useInvoicingSettings,
  useScopeOfWork,
  useAppPreferences,
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

type Tab = 'company' | 'invoicing' | 'workspace' | 'integrations';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'company',
    label: 'Company',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
        />
      </svg>
    ),
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
        />
      </svg>
    ),
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
        />
      </svg>
    ),
  },
];

export default function SettingsScreen() {
  const { data: companyProfile, isLoading: loadingProfile } = useCompanyProfile();
  const { data: paymentInfo, isLoading: loadingPayment } = usePaymentInfo();
  const { data: invoicingSettings, isLoading: loadingInvoicing } = useInvoicingSettings();
  const { data: scopeOfWork } = useScopeOfWork();
  const { data: appPreferences } = useAppPreferences();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;

  if (loadingProfile || loadingPayment || loadingInvoicing) return <TablePageSkeleton rows={8} />;

  return (
    <SettingsForm
      companyProfile={companyProfile ?? EMPTY_PROFILE}
      paymentInfo={paymentInfo ?? EMPTY_PAYMENT}
      invoicingSettings={invoicingSettings}
      scopeOfWork={scopeOfWork ?? []}
      appPreferences={appPreferences}
      initialTab={tabParam ?? 'company'}
    />
  );
}

function SettingsForm({
  companyProfile,
  paymentInfo,
  invoicingSettings,
  scopeOfWork,
  appPreferences,
  initialTab,
}: {
  companyProfile: CompanyProfile;
  paymentInfo: PaymentInfo;
  invoicingSettings: InvoicingSettings;
  scopeOfWork: string[];
  appPreferences: AppPreferences;
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
    saveAppPreferences,
    saveInvoicingSettings,
  } = useSettingsMutations();
  const [profile, setProfileLocal] = useState<CompanyProfile>(companyProfile);
  const [payment, setPaymentLocal] = useState<PaymentInfo>(paymentInfo);
  const [inv, setInvLocal] = useState<InvoicingSettings>(invoicingSettings);

  const [savedProfile, setSavedProfile] = useState(false);
  const [savedPayment, setSavedPayment] = useState(false);
  const [savedInvoicing, setSavedInvoicing] = useState(false);
  const [savedTelegram, setSavedTelegram] = useState(false);
  const [savedKanban, setSavedKanban] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [prefs, setPrefsLocal] = useState<AppPreferences>(appPreferences);

  function setPref<K extends keyof AppPreferences>(k: K, v: AppPreferences[K]) {
    setPrefsLocal((prev) => ({ ...prev, [k]: v }));
    setSavedPrefs(false);
  }

  function setInv<K extends keyof InvoicingSettings>(k: K, v: InvoicingSettings[K]) {
    setInvLocal((prev) => ({ ...prev, [k]: v }));
    setSavedInvoicing(false);
  }

  function handleSavePrefs() {
    startTransition(async () => {
      await saveAppPreferences(prefs);
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2000);
    });
  }

  function handleSaveInvoicing() {
    startTransition(async () => {
      await saveInvoicingSettings(inv);
      setSavedInvoicing(true);
      setTimeout(() => setSavedInvoicing(false), 2000);
    });
  }

  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  function setP<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setProfileLocal((prev) => ({ ...prev, [k]: v }));
    setSavedProfile(false);
  }
  function setPay<K extends keyof PaymentInfo>(k: K, v: PaymentInfo[K]) {
    setPaymentLocal((prev) => ({ ...prev, [k]: v }));
    setSavedPayment(false);
  }

  function setTmpl<K extends keyof TelegramKanbanTemplate>(k: K, v: TelegramKanbanTemplate[K]) {
    setPaymentLocal((prev) => ({
      ...prev,
      telegramTemplate: { ...(prev.telegramTemplate ?? {}), [k]: v },
    }));
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

  function handleSavePayment() {
    startTransition(async () => {
      await saveInvoicingSettings(inv);
      setSavedPayment(true);
      setTimeout(() => setSavedPayment(false), 2000);
    });
  }

  function handleSaveTelegram() {
    startTransition(async () => {
      await savePaymentInfo(payment);
      setSavedTelegram(true);
      setTimeout(() => setSavedTelegram(false), 2000);
    });
  }

  function handleSaveKanban() {
    startTransition(async () => {
      await savePaymentInfo(payment);
      setSavedKanban(true);
      setTimeout(() => setSavedKanban(false), 2000);
    });
  }

  const inputCls =
    'h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition w-full backdrop-blur-sm';
  const labelCls = 'text-xs font-semibold text-white/50 uppercase tracking-wider';
  const sectionCls = 'bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl p-6';
  const saveBtnCls =
    'h-11 px-6 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/15 disabled:opacity-60';
  const saveRowCls = 'flex items-center justify-end gap-3 mt-6 pt-5 border-t border-white/[0.08]';

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-white/45 mt-0.5">
          Manage your company info, invoice defaults, and workspace preferences
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/[0.05] border border-white/[0.09] rounded-2xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/45 hover:text-white/70 hover:bg-white/[0.06]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Company tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'company' && (
        <section className={sectionCls}>
          <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-base font-semibold text-white">Company Profile</h2>
            <p className="text-xs text-white/40">Appears in the header of every invoice.</p>
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
                      className="h-14 max-w-[160px] object-contain rounded-xl border border-white/20 bg-white/5 p-1"
                    />
                    <button
                      onClick={() => setP('logo', '')}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 border border-white/20 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="h-14 w-28 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white/25"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <div>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="h-10 px-4 rounded-xl border border-white/20 text-sm text-white/70 hover:bg-white/10 hover:text-white transition"
                  >
                    {profile.logo ? 'Replace' : 'Upload logo'}
                  </button>
                  <p className="text-xs text-white/35 mt-1.5">PNG, JPG, SVG — invoice header</p>
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
                      className="h-14 max-w-[180px] object-contain rounded-xl border border-white/20 bg-white/5 p-1"
                    />
                    <button
                      onClick={() => setP('signatorySignature', '')}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 border border-white/20 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="h-14 w-36 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white/25"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                      />
                    </svg>
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
                    className="cursor-pointer h-10 px-4 rounded-xl border border-white/20 text-sm text-white/70 hover:bg-white/10 hover:text-white transition inline-flex items-center"
                  >
                    {profile.signatorySignature ? 'Replace' : 'Upload signature'}
                  </label>
                  <p className="text-xs text-white/35 mt-1.5">Shown on printed invoices</p>
                </div>
              </div>
            </div>
          </div>

          <div className={saveRowCls}>
            {savedProfile && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
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
            <h2 className="text-base font-semibold text-white">Invoicing</h2>
            <p className="text-xs text-white/40">
              Payment details, currency, date format, and tax shown on invoices.
            </p>
          </div>
          <div className="flex flex-col gap-8">
            {/* Payment Information */}
            <div className="flex flex-col gap-5">
              <SectionDivider label="Payment Information" />
              {[
                { label: 'Bank Name', key: 'bankName', placeholder: 'Advanced Bank Of Asia Ltd.' },
                { label: 'Account Name', key: 'accountName', placeholder: 'Your Company Name' },
                { label: 'Account Number', key: 'accountNumber', placeholder: '000 000 000' },
                { label: 'SWIFT Code', key: 'swiftCode', placeholder: 'ABAAKHPP' },
                { label: 'Currency', key: 'currency', placeholder: 'United States Dollars' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className={labelCls}>{label}</label>
                  <input
                    type="text"
                    value={(inv as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => setInv(key as keyof InvoicingSettings, e.target.value)}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}

              {/* QR Code */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Payment QR Code</label>
                <div className="flex items-center gap-4">
                  {inv.qrImage ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={inv.qrImage}
                        alt="QR Code"
                        className="h-20 w-20 object-contain rounded-xl border border-white/20 bg-white/5 p-1"
                      />
                      <button
                        onClick={() => setInv('qrImage', '')}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 border border-white/20 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white/25"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                    </div>
                  )}
                  <div>
                    <button
                      onClick={() => qrInputRef.current?.click()}
                      className="h-10 px-4 rounded-xl border border-white/20 text-sm text-white/70 hover:bg-white/10 hover:text-white transition"
                    >
                      {inv.qrImage ? 'Replace QR' : 'Upload QR code'}
                    </button>
                    <p className="text-xs text-white/35 mt-1.5">
                      Printed on invoice for easy payment
                    </p>
                    <input
                      ref={qrInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, (b64) => setInv('qrImage', b64));
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                {savedPayment && (
                  <span className="text-xs text-green-400 font-semibold">Saved ✓</span>
                )}
                <button onClick={handleSavePayment} disabled={isPending} className={saveBtnCls}>
                  Save payment info
                </button>
              </div>
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
              <p className="text-xs text-white/35">
                Common: USD ($) · EUR (€) · GBP (£) · THB (฿) · JPY (¥) · SGD (S$) · KHR (រ)
              </p>
            </div>

            {/* Date format */}
            <div className="flex flex-col gap-3">
              <SectionDivider label="Date Format" />
              <div className="grid grid-cols-2 gap-2">
                {(['DD/Mon/YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setInv('dateFormat', fmt)}
                    className={`h-10 px-3 rounded-xl border text-sm font-medium transition text-left ${inv.dateFormat === fmt ? 'border-[#FFC206]/50 bg-[#FFC206]/10 text-[#FFC206]' : 'border-white/15 text-white/60 hover:bg-white/10 hover:text-white'}`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Tax config */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <SectionDivider label="Tax Line" />
                <button
                  type="button"
                  onClick={() => setInv('taxEnabled', !inv.taxEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${inv.taxEnabled ? 'bg-[#FFC206]' : 'bg-white/20'}`}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: inv.taxEnabled ? '22px' : '2px' }}
                  />
                </button>
              </div>
              {inv.taxEnabled && (
                <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
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
                          className={`flex-1 h-10 rounded-xl border text-sm font-medium transition ${inv.taxType === t ? 'border-[#FFC206]/50 bg-[#FFC206]/10 text-[#FFC206]' : 'border-white/15 text-white/60 hover:bg-white/10 hover:text-white'}`}
                        >
                          {t === 'additive' ? 'Additive (VAT / GST)' : 'Deductive (WHT)'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/35">
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
            {savedInvoicing && (
              <span className="text-xs text-green-400 font-semibold">Saved ✓</span>
            )}
            <button onClick={handleSaveInvoicing} disabled={isPending} className={saveBtnCls}>
              Save invoicing settings
            </button>
          </div>
        </section>
      )}

      {/* ── Workspace tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'workspace' && (
        <div className="flex flex-col gap-6">
          {/* Phase labels + Holidays */}
          <section className={sectionCls}>
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-base font-semibold text-white">Workspace Preferences</h2>
              <p className="text-xs text-white/40">
                Project phases and public holidays used across the app.
              </p>
            </div>
            <div className="flex flex-col gap-8">
              {/* Kanban phases */}
              <div className="flex flex-col gap-3">
                <SectionDivider label="Kanban Phases" />
                <p className="text-xs text-white/35 -mt-1">
                  Define your workflow columns. Drag projects between them on the Kanban page.
                </p>
                <KanbanPhaseList
                  phases={prefs.kanbanPhases}
                  onChange={(phases) => setPref('kanbanPhases', phases)}
                  inputCls={inputCls}
                />
              </div>
            </div>

            <div className={saveRowCls}>
              {savedPrefs && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
              <button onClick={handleSavePrefs} disabled={isPending} className={saveBtnCls}>
                Save preferences
              </button>
            </div>
          </section>

          {/* Scope of Work */}
          <section className={sectionCls}>
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-base font-semibold text-white">Scope of Work Suggestions</h2>
              <p className="text-xs text-white/40">
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
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Telegram Bot</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Send invoices and project updates to Telegram. Create a bot via @BotFather and add
                  it to your groups.
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
                <p className="text-xs text-white/35">
                  Shared across all Telegram destinations below.
                </p>
              </div>

              {/* Invoices group */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                    Invoices
                  </p>
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
                    <span className="text-[10px] text-white/25 italic">sample message</span>
                  </div>
                  <pre className="text-xs text-white/60 font-mono leading-relaxed bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 overflow-x-auto whitespace-pre">{`📄 INV-0042\n📅 Date: 20 Apr 2026\n👤 Client: Jane Smith\n\n📎 PDF attached`}</pre>
                </div>
              </div>

              {/* Projects group */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                    Projects
                  </p>
                </div>
                {[
                  {
                    label: 'Chat ID',
                    key: 'projectTelegramChatId',
                    placeholder: '-1009876543210 or @projectgroup',
                  },
                  {
                    label: 'Topic ID (optional)',
                    key: 'projectTelegramTopicId',
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
                    <span className="text-[10px] text-white/25 italic">sample message</span>
                  </div>
                  <pre className="text-xs text-white/60 font-mono leading-relaxed bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 overflow-x-auto whitespace-pre">{`🆕 New Project Added — 20 Apr 2026\n\n📋  Wedding Film\n🏷  Status: Confirmed (Apr 2026)\n📅  Filming: 25 Apr 2026\n🗓  Deliver: 10 May 2026  (🟡 20d left)\n\n━━━━━━━━━━━━\n💼  Total active: 4  |  ⏳ Unconfirmed: 1`}</pre>
                </div>
              </div>
            </div>

            <div className={saveRowCls}>
              {savedTelegram && (
                <span className="text-xs text-green-400 font-semibold">Saved ✓</span>
              )}
              <button onClick={handleSaveTelegram} disabled={isPending} className={saveBtnCls}>
                Save Telegram settings
              </button>
            </div>
          </section>

          {/* Kanban Updates */}
          <section className={sectionCls}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">Kanban Updates</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Post a daily project status digest to the Projects channel at the scheduled time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPay('kanbanUpdateEnabled', !payment.kanbanUpdateEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${payment.kanbanUpdateEnabled ? 'bg-[#FFC206]' : 'bg-white/20'}`}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: payment.kanbanUpdateEnabled ? '22px' : '2px' }}
                />
              </button>
            </div>

            {payment.kanbanUpdateEnabled && (
              <div className="flex flex-col gap-4">
                {/* Timezone */}
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Timezone</label>
                  <select
                    value={payment.kanbanUpdateTimezone ?? 'UTC'}
                    onChange={(e) => setPay('kanbanUpdateTimezone', e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    {[
                      ['UTC', 'UTC'],
                      ['America/Los_Angeles', 'Los Angeles (UTC−8/−7)'],
                      ['America/Denver', 'Denver (UTC−7/−6)'],
                      ['America/Chicago', 'Chicago (UTC−6/−5)'],
                      ['America/New_York', 'New York (UTC−5/−4)'],
                      ['America/Sao_Paulo', 'São Paulo (UTC−3)'],
                      ['Europe/London', 'London (UTC+0/+1)'],
                      ['Europe/Paris', 'Paris (UTC+1/+2)'],
                      ['Europe/Moscow', 'Moscow (UTC+3)'],
                      ['Asia/Dubai', 'Dubai (UTC+4)'],
                      ['Asia/Kolkata', 'India (UTC+5:30)'],
                      ['Asia/Dhaka', 'Dhaka (UTC+6)'],
                      ['Asia/Bangkok', 'Bangkok (UTC+7)'],
                      ['Asia/Singapore', 'Singapore (UTC+8)'],
                      ['Asia/Tokyo', 'Tokyo (UTC+9)'],
                      ['Australia/Sydney', 'Sydney (UTC+10/+11)'],
                    ].map(([val, label]) => (
                      <option key={val} value={val} className="bg-zinc-900">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Send times */}
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Send times</label>
                  <div className="flex flex-col gap-2">
                    {(payment.kanbanUpdateTimes ?? ['09:00', '16:00']).map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={t}
                          onChange={(e) => {
                            const next = [...(payment.kanbanUpdateTimes ?? ['09:00', '16:00'])];
                            next[i] = e.target.value;
                            setPay('kanbanUpdateTimes', next);
                          }}
                          className={`${inputCls} w-36`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (payment.kanbanUpdateTimes ?? ['09:00', '16:00']).filter(
                              (_, idx) => idx !== i
                            );
                            setPay('kanbanUpdateTimes', next);
                          }}
                          className="h-11 px-3 rounded-xl border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const next = [
                          ...(payment.kanbanUpdateTimes ?? ['09:00', '16:00']),
                          '09:00',
                        ];
                        setPay('kanbanUpdateTimes', next);
                      }}
                      className="h-9 px-4 rounded-xl border border-white/15 text-xs font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition self-start"
                    >
                      + Add time
                    </button>
                  </div>
                </div>

                {/* Day selector */}
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Days</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => {
                      const active = (
                        payment.kanbanUpdateDays ?? ['mon', 'tue', 'wed', 'thu', 'fri']
                      ).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const current = payment.kanbanUpdateDays ?? [
                              'mon',
                              'tue',
                              'wed',
                              'thu',
                              'fri',
                            ];
                            const next = active
                              ? current.filter((d) => d !== day)
                              : [...current, day];
                            setPay('kanbanUpdateDays', next);
                          }}
                          className={`h-9 w-12 rounded-xl border text-xs font-semibold uppercase tracking-wide transition ${active ? 'border-violet-400/50 bg-violet-400/15 text-violet-300' : 'border-white/15 text-white/40 hover:bg-white/[0.06] hover:text-white/60'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Template editor */}
                <KanbanTemplateEditor
                  template={payment.telegramTemplate ?? {}}
                  onChange={(k, v) => setTmpl(k, v)}
                  onReorder={(order) => setTmpl('sectionOrder', order)}
                  phases={
                    prefs.kanbanPhases.length > 0
                      ? prefs.kanbanPhases
                      : DEFAULT_APP_PREFERENCES.kanbanPhases
                  }
                  inputCls={inputCls}
                  labelCls={labelCls}
                />

                {/* Send preview */}
                <SendPreviewButton />
              </div>
            )}

            <div
              className={`${saveRowCls} ${payment.kanbanUpdateEnabled ? '' : 'mt-0 pt-0 border-t-0'}`}
            >
              {savedKanban && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
              <button onClick={handleSaveKanban} disabled={isPending} className={saveBtnCls}>
                Save Kanban settings
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Sign out */}
      <div className="pt-2 pb-4">
        <button
          onClick={async () => {
            await signOut();
            router.replace('/login');
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/80 hover:bg-red-500/10 hover:text-red-400 active:bg-red-500/15 transition w-full"
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-bold uppercase tracking-widest text-white/40 shrink-0">{label}</p>
      <div className="flex-1 h-px bg-white/[0.07]" />
    </div>
  );
}

// ── Kanban phase list ─────────────────────────────────────────────────────────

function KanbanPhaseList({
  phases,
  onChange,
  inputCls,
}: {
  phases: KanbanPhase[];
  onChange: (phases: KanbanPhase[]) => void;
  inputCls: string;
}) {
  const [newLabel, setNewLabel] = useState('');

  function addPhase() {
    if (!newLabel.trim()) return;
    onChange([...phases, { id: uid(), label: newLabel.trim() }]);
    setNewLabel('');
  }

  function updateLabel(id: string, label: string) {
    onChange(phases.map((p) => (p.id === id ? { ...p, label } : p)));
  }

  function removePhase(id: string) {
    if (phases.length <= 1) return;
    onChange(phases.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {phases.map((phase, i) => (
        <div key={phase.id} className="flex items-center gap-3">
          <span className="text-xs text-white/30 w-5 shrink-0 text-right">{i + 1}</span>
          <input
            type="text"
            value={phase.label}
            onChange={(e) => updateLabel(phase.id, e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={() => removePhase(phase.id)}
            disabled={phases.length <= 1}
            className="h-11 px-3 rounded-xl border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2 pt-4 border-t border-white/[0.08]">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addPhase();
          }}
          placeholder="New phase name…"
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={addPhase}
          disabled={!newLabel.trim()}
          className="h-11 px-4 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shrink-0 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Scope list ────────────────────────────────────────────────────────────────

function ScopeList({ scopes, onChange }: { scopes: string[]; onChange: (s: string[]) => void }) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newValue, setNewValue] = useState('');

  const inputCls =
    'h-11 rounded-xl border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition backdrop-blur-sm';

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
                className="h-11 px-4 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shrink-0"
              >
                Save
              </button>
              <button
                onClick={() => setEditingIdx(null)}
                className="h-11 px-4 rounded-xl border border-white/20 text-sm text-white/70 hover:bg-white/10 transition shrink-0"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-white/75 py-3 px-4 bg-white/[0.06] rounded-xl border border-white/10 truncate">
                {s}
              </span>
              <button
                onClick={() => startEdit(i)}
                className="h-11 px-4 rounded-xl border border-white/20 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white transition shrink-0"
              >
                Edit
              </button>
              <button
                onClick={() => deleteScope(i)}
                className="h-11 px-4 rounded-xl border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition shrink-0"
              >
                Delete
              </button>
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 mt-2 pt-4 border-t border-white/[0.08]">
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
          className="h-11 px-4 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shrink-0 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Send preview button ────────────────────────────────────────────────────────

function SendPreviewButton() {
  const { sendAll } = useSendProjectsTelegram();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  async function handleSend() {
    setLoading(true);
    setStatus('idle');
    const result = await sendAll();
    setLoading(false);
    if (result.ok) {
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('err');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className="flex items-center gap-2 h-10 px-5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sm font-semibold text-sky-300 hover:bg-sky-500/25 hover:border-sky-500/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Sending…
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Send Preview to Telegram
          </>
        )}
      </button>
      {status === 'ok' && <span className="text-xs text-green-400 font-semibold">Sent ✓</span>}
      {status === 'err' && <span className="text-xs text-red-400 font-semibold">Failed</span>}
    </div>
  );
}

// ── Kanban template editor ─────────────────────────────────────────────────────

function buildSampleProjects(phases: KanbanPhase[]): Project[] {
  const today = new Date();
  const ym = today.toISOString().slice(0, 7);
  const samples: { name: string; items: { id: string; description: string; status: 'todo' }[] }[] =
    [
      {
        name: 'Event Coverage',
        items: [
          { id: 's1', description: 'Video x1', status: 'todo' },
          { id: 's2', description: 'Photo x1', status: 'todo' },
        ],
      },
      {
        name: 'Wedding Film',
        items: [{ id: 's3', description: 'Highlight Reel', status: 'todo' }],
      },
      {
        name: 'Corp. Video',
        items: [
          { id: 's4', description: 'Interview x2', status: 'todo' },
          { id: 's5', description: 'B-Roll Package', status: 'todo' },
        ],
      },
      { name: 'Social Pack', items: [{ id: 's6', description: 'Reels x3', status: 'todo' }] },
    ];

  return phases.map((phase, i) => {
    const s = samples[i % samples.length];
    return {
      id: `prev-p${i}`,
      name: s.name,
      status: 'confirmed' as const,
      kanbanPhase: phase.id,
      clientId: '',
      invoiceIds: [],
      items: s.items,
      createdAt: '',
      confirmedMonth: ym,
    };
  });
}

function KanbanTemplateEditor({
  template,
  onChange,
  onReorder,
  phases,
  inputCls,
  labelCls,
}: {
  template: TelegramKanbanTemplate;
  onChange: <K extends keyof TelegramKanbanTemplate>(k: K, v: TelegramKanbanTemplate[K]) => void;
  onReorder: (order: string[]) => void;
  phases: KanbanPhase[];
  inputCls: string;
  labelCls: string;
}) {
  // Phase-only order (same logic as buildProjectsSummaryMessage)
  const allPhaseIds = phases.map((p) => p.id);
  const stored = (template.sectionOrder ?? []).filter((id) => allPhaseIds.includes(id));
  const missing = allPhaseIds.filter((id) => !stored.includes(id));
  const order = stored.length > 0 ? [...stored, ...missing] : allPhaseIds;

  function move(idx: number, dir: -1 | 1) {
    const next = [...order];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onReorder(next);
  }

  const sampleProjects = useMemo(() => buildSampleProjects(phases), [phases]);
  const preview = useMemo(
    () => buildProjectsSummaryMessage(sampleProjects, phases, template),
    [sampleProjects, phases, template]
  );

  const miniInput =
    'h-9 w-14 rounded-lg border border-white/20 bg-white/10 px-2 text-sm text-white text-center placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#FFC206] focus:border-transparent transition';

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40 shrink-0">
          Message Template
        </p>
        <div className="flex-1 h-px bg-white/[0.07]" />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Header</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={template.headerEmoji ?? ''}
            onChange={(e) => onChange('headerEmoji', e.target.value)}
            placeholder="📊"
            className={miniInput}
            maxLength={4}
          />
          <input
            type="text"
            value={template.headerTitle ?? ''}
            onChange={(e) => onChange('headerTitle', e.target.value)}
            placeholder="PROJECT UPDATE"
            className={`${inputCls} flex-1`}
          />
        </div>
      </div>

      {/* Section order */}
      <div className="flex flex-col gap-2">
        <label className={labelCls}>Section Order</label>
        <div className="flex flex-col gap-1.5">
          {order.map((sid, idx) => (
            <div
              key={sid}
              className="flex items-center gap-2 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.07]"
            >
              <span className="text-sm w-5 text-center shrink-0">■</span>
              <span className="flex-1 text-sm text-white/70 truncate">
                {phases.find((p) => p.id === sid)?.label ?? sid}
              </span>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === order.length - 1}
                onClick={() => move(idx, 1)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className={labelCls}>Preview</label>
          <span className="text-[10px] text-white/25 italic">uses sample data</span>
        </div>
        <pre className="text-xs text-white/60 font-mono leading-relaxed bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 overflow-x-auto whitespace-pre">
          {preview}
        </pre>
      </div>
    </div>
  );
}
