import { supabase } from './supabaseClient.js'

function randomFileName(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  return `${crypto.randomUUID()}.${ext}`
}

// Formate, die die Storage-Buckets annehmen. Alles andere (z. B. AVIF, HEIC, BMP) wird vor dem Hochladen in JPEG umgewandelt.
const ERLAUBTE_BILDTYPEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])

async function alsJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // JPEG kennt keine Transparenz
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('convert')
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'bild'}.jpg`, { type: 'image/jpeg' })
}

/**
 * Lädt eine Bilddatei in einen Supabase-Storage-Bucket hoch und gibt den
 * Objekt-Pfad zurück (nicht die URL — die wird je nach Bucket-Sichtbarkeit
 * separat aufgelöst, siehe getPublicImageUrl / getSignedImageUrl).
 * Nicht unterstützte Formate (z. B. AVIF) werden im Browser in JPEG umgewandelt.
 */
export async function uploadImage(bucket, file, folder = '') {
  if (!ERLAUBTE_BILDTYPEN.has(file.type)) {
    try {
      file = await alsJpeg(file)
    } catch {
      const fehler = new Error('image-format')
      fehler.code = 'IMAGE_FORMAT'
      throw fehler
    }
  }
  const path = folder ? `${folder}/${randomFileName(file)}` : randomFileName(file)
  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error
  return path
}

// Für öffentliche Buckets (z. B. Firmen-Logos): liefert eine dauerhafte URL.
export function getPublicImageUrl(bucket, path) {
  if (!path) return null
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Für geschützte Buckets (z. B. Mitarbeiterfotos): liefert eine befristete URL.
export async function getSignedImageUrl(bucket, path, expiresIn = 3600) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}
