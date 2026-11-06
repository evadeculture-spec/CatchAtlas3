import { useEffect, useState } from 'react'
import { useApp } from '../state/AppState'
import { loadPhoto } from './photos'

/** Devolve um object URL para a fotografia guardada em IndexedDB (ou null). */
export function usePhotoUrl(catchId: string, hasPhoto: boolean) {
  const { photoVersion } = useApp()
  const [result, setResult] = useState<{ key: string; url: string | null; failed: boolean }>({ key: '', url: null, failed: false })
  const key = `${catchId}|${photoVersion}`

  useEffect(() => {
    if (!hasPhoto) return
    let url: string | null = null
    let alive = true
    loadPhoto(catchId)
      .then((blob) => {
        if (!alive) return
        url = blob ? URL.createObjectURL(blob) : null
        setResult({ key, url, failed: !blob })
      })
      .catch(() => alive && setResult({ key, url: null, failed: true }))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [catchId, hasPhoto, key])

  if (!hasPhoto) return { url: null, loading: false, failed: false }
  const current = result.key === key
  return { url: current ? result.url : null, loading: !current, failed: current && result.failed }
}
