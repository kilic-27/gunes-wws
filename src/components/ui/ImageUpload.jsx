import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { uploadImage, getPublicImageUrl, getSignedImageUrl } from '../../lib/storage.js'

/**
 * Wiederverwendbare Bild-Upload-Komponente für alle Anlegen-/Bearbeiten-
 * Formulare. `value` ist der gespeicherte Storage-Pfad (nicht die URL);
 * `onChange(path)` wird mit dem neuen Pfad (oder null bei "Entfernen")
 * aufgerufen. `isPublic` steuert, ob die Vorschau über eine dauerhafte
 * öffentliche URL oder eine befristete signierte URL aufgelöst wird.
 */
export default function ImageUpload({
  bucket,
  folder = '',
  value,
  onChange,
  isPublic = true,
  shape = 'square',
  label = 'Bild',
}) {
  const inputRef = useRef(null)
  const [localPreview, setLocalPreview] = useState(null)
  const [resolvedUrl, setResolvedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setResolvedUrl(null)
    if (!value) return undefined
    if (isPublic) {
      setResolvedUrl(getPublicImageUrl(bucket, value))
    } else {
      getSignedImageUrl(bucket, value).then((url) => {
        if (!cancelled) setResolvedUrl(url)
      })
    }
    return () => {
      cancelled = true
    }
  }, [bucket, value, isPublic])

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    },
    [localPreview],
  )

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setLocalPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const path = await uploadImage(bucket, file, folder)
      onChange(path)
    } catch (err) {
      setError(err?.message || 'Upload fehlgeschlagen.')
      setLocalPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setLocalPreview(null)
    setResolvedUrl(null)
    onChange(null)
  }

  const displayUrl = localPreview || resolvedUrl

  return (
    <div className="image-upload">
      <div className={'image-upload-preview image-upload-' + shape}>
        {displayUrl ? (
          <img src={displayUrl} alt={label} />
        ) : (
          <ImagePlus size={22} className="image-upload-placeholder-icon" aria-hidden="true" />
        )}
        {uploading && (
          <div className="image-upload-overlay">
            <Loader2 size={18} className="spin" />
          </div>
        )}
      </div>
      <div className="image-upload-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {displayUrl ? 'Ändern' : 'Auswählen'}
        </button>
        {displayUrl && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemove} disabled={uploading}>
            <X size={14} />
            Entfernen
          </button>
        )}
        {error && <p className="login-error">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
    </div>
  )
}
