import {
  LayoutDashboard,
  HardHat,
  Users,
  Truck,
  Package,
  Wind,
  Shirt,
  Warehouse,
  ShoppingCart,
  UserCog,
  Settings,
  MoreHorizontal,
} from 'lucide-react'

// Zentrale Definition der Navigationsstruktur.
// Jeder Eintrag mit "children" ist eine ausklappbare Gruppe ohne eigene Seite.
// Jeder Eintrag ohne "children" hat einen "path" und bekommt eine eigene Route.
export const navGroups = [
  {
    label: 'Allgemein',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Baustellen', path: '/baustellen', icon: HardHat },
      {
        label: 'Kunden',
        icon: Users,
        children: [
          { label: 'Auftraggeber', path: '/kunden/auftraggeber' },
          { label: 'SUB Unternehmen', path: '/kunden/sub-unternehmen' },
          { label: 'Externe Projektleiter', path: '/kunden/externe-projektleiter' },
        ],
      },
      {
        label: 'Lieferscheine',
        icon: Truck,
        children: [
          { label: 'Lieferschein erstellen', path: '/lieferscheine/erstellen' },
          { label: 'Übersicht', path: '/lieferscheine/uebersicht' },
          { label: 'Suche', path: '/lieferscheine/suche' },
          { label: 'Meine Lieferscheine', path: '/lieferscheine/meine' },
        ],
      },
      {
        label: 'Artikel',
        icon: Package,
        children: [
          { label: 'Katalog', path: '/artikel/katalog' },
          { label: 'Bestand', path: '/artikel/bestand' },
          { label: 'Leihartikel', path: '/artikel/leihartikel' },
          { label: 'Wareneingang', path: '/artikel/wareneingang' },
          { label: 'Reparaturübersicht', path: '/artikel/reparaturuebersicht' },
        ],
      },
      {
        label: 'Trocknungsgeräte',
        icon: Wind,
        children: [
          { label: 'Dashboard', path: '/trocknungsgeraete/dashboard' },
          { label: 'Auflistung', path: '/trocknungsgeraete/auflistung' },
          { label: 'Verwalten', path: '/trocknungsgeraete/verwalten' },
          { label: 'Gruppen', path: '/trocknungsgeraete/gruppen' },
        ],
      },
      {
        label: 'Arbeitskleidung',
        icon: Shirt,
        children: [
          { label: 'Übersicht', path: '/arbeitskleidung/uebersicht' },
          { label: 'Eingänge', path: '/arbeitskleidung/eingaenge' },
          { label: 'Ausgänge', path: '/arbeitskleidung/ausgaenge' },
        ],
      },
      { label: 'Lager', path: '/lager', icon: Warehouse },
      {
        label: 'Artikel Bestellungen',
        icon: ShoppingCart,
        children: [
          { label: 'Bestellungen', path: '/artikel-bestellungen/bestellungen' },
          { label: 'Lieferanten', path: '/artikel-bestellungen/lieferanten' },
          { label: 'Suche', path: '/artikel-bestellungen/suche' },
          { label: 'Wareneingang', path: '/artikel-bestellungen/wareneingang' },
        ],
      },
    ],
  },
  {
    label: 'Weiteres',
    items: [
      {
        label: 'Benutzer',
        icon: UserCog,
        children: [
          { label: 'Mitarbeiter', path: '/benutzer/mitarbeiter' },
          { label: 'Berechtigungen', path: '/benutzer/berechtigungen' },
        ],
      },
      {
        label: 'Einstellungen',
        icon: Settings,
        children: [
          { label: 'Allgemein', path: '/einstellungen/allgemein' },
          { label: 'Benachrichtigungen', path: '/einstellungen/benachrichtigungen' },
          { label: 'Inventur', path: '/einstellungen/inventur' },
          { label: 'Firmen', path: '/einstellungen/firmen' },
          { label: 'Gewerke', path: '/einstellungen/gewerke' },
          { label: 'E-Mail/WhatsApp Inhalte', path: '/einstellungen/email-whatsapp-inhalte' },
          { label: 'Sprachen', path: '/einstellungen/sprachen' },
          { label: 'Länder', path: '/einstellungen/laender' },
          { label: 'Orte', path: '/einstellungen/orte' },
          { label: 'Positionen', path: '/einstellungen/positionen' },
          { label: 'Placeholder', path: '/einstellungen/placeholder' },
          { label: 'Logs', path: '/einstellungen/logs' },
          { label: 'Historie', path: '/einstellungen/historie' },
        ],
      },
      {
        label: 'Sonstiges',
        icon: MoreHorizontal,
        children: [
          { label: 'Statistik', path: '/sonstiges/statistik' },
          { label: 'Konfliktfälle', path: '/sonstiges/konfliktfaelle' },
          { label: 'Bestellungen', path: '/sonstiges/bestellungen' },
          { label: 'Rechnungsvorlagen', path: '/sonstiges/rechnungsvorlagen' },
        ],
      },
    ],
  },
]

// Flache Liste aller Seiten mit ihrem Breadcrumb-Pfad, für die Routen-Erzeugung.
export function flattenPages() {
  const pages = []
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.children) {
        for (const child of item.children) {
          pages.push({
            path: child.path,
            title: child.label,
            breadcrumb: [group.label, item.label, child.label],
          })
        }
      } else {
        pages.push({
          path: item.path,
          title: item.label,
          breadcrumb: [group.label, item.label],
        })
      }
    }
  }
  return pages
}
