import { useSelector } from 'react-redux'
import { selectAuditLogs } from '../features/auditLogs/auditLogsSlice'
import AuditLogPanel from '../features/auditLogs/AuditLogPanel'
import './AuditLogsPage.css'

export default function AuditLogsPage() {
  return <AuditLogPanel logs={useSelector(selectAuditLogs)} />
}
