import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMcpBridge } from '../../core/mcp/client'

export function AppFrame() {
  const { t } = useTranslation()
  useMcpBridge()
  return (
    <>
      <a className="skip-link" href="#main">
        {t('common:a11y.skipToContent')}
      </a>
      <Outlet />
    </>
  )
}
