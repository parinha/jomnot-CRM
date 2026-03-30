'use client'

import { useState, useRef } from 'react'
import { useStore, type CompanyProfile, type PaymentInfo } from '../AppStore'
import FormField from '@/app/_components/FormField'

export default function SettingsView() {
  const {
    companyProfile, setCompanyProfile,
    paymentInfo,    setPaymentInfo,
    scopeOfWork,    setScopeOfWork,
  } = useStore()

  const [profile, setProfileLocal] = useState<CompanyProfile>(companyProfile)
  const [payment, setPaymentLocal] = useState<PaymentInfo>(paymentInfo)
  const [savedProfile, setSavedProfile] = useState(false)
  const [savedPayment,  setSavedPayment]  = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const qrInputRef   = useRef<HTMLInputElement>(null)

  function setP<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setProfileLocal((prev) => ({ ...prev, [k]: v }))
    setSavedProfile(false)
  }

  function setPay<K extends keyof PaymentInfo>(k: K, v: PaymentInfo[K]) {
    setPaymentLocal((prev) => ({ ...prev, [k]: v }))
    setSavedPayment(false)
  }

  function handleImageUpload(file: File, onResult: (b64: string) => void) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') onResult(result)
    }
    reader.readAsDataURL(file)
  }

  function handleSaveProfile() {
    setCompanyProfile(profile)
    setSavedProfile(true)
    setTimeout(() => setSavedProfile(false), 2000)
  }

  function handleSavePayment() {
    setPaymentInfo(payment)
    setSavedPayment(true)
    setTimeout(() => setSavedPayment(false), 2000)
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Company profile and payment information used on invoices</p>
      </div>

      {/* Company Profile */}
      <section className="bg-white rounded-xl border border-zinc-200 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-5">Company Profile</h2>

        <div className="flex flex-col gap-4">
          {/* Logo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Logo</label>
            <div className="flex items-center gap-4">
              {profile.logo ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.logo} alt="Logo" className="h-14 max-w-[160px] object-contain rounded border border-zinc-200 bg-zinc-50 p-1" />
                  <button
                    onClick={() => setP('logo', '')}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zinc-800 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="h-14 w-28 rounded border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="text-sm text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 transition"
                >
                  {profile.logo ? 'Replace' : 'Upload logo'}
                </button>
                <p className="text-xs text-zinc-400 mt-1">PNG, JPG, SVG — shown in invoice header</p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImageUpload(f, (b64) => setP('logo', b64))
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>

          <FormField label="Company Name" value={profile.name} onChange={(v) => setP('name', v)} placeholder="Acme Studio Co., Ltd." />
          <FormField label="Address" value={profile.address} onChange={(v) => setP('address', v)} placeholder="123 Studio Street, Bangkok 10110" textarea />
          <FormField label="Phone" value={profile.phone} onChange={(v) => setP('phone', v)} placeholder="+66 2 000 0000" />
          <FormField label="Website" value={profile.website} onChange={(v) => setP('website', v)} placeholder="www.yourstudio.com" />
          <FormField label="Authorized Signatory Name" value={profile.signatoryName ?? ''} onChange={(v) => setP('signatoryName', v)} placeholder="UM Kannika" />

          {/* Signatory Signature */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Signatory Signature</label>
            <div className="flex items-center gap-4">
              {profile.signatorySignature ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.signatorySignature} alt="Signature" className="h-14 max-w-[180px] object-contain rounded border border-zinc-200 bg-zinc-50 p-1" />
                  <button
                    onClick={() => setP('signatorySignature', '')}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zinc-800 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="h-14 w-36 rounded border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
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
                    const f = e.target.files?.[0]
                    if (f) handleImageUpload(f, (b64) => setP('signatorySignature', b64))
                    e.target.value = ''
                  }}
                />
                <label htmlFor="sig-upload" className="cursor-pointer text-sm text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 transition inline-block">
                  {profile.signatorySignature ? 'Replace' : 'Upload signature'}
                </label>
                <p className="text-xs text-zinc-400 mt-1">Shown on printed invoices</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-100">
          {savedProfile && <span className="text-xs text-green-600 font-medium">Saved</span>}
          <button onClick={handleSaveProfile} className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
            Save profile
          </button>
        </div>
      </section>

      {/* Payment Information */}
      <section className="bg-white rounded-xl border border-zinc-200 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Payment Information</h2>
        <p className="text-xs text-zinc-400 mb-5">Shown at the bottom of every invoice so clients know how to pay.</p>

        <div className="flex flex-col gap-4">
          <FormField label="Bank Name" value={payment.bankName} onChange={(v) => setPay('bankName', v)} placeholder="Advanced Bank Of Asia Ltd. (ABA Bank)" />
          <FormField label="Account Name" value={payment.accountName} onChange={(v) => setPay('accountName', v)} placeholder="OR SEREIPARINHA AND UM KANNIKA" />
          <FormField label="Account Number" value={payment.accountNumber} onChange={(v) => setPay('accountNumber', v)} placeholder="002 575 816" />
          <FormField label="SWIFT Code" value={payment.swiftCode} onChange={(v) => setPay('swiftCode', v)} placeholder="ABAAKHPP" />
          <FormField label="Currency" value={payment.currency} onChange={(v) => setPay('currency', v)} placeholder="United States Dollars" />

          {/* QR Code */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Payment QR Code</label>
            <div className="flex items-center gap-4">
              {payment.qrImage ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={payment.qrImage} alt="QR Code" className="h-20 w-20 object-contain rounded border border-zinc-200 bg-zinc-50 p-1" />
                  <button
                    onClick={() => setPay('qrImage', '')}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zinc-800 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="h-20 w-20 rounded border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
              )}
              <div>
                <button
                  onClick={() => qrInputRef.current?.click()}
                  className="text-sm text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 transition"
                >
                  {payment.qrImage ? 'Replace QR' : 'Upload QR code'}
                </button>
                <p className="text-xs text-zinc-400 mt-1">Printed on invoice for easy payment</p>
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImageUpload(f, (b64) => setPay('qrImage', b64))
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-100">
          {savedPayment && <span className="text-xs text-green-600 font-medium">Saved</span>}
          <button onClick={handleSavePayment} className="h-9 px-4 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">
            Save payment info
          </button>
        </div>
      </section>

      {/* Scope of Work */}
      <section className="bg-white rounded-xl border border-zinc-200 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Scope of Work Suggestions</h2>
        <p className="text-xs text-zinc-400 mb-5">These appear as autocomplete suggestions when adding line items to invoices.</p>
        <ScopeList scopes={scopeOfWork} onChange={setScopeOfWork} />
      </section>
    </div>
  )
}

