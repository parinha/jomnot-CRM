'use client'

import { useState, useEffect, useRef } from 'react'
import {
  loadCompanyProfile,
  saveCompanyProfile,
  loadPaymentInfo,
  savePaymentInfo,
  type CompanyProfile,
  type PaymentInfo,
} from '../AppStore'

export default function SettingsView() {
  const [profile, setProfile] = useState<CompanyProfile>({ name: '', logo: '', address: '', phone: '', website: '' })
  const [payment, setPayment] = useState<PaymentInfo>({ abaSwift: '', accountNumber: '', accountName: '', qrImage: '' })
  const [savedProfile, setSavedProfile] = useState(false)
  const [savedPayment, setSavedPayment] = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const qrInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setProfile(loadCompanyProfile())
    setPayment(loadPaymentInfo())
  }, [])

  function setP<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setProfile((prev) => ({ ...prev, [k]: v }))
    setSavedProfile(false)
  }

  function setPay<K extends keyof PaymentInfo>(k: K, v: PaymentInfo[K]) {
    setPayment((prev) => ({ ...prev, [k]: v }))
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
    saveCompanyProfile(profile)
    setSavedProfile(true)
    setTimeout(() => setSavedProfile(false), 2000)
  }

  function handleSavePayment() {
    savePaymentInfo(payment)
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
      <section className="bg-white rounded-xl border border-zinc-200 p-6">
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

          <Field label="Company Name" value={profile.name} onChange={(v) => setP('name', v)} placeholder="Acme Studio Co., Ltd." />
          <Field label="Address" value={profile.address} onChange={(v) => setP('address', v)} placeholder="123 Studio Street, Bangkok 10110" textarea />
          <Field label="Phone" value={profile.phone} onChange={(v) => setP('phone', v)} placeholder="+66 2 000 0000" />
          <Field label="Website" value={profile.website} onChange={(v) => setP('website', v)} placeholder="www.yourstudio.com" />
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-100">
          {savedProfile && <span className="text-xs text-green-600 font-medium">Saved</span>}
          <button onClick={handleSaveProfile} className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition">
            Save profile
          </button>
        </div>
      </section>

      {/* Payment Information */}
      <section className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Payment Information</h2>
        <p className="text-xs text-zinc-400 mb-5">Shown at the bottom of every invoice so clients know how to pay.</p>

        <div className="flex flex-col gap-4">
          <Field label="Account Name" value={payment.accountName} onChange={(v) => setPay('accountName', v)} placeholder="Acme Studio Co., Ltd." />
          <Field label="Account Number" value={payment.accountNumber} onChange={(v) => setPay('accountNumber', v)} placeholder="000-0-00000-0" />
          <Field label="ABA / SWIFT Code" value={payment.abaSwift} onChange={(v) => setPay('abaSwift', v)} placeholder="KASITHBK" />

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
          <button onClick={handleSavePayment} className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition">
            Save payment info
          </button>
        </div>
      </section>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  const cls = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition w-full'
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {textarea ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-none`} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} h-10`} />
      )}
    </div>
  )
}
