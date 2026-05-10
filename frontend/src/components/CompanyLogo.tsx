import { useState, useEffect } from 'react'
import { lookupDomain } from '../utils/companyDomain'

const TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN ?? ''

const avatarBg   = ['var(--surface-muted)','var(--accent-bg)','var(--applied-bg)','var(--interview-bg)','var(--warn-bg)','var(--danger-bg)']
const avatarText = ['var(--ink-700)','var(--accent)','var(--applied)','var(--interview)','var(--warn)','var(--danger)']

export function CompanyLogo({ company, logoUrl, size = 32 }: { company: string; logoUrl?: string | null; size?: number }) {
  const [domain, setDomain] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const idx     = company.charCodeAt(0) % avatarBg.length
  const initial = company.trim()[0]?.toUpperCase() ?? '?'
  const radius  = Math.round(size * 0.22)

  useEffect(() => {
    if (logoUrl) return
    if (domain !== null) return
    lookupDomain(company).then(setDomain)
  }, [company, domain, logoUrl])

  const avatar = (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: avatarBg[idx], display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: size * 0.34, fontWeight: 700, color: avatarText[idx] }}>{initial}</span>
    </div>
  )

  if (failed) return avatar

  if (logoUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: 'var(--surface-muted)', border: '1px solid var(--ink-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <img
          src={logoUrl}
          alt={company}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, objectFit: 'contain' }}
        />
      </div>
    )
  }

  if (!domain || !TOKEN) return avatar

  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: 'var(--surface-muted)', border: '1px solid var(--ink-100)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <img
        src={`https://img.logo.dev/${domain}?token=${TOKEN}&size=64&format=png`}
        alt={company}
        onError={() => setFailed(true)}
        style={{ width: size * 0.72, height: size * 0.72, objectFit: 'contain' }}
      />
    </div>
  )
}