function ScopeList({ scopes, onChange }: { scopes: string[]; onChange: (s: string[]) => void }) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newValue, setNewValue] = useState('')

  const inputCls = 'h-9 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition'

  function startEdit(i: number) {
    setEditingIdx(i)
    setEditValue(scopes[i])
  }

  function commitEdit(i: number) {
    if (!editValue.trim()) { setEditingIdx(null); return }
    onChange(scopes.map((s, idx) => (idx === i ? editValue.trim() : s)))
    setEditingIdx(null)
  }

  function deleteScope(i: number) {
    onChange(scopes.filter((_, idx) => idx !== i))
  }

  function addScope() {
    if (!newValue.trim()) return
    onChange([...scopes, newValue.trim()])
    setNewValue('')
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
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(i); if (e.key === 'Escape') setEditingIdx(null) }}
                className={`${inputCls} flex-1`}
              />
              <button onClick={() => commitEdit(i)} className="h-9 px-3 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover transition">Save</button>
              <button onClick={() => setEditingIdx(null)} className="h-9 px-3 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition">Cancel</button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-zinc-700 py-2 px-3 bg-zinc-50 rounded-lg border border-zinc-200 truncate">{s}</span>
              <button onClick={() => startEdit(i)} className="h-9 px-3 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100 transition shrink-0">Edit</button>
              <button onClick={() => deleteScope(i)} className="h-9 px-3 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 transition shrink-0">Delete</button>
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 mt-1 pt-3 border-t border-zinc-100">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addScope() }}
          placeholder="Add new scope…"
          className={`${inputCls} flex-1`}
        />
        <button
          onClick={addScope}
          disabled={!newValue.trim()}
          className="h-9 px-3 rounded-lg bg-brand text-zinc-900 text-sm font-medium hover:bg-brand-hover disabled:opacity-40 transition shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  )
}
