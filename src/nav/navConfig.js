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
// "labelKey" ist der i18n-Key (siehe src/i18n/locales/*.json, Namespace "nav")
// — die eigentliche Übersetzung passiert erst beim Rendern per t(labelKey).
export const navGroups = [
  {
    labelKey: 'nav.groupAllgemein',
    items: [
      { labelKey: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard },
      { labelKey: 'nav.baustellen', path: '/baustellen', icon: HardHat },
      {
        labelKey: 'nav.kunden',
        icon: Users,
        children: [
          { labelKey: 'nav.kunden_auftraggeber', path: '/kunden/auftraggeber' },
          { labelKey: 'nav.kunden_subUnternehmen', path: '/kunden/sub-unternehmen' },
          { labelKey: 'nav.kunden_externeProjektleiter', path: '/kunden/externe-projektleiter' },
        ],
      },
      {
        labelKey: 'nav.lieferscheine',
        icon: Truck,
        children: [
          { labelKey: 'nav.lieferscheine_erstellen', path: '/lieferscheine/erstellen' },
          { labelKey: 'nav.lieferscheine_uebersicht', path: '/lieferscheine/uebersicht' },
          { labelKey: 'nav.lieferscheine_suche', path: '/lieferscheine/suche' },
          { labelKey: 'nav.lieferscheine_meine', path: '/lieferscheine/meine' },
        ],
      },
      {
        labelKey: 'nav.artikel',
        icon: Package,
        children: [
          { labelKey: 'nav.artikel_katalog', path: '/artikel/katalog' },
          { labelKey: 'nav.artikel_bestand', path: '/artikel/bestand' },
          { labelKey: 'nav.artikel_leihartikel', path: '/artikel/leihartikel' },
          { labelKey: 'nav.artikel_wareneingang', path: '/artikel/wareneingang' },
          { labelKey: 'nav.artikel_reparaturuebersicht', path: '/artikel/reparaturuebersicht' },
        ],
      },
      {
        labelKey: 'nav.trocknungsgeraete',
        icon: Wind,
        children: [
          { labelKey: 'nav.trocknungsgeraete_dashboard', path: '/trocknungsgeraete/dashboard' },
          { labelKey: 'nav.trocknungsgeraete_auflistung', path: '/trocknungsgeraete/auflistung' },
          { labelKey: 'nav.trocknungsgeraete_verwalten', path: '/trocknungsgeraete/verwalten' },
          { labelKey: 'nav.trocknungsgeraete_gruppen', path: '/trocknungsgeraete/gruppen' },
        ],
      },
      {
        labelKey: 'nav.arbeitskleidung',
        icon: Shirt,
        children: [
          { labelKey: 'nav.arbeitskleidung_uebersicht', path: '/arbeitskleidung/uebersicht' },
          { labelKey: 'nav.arbeitskleidung_eingaenge', path: '/arbeitskleidung/eingaenge' },
          { labelKey: 'nav.arbeitskleidung_ausgaenge', path: '/arbeitskleidung/ausgaenge' },
        ],
      },
      { labelKey: 'nav.lager', path: '/lager', icon: Warehouse },
      {
        labelKey: 'nav.artikelBestellungen',
        icon: ShoppingCart,
        children: [
          { labelKey: 'nav.artikelBestellungen_bestellungen', path: '/artikel-bestellungen/bestellungen' },
          { labelKey: 'nav.artikelBestellungen_lieferanten', path: '/artikel-bestellungen/lieferanten' },
          { labelKey: 'nav.artikelBestellungen_suche', path: '/artikel-bestellungen/suche' },
          { labelKey: 'nav.artikelBestellungen_wareneingang', path: '/artikel-bestellungen/wareneingang' },
        ],
      },
    ],
  },
  {
    labelKey: 'nav.groupWeiteres',
    items: [
      {
        labelKey: 'nav.benutzer',
        icon: UserCog,
        children: [
          { labelKey: 'nav.benutzer_mitarbeiter', path: '/benutzer/mitarbeiter' },
          { labelKey: 'nav.benutzer_berechtigungen', path: '/benutzer/berechtigungen' },
        ],
      },
      {
        labelKey: 'nav.einstellungen',
        icon: Settings,
        children: [
          { labelKey: 'nav.einstellungen_allgemein', path: '/einstellungen/allgemein' },
          { labelKey: 'nav.einstellungen_benachrichtigungen', path: '/einstellungen/benachrichtigungen' },
          { labelKey: 'nav.einstellungen_inventur', path: '/einstellungen/inventur' },
          { labelKey: 'nav.einstellungen_firmen', path: '/einstellungen/firmen' },
          { labelKey: 'nav.einstellungen_gewerke', path: '/einstellungen/gewerke' },
          { labelKey: 'nav.einstellungen_emailWhatsapp', path: '/einstellungen/email-whatsapp-inhalte' },
          { labelKey: 'nav.einstellungen_sprachen', path: '/einstellungen/sprachen' },
          { labelKey: 'nav.einstellungen_laender', path: '/einstellungen/laender' },
          { labelKey: 'nav.einstellungen_orte', path: '/einstellungen/orte' },
          { labelKey: 'nav.einstellungen_positionen', path: '/einstellungen/positionen' },
          { labelKey: 'nav.einstellungen_placeholder', path: '/einstellungen/placeholder' },
          { labelKey: 'nav.einstellungen_logs', path: '/einstellungen/logs' },
        ],
      },
      {
        labelKey: 'nav.sonstiges',
        icon: MoreHorizontal,
        children: [
          { labelKey: 'nav.sonstiges_statistik', path: '/sonstiges/statistik' },
          { labelKey: 'nav.sonstiges_konfliktfaelle', path: '/sonstiges/konfliktfaelle' },
          { labelKey: 'nav.sonstiges_bestellungen', path: '/sonstiges/bestellungen' },
          { labelKey: 'nav.sonstiges_rechnungsvorlagen', path: '/sonstiges/rechnungsvorlagen' },
        ],
      },
    ],
  },
]

// Flache Liste aller Seiten mit ihrem Breadcrumb-Pfad (als i18n-Keys), für
// die Routen-Erzeugung. Die Übersetzung passiert erst beim Rendern in App.jsx.
export function flattenPages() {
  const pages = []
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.children) {
        for (const child of item.children) {
          pages.push({
            path: child.path,
            titleKey: child.labelKey,
            breadcrumbKeys: [group.labelKey, item.labelKey, child.labelKey],
          })
        }
      } else {
        pages.push({
          path: item.path,
          titleKey: item.labelKey,
          breadcrumbKeys: [group.labelKey, item.labelKey],
        })
      }
    }
  }
  return pages
}
