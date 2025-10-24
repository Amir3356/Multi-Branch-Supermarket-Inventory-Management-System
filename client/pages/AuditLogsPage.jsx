import { useSelector } from 'react-redux'
import { selectAuditLogs } from '../features/auditLogs/store/auditLogsSlice'
import AuditLogPanel from '../features/auditLogs/components/AuditLogPanel'
import './AuditLogsPage.css'

export default function AuditLogsPage() {
  return <AuditLogPanel logs={useSelector(selectAuditLogs)} />
}
