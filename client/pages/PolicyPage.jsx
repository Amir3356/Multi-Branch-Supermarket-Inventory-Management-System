import { useDispatch, useSelector } from 'react-redux'
import { selectSettings } from '../features/policy/settingsSlice'
import { saveMinStockLevel } from '../features/policy/policyThunks'
import MinStockLevelForm from '../features/policy/MinStockLevelForm'
import './PolicyPage.css'

export default function PolicyPage() {
  const dispatch = useDispatch()
  const settings = useSelector(selectSettings)
  return <MinStockLevelForm settings={settings} onSave={(next) => dispatch(saveMinStockLevel(next.defaultMinStock))} />
}
