import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { signedUrls } from '../../lib/lanca/api'
import { PING_BUCKET } from '../../lib/lanca/supabase'
import { cx } from '../ui'

/** Imagem privada servida por URL assinado e temporário (nunca por URL público). */
export function SignedImage({ path, alt, className, bucket = PING_BUCKET, fallbackPath }: { path: string | null | undefined; alt: string; className?: string; bucket?: string; fallbackPath?: string | null }) {
  const p = path ?? fallbackPath ?? null
  const [state, setState] = useState<{ path: string | null; url: string | null; failed: boolean }>({ path: null, url: null, failed: false })
  useEffect(() => {
    if (!p) return
    let alive = true
    signedUrls([p], bucket)
      .then((m) => alive && setState({ path: p, url: m[p] ?? null, failed: !m[p] }))
      .catch(() => alive && setState({ path: p, url: null, failed: true }))
    return () => {
      alive = false
    }
  }, [p, bucket])
  const current = state.path === p
  const url = current ? state.url : null
  const failed = current && state.failed
  if (!p || failed)
    return (
      <div className={cx('grid place-items-center bg-mist text-subtle', className)} role="img" aria-label={failed ? 'Imagem indisponível' : 'Sem pré-visualização'}>
        <ImageOff className="h-5 w-5" aria-hidden />
      </div>
    )
  if (!url) return <div className={cx('animate-pulse bg-[#e3eaec]', className)} aria-hidden />
  return <img src={url} alt={alt} className={cx('object-cover', className)} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setState({ path: p, url: null, failed: true })} />
}
