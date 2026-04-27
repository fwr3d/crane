import { useState, useEffect } from 'react'
import { lookupDomain } from '../utils/companyDomain'

const TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN ?? ''

const avatarBg   = ['#dbeafe','#fef3c7','#dcfce7','#fce7f3','#ede9fe','#ffedd5']
const avatarText = ['#1d4ed8','#92400e','#166534','#9d174d','#5b21b6','#c2410c']

export function CompanyLogo({ company, size = 32 }: { company: string; size?: number }) {
  const [domain, setDomain] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const idx     = company.charCodeAt(0) % avatarBg.length
  const initial = company.trim()[0]?.toUpperCase() ?? '?'
  const radius  = Math.round(size * 0.22)

  useEffect(() => {
    if (domain !== null) return
    lookupDomain(company).then(setDomain)
  }, [company, domain])

  const avatar = (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: avatarBg[idx], display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: size * 0.34, fontWeight: 700, color: avatarText[idx] }}>{initial}</span>
    </div>
  )

  if (failed || !domain || !TOKEN) return avatar

  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: '#f8fafc', border: '1px solid #f1f5f9',
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
