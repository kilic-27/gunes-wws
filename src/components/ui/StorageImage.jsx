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
  return <img src={url} alt={alt} className={className} />
}
