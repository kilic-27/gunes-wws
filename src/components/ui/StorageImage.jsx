import { useEffect, useState } from 'react'
import { getPublicImageUrl, getSignedImageUrl } from '../../lib/storage.js'

/**
 * Zeigt ein Bild aus Supabase Storage an. Löst für öffentliche Buckets sofort
 * eine dauerhafte URL auf, für geschützte Buckets eine befristete signierte
 * URL. Rendert `fallback`, solange kein Pfad vorhanden oder die URL noch
 * nicht aufgelöst ist.
 */
export default function StorageImage({ bucket, path, isPublic = true, alt = '', className, fallback = null }) {
  const [url, setUrl] = useState(isPublic ? getPublicImageUrl(bucket, path) : null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return undefined
    }
    if (isPublic) {
      setUrl(getPublicImageUrl(bucket, path))
    } else {
      setUrl(null)
      getSignedImageUrl(bucket, path).then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl)
      })
    }
    return () => {
      cancelled = true
    }
  }, [bucket, path, isPublic])

  if (!path || !url) return fallback
  // Lazy laden (lange Listen mit vielen Fotos) und bei einem Ladefehler einmal erneut versuchen.
  const src = attempt > 0 ? url + (url.includes('?') ? '&' : '?') + 'retry=' + attempt : url
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (attempt < 2) setTimeout(() => setAttempt((n) => n + 1), 800)
      }}
    />
  )
}
