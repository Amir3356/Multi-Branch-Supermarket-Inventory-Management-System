import { useDispatch, useSelector } from 'react-redux'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { saveExpiryWarningDays, saveMinStockLevel } from '../features/policy/store/policyThunks'
import PolicyForm from '../features/policy/components/PolicyForm'
import './PolicyPage.css'

export default function PolicyPage() {
  const dispatch = useDispatch()
  const settings = useSelector(selectSettings)

  // Each setting is only logged in the Audit Log when it actually changed
  const handleSave = ({ minStock, expiryDays }) => {
    dispatch(saveMinStockLevel(minStock))
    dispatch(saveExpiryWarningDays(expiryDays))
  }

  return (
    <div className="content-section-card settings-panel">
      <div className="section-header">
        <div>
          <h2 className="page-title">Policy</h2>
          <p className="page-desc">Applies to every product at all branches.</p>
        </div>
      </div>

      <PolicyForm settings={settings} onSave={handleSave} />
    </div>
  )
}
