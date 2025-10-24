import { useDispatch, useSelector } from 'react-redux'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { saveMinStockLevel } from '../features/policy/store/policyThunks'
import MinStockLevelForm from '../features/policy/components/MinStockLevelForm'
import './PolicyPage.css'

export default function PolicyPage() {
  const dispatch = useDispatch()
  const settings = useSelector(selectSettings)
  return <MinStockLevelForm settings={settings} onSave={(next) => dispatch(saveMinStockLevel(next.defaultMinStock))} />
}
