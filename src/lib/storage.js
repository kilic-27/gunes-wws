import { supabase } from './supabaseClient.js'

function randomFileName(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  return `${crypto.randomUUID()}.${ext}`
}

/**
 * Lädt eine Bilddatei in einen Supabase-Storage-Bucket hoch und gibt den
 * Objekt-Pfad zurück (nicht die URL — die wird je nach Bucket-Sichtbarkeit
 * separat aufgelöst, siehe getPublicImageUrl / getSignedImageUrl).
 */
export async function uploadImage(bucket, file, folder = '') {
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
