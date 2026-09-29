function norm(value) {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Findet eine bereits vorhandene "orte"-Zeile (typ "adresse") mit exakt
 * derselben Straße/PLZ/Ort-Kombination, oder legt eine neue an. So wird
 * jede einmal eingegebene Adresse automatisch Teil der wiederverwendbaren
 * Adress-Datenbank (Grundlage für die Autovervollständigung), ohne dass
 * dafür ein separater Schritt auf der Orte-Seite nötig ist.
 */
export async function resolveOrtId({ strasse, plz, ort, land_id }, orteRows, orteTable) {
  const strasseNorm = norm(strasse)
  const plzNorm = norm(plz)
  const ortNorm = norm(ort)

  if (!strasseNorm && !plzNorm && !ortNorm) return null

  const existing = orteRows.find(
    (row) =>
      row.typ === 'adresse' &&
      norm(row.strasse) === strasseNorm &&
      norm(row.plz) === plzNorm &&
      norm(row.name) === ortNorm,
  )
  if (existing) return existing.id

  const created = await orteTable.insert({
    typ: 'adresse',
    name: ort || null,
    plz: plz || null,
    strasse: strasse || null,
    land_id: land_id || null,
  })
  return created.id
}
