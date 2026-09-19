import { useTranslation } from 'react-i18next'

export default function StatusBadge({ active }) {
  const { t } = useTranslation()
  return (
    <span className={'status-badge ' + (active ? 'status-badge-active' : 'status-badge-inactive')}>
      {active ? t('common.active') : t('common.inactive')}
    </span>
  )
}
