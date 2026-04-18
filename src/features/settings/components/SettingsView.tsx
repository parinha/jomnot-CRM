'use client';

import { useState, useRef, useTransition } from 'react';
import type { AppPreferences, CompanyProfile, PaymentInfo } from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import {
  useCompanyProfile,
  usePaymentInfo,
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

export default function SettingsView() {
  const { data: companyProfile, isLoading } = useCompanyProfile();
  const { data: paymentInfo } = usePaymentInfo();
  const { data: scopeOfWork } = useScopeOfWork();
  const { data: appPreferences } = useAppPreferences();

  if (isLoading) return <TablePageSkeleton rows={8} />;

  return (
    <SettingsForm
      companyProfile={companyProfile ?? EMPTY_PROFILE}
      paymentInfo={paymentInfo ?? EMPTY_PAYMENT}
      scopeOfWork={scopeOfWork ?? []}
      appPreferences={appPreferences}
    />
  );
}

function SettingsForm({
  companyProfile,
  paymentInfo,
  scopeOfWork,
  appPreferences,
}: {
  companyProfile: CompanyProfile;
  paymentInfo: PaymentInfo;
  scopeOfWork: string[];
  appPreferences: AppPreferences;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [isPending, startTransition] = useTransition();
  const { saveCompanyProfile, savePaymentInfo, saveScopeOfWork, saveAppPreferences } =
    useSettingsMutations();
  const [profile, setProfileLocal] = useState<CompanyProfile>(companyProfile);
  const [payment, setPaymentLocal] = useState<PaymentInfo>(paymentInfo);

  const [savedProfile, setSavedProfile] = useState(false);
  const [savedPayment, setSavedPayment] = useState(false);
  const [savedTelegram, setSavedTelegram] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [prefs, setPrefsLocal] = useState<AppPreferences>(appPreferences);

  function setPref<K extends keyof AppPreferences>(k: K, v: AppPreferences[K]) {
    setPrefsLocal((prev) => ({ ...prev, [k]: v }));
    setSavedPrefs(false);
  }

  function handleSavePrefs() {
    startTransition(async () => {
      await saveAppPreferences(prefs);
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2000);
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
      await savePaymentInfo(payment);
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
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/45 hover:text-white/70 hover:bg-white/[0.06]'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
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
                    value={(payment as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => setPay(key as keyof PaymentInfo, e.target.value)}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}

              {/* QR Code */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Payment QR Code</label>
                <div className="flex items-center gap-4">
                  {payment.qrImage ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={payment.qrImage}
                        alt="QR Code"
                        className="h-20 w-20 object-contain rounded-xl border border-white/20 bg-white/5 p-1"
                      />
                      <button
                        onClick={() => setPay('qrImage', '')}
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
                      {payment.qrImage ? 'Replace QR' : 'Upload QR code'}
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
                        if (f) handleImageUpload(f, (b64) => setPay('qrImage', b64));
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
                    value={prefs.currencyCode}
                    onChange={(e) =>
                      setPref('currencyCode', e.target.value.toUpperCase().slice(0, 3))
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
                    value={prefs.currencySymbol}
                    onChange={(e) => setPref('currencySymbol', e.target.value.slice(0, 3))}
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
                    onClick={() => setPref('dateFormat', fmt)}
                    className={`h-10 px-3 rounded-xl border text-sm font-medium transition text-left ${prefs.dateFormat === fmt ? 'border-[#FFC206]/50 bg-[#FFC206]/10 text-[#FFC206]' : 'border-white/15 text-white/60 hover:bg-white/10 hover:text-white'}`}
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
                  onClick={() => setPref('taxEnabled', !prefs.taxEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${prefs.taxEnabled ? 'bg-[#FFC206]' : 'bg-white/20'}`}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: prefs.taxEnabled ? '22px' : '2px' }}
                  />
                </button>
              </div>
              {prefs.taxEnabled && (
                <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Tax Label</label>
                      <input
                        type="text"
                        value={prefs.taxLabel}
                        onChange={(e) => setPref('taxLabel', e.target.value)}
                        placeholder="VAT"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelCls}>Rate (%)</label>
                      <input
                        type="number"
                        value={prefs.taxRate}
                        onChange={(e) => setPref('taxRate', parseFloat(e.target.value) || 0)}
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
                          onClick={() => setPref('taxType', t)}
                          className={`flex-1 h-10 rounded-xl border text-sm font-medium transition ${prefs.taxType === t ? 'border-[#FFC206]/50 bg-[#FFC206]/10 text-[#FFC206]' : 'border-white/15 text-white/60 hover:bg-white/10 hover:text-white'}`}
                        >
                          {t === 'additive' ? 'Additive (VAT / GST)' : 'Deductive (WHT)'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/35">
                      {prefs.taxType === 'additive'
                        ? 'Tax is added on top of the subtotal (e.g. VAT, GST).'
                        : 'Tax is withheld from the payment (e.g. WHT).'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={saveRowCls}>
            {savedPrefs && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
            <button onClick={handleSavePrefs} disabled={isPending} className={saveBtnCls}>
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
              {/* Phase labels */}
              <div className="flex flex-col gap-3">
                <SectionDivider label="Kanban Phase Labels" />
                <p className="text-xs text-white/35 -mt-1">
                  Rename the 5 production phases to match your workflow.
                </p>
                <div className="flex flex-col gap-2">
                  {(prefs.phaseLabels as string[]).map((label, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-white/30 w-5 shrink-0 text-right">{i + 1}</span>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => {
                          const next = [...prefs.phaseLabels] as [
                            string,
                            string,
                            string,
                            string,
                            string,
                          ];
                          next[i] = e.target.value;
                          setPref('phaseLabels', next);
                        }}
                        placeholder={DEFAULT_APP_PREFERENCES.phaseLabels[i]}
                        className={`${inputCls} flex-1`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Holidays */}
              <div className="flex flex-col gap-3">
                <SectionDivider label="Public Holidays" />
                <p className="text-xs text-white/35 -mt-1">
                  Shown on the Timeline as non-working days.
                </p>
                <HolidayList holidays={prefs.holidays} onChange={(h) => setPref('holidays', h)} />
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
            </div>

            {/* Kanban updates scheduler */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                    Kanban Updates
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
                  <p className="text-xs text-white/40">
                    Post a daily project status digest to the Projects channel at the scheduled
                    time.
                  </p>

                  {/* Time picker */}
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Send time</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={payment.kanbanUpdateTime ?? '09:00'}
                        onChange={(e) => setPay('kanbanUpdateTime', e.target.value)}
                        className={`${inputCls} w-36`}
                      />
                      <span className="text-xs text-white/35">
                        24-hour, server local time (UTC)
                      </span>
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
                </div>
              )}
            </div>
          </div>

          <div className={saveRowCls}>
            {savedTelegram && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
            <button onClick={handleSaveTelegram} disabled={isPending} className={saveBtnCls}>
              Save Telegram settings
            </button>
          </div>
        </section>
      )}
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

// ── Holiday list ───────────────────────────────────────────────────────────────

function HolidayList({
  holidays,
  onChange,
}: {
  holidays: { date: string; name: string }[];
  onChange: (h: { date: string; name: string }[]) => void;
}) {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const inputCls =
    'h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition backdrop-blur-sm';

  function addHoliday() {
    if (!newDate || !newName.trim()) return;
    onChange([...holidays, { date: newDate, name: newName.trim() }]);
    setNewDate('');
    setNewName('');
  }

  function removeHoliday(i: number) {
    onChange(holidays.filter((_, idx) => idx !== i));
  }

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 && (
        <p className="text-xs text-white/30 italic py-2">
          No holidays configured. Add your first one below.
        </p>
      )}
      {sorted.map((h, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-white/50 font-mono text-xs w-24 shrink-0">{h.date}</span>
          <span className="flex-1 text-white/80 truncate">{h.name}</span>
          <button
            onClick={() => removeHoliday(holidays.indexOf(h))}
            className="shrink-0 text-red-400/60 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-red-500/10 transition"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/[0.08]">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className={`${inputCls} w-36 shrink-0`}
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addHoliday();
          }}
          placeholder="Holiday name"
          className={`${inputCls} flex-1`}
        />
        <button
          onClick={addHoliday}
          disabled={!newDate || !newName.trim()}
          className="h-10 px-3 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shrink-0 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
