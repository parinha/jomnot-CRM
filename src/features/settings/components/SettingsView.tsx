'use client';

import { useState, useRef, useTransition } from 'react';
import type { CompanyProfile, PaymentInfo } from '@/src/types';
import {
  DEFAULT_TELEGRAM_TEMPLATE,
  type TelegramTemplate,
  type TelegramSectionConfig,
} from '@/src/config/constants';
import {
  saveCompanyProfile,
  savePaymentInfo,
  saveScopeOfWork,
} from '@/src/features/settings/actions/settingsActions';

interface Props {
  companyProfile: CompanyProfile;
  paymentInfo: PaymentInfo;
  scopeOfWork: string[];
}

export default function SettingsView({ companyProfile, paymentInfo, scopeOfWork }: Props) {
  const [isPending, startTransition] = useTransition();
  const [profile, setProfileLocal] = useState<CompanyProfile>(companyProfile);
  const [payment, setPaymentLocal] = useState<PaymentInfo>(paymentInfo);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedPayment, setSavedPayment] = useState(false);
  const [savedTelegram, setSavedTelegram] = useState(false);

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

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-white/45 mt-0.5">
          Company profile and payment information used on invoices
        </p>
      </div>

      {/* Company Profile */}
      <section className={sectionCls}>
        <h2 className="text-sm font-semibold text-white mb-5">Company Profile</h2>
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
            { label: 'Authorized Signatory Name', key: 'signatoryName', placeholder: 'UM Kannika' },
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

        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-white/[0.08]">
          {savedProfile && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
          <button
            onClick={handleSaveProfile}
            disabled={isPending}
            className="h-11 px-6 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/15 disabled:opacity-60"
          >
            Save profile
          </button>
        </div>
      </section>

      {/* Payment Information */}
      <section className={sectionCls}>
        <h2 className="text-sm font-semibold text-white mb-1">Payment Information</h2>
        <p className="text-xs text-white/40 mb-5">
          Shown at the bottom of every invoice so clients know how to pay.
        </p>
        <div className="flex flex-col gap-5">
          {[
            {
              label: 'Bank Name',
              key: 'bankName',
              placeholder: 'Advanced Bank Of Asia Ltd. (ABA Bank)',
            },
            {
              label: 'Account Name',
              key: 'accountName',
              placeholder: 'OR SEREIPARINHA AND UM KANNIKA',
            },
            { label: 'Account Number', key: 'accountNumber', placeholder: '002 575 816' },
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
                <p className="text-xs text-white/35 mt-1.5">Printed on invoice for easy payment</p>
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
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-white/[0.08]">
          {savedPayment && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
          <button
            onClick={handleSavePayment}
            disabled={isPending}
            className="h-11 px-6 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/15 disabled:opacity-60"
          >
            Save payment info
          </button>
        </div>
      </section>

      {/* Telegram */}
      <section className={sectionCls}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Telegram Bot</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Send invoices and project updates to Telegram. Create a bot via @BotFather and add it
              to your groups.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
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
            <p className="text-xs text-white/35">Shared across all Telegram destinations below.</p>
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

          {/* Message template */}
          <TelegramTemplateEditor
            value={payment.telegramTemplate ?? DEFAULT_TELEGRAM_TEMPLATE}
            onChange={(tpl) => setPay('telegramTemplate', tpl)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-white/[0.08]">
          {savedTelegram && <span className="text-xs text-green-400 font-semibold">Saved ✓</span>}
          <button
            onClick={handleSaveTelegram}
            disabled={isPending}
            className="h-11 px-6 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/15 disabled:opacity-60"
          >
            Save Telegram settings
          </button>
        </div>
      </section>

      {/* Scope of Work */}
      <section className={sectionCls}>
        <h2 className="text-sm font-semibold text-white mb-1">Scope of Work Suggestions</h2>
        <p className="text-xs text-white/40 mb-5">
          These appear as autocomplete suggestions when adding line items to invoices.
        </p>
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
  );
}

// ── Telegram template editor ──────────────────────────────────────────────────

const SECTION_KEYS: (keyof TelegramTemplate['sections'])[] = [
  'delivered',
  'unconfirmed',
  'awaitFilming',
  'awaitRoughCut',
  'awaitDraft',
  'awaitMaster',
  'awaitDeliver',
];

function TelegramTemplateEditor({
  value,
  onChange,
}: {
  value: TelegramTemplate;
  onChange: (t: TelegramTemplate) => void;
}) {
  const emojiCls =
    'w-14 h-10 rounded-xl border border-white/20 bg-white/10 px-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition shrink-0';
  const textCls =
    'h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#FFC206] focus:border-transparent transition flex-1 min-w-0';

  function setHeader<K extends 'headerEmoji' | 'headerTitle'>(k: K, v: string) {
    onChange({ ...value, [k]: v });
  }

  function setSection(
    key: keyof TelegramTemplate['sections'],
    patch: Partial<TelegramSectionConfig>
  ) {
    onChange({
      ...value,
      sections: { ...value.sections, [key]: { ...value.sections[key], ...patch } },
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
          Message Template
        </p>
      </div>
      <p className="text-xs text-white/40 -mt-2">
        Customize the section names and emojis sent in the project update message.
      </p>

      {/* Header row */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wide">Header</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value.headerEmoji}
            onChange={(e) => setHeader('headerEmoji', e.target.value)}
            className={emojiCls}
            placeholder="📊"
            maxLength={4}
          />
          <input
            type="text"
            value={value.headerTitle}
            onChange={(e) => setHeader('headerTitle', e.target.value)}
            className={textCls}
            placeholder="PROJECT UPDATE"
          />
        </div>
      </div>

      {/* Timeline status emojis */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wide">
          Timeline Status Emojis
        </p>
        <p className="text-xs text-white/35">
          Format:{' '}
          <span className="text-white/55 font-mono">
            {value.timeline.noDate} Project Name (🟡 8d left)
          </span>
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value.timeline.noDate}
              onChange={(e) =>
                onChange({ ...value, timeline: { ...value.timeline, noDate: e.target.value } })
              }
              className={emojiCls}
              maxLength={4}
            />
            <span className="text-xs text-white/45">Bullet prefix (all lines)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-0">
            {(
              [
                { key: 'overdue' as const, hint: 'Overdue / due today' },
                { key: 'urgent' as const, hint: '≤ 3 days left' },
                { key: 'soon' as const, hint: '≤ 10 days left' },
                { key: 'ok' as const, hint: '> 10 days left' },
              ] as const
            ).map(({ key, hint }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="text"
                  value={value.timeline[key]}
                  onChange={(e) =>
                    onChange({ ...value, timeline: { ...value.timeline, [key]: e.target.value } })
                  }
                  className={emojiCls}
                  maxLength={4}
                />
                <span className="text-xs text-white/45 truncate">{hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section rows */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wide">Sections</p>
        {SECTION_KEYS.map((key) => {
          const cfg = value.sections[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSection(key, { enabled: !cfg.enabled })}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition ${
                  cfg.enabled
                    ? 'bg-[#FFC206]/15 border-[#FFC206]/40 text-[#FFC206]'
                    : 'bg-white/5 border-white/15 text-white/25'
                }`}
                title={cfg.enabled ? 'Enabled — click to hide' : 'Disabled — click to show'}
              >
                {cfg.enabled ? (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={cfg.emoji}
                onChange={(e) => setSection(key, { emoji: e.target.value })}
                className={`${emojiCls} ${!cfg.enabled ? 'opacity-40' : ''}`}
                placeholder="🔖"
                maxLength={4}
                disabled={!cfg.enabled}
              />
              <input
                type="text"
                value={cfg.label}
                onChange={(e) => setSection(key, { label: e.target.value })}
                className={`${textCls} ${!cfg.enabled ? 'opacity-40' : ''}`}
                placeholder="Section name"
                disabled={!cfg.enabled}
              />
            </div>
          );
        })}
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
