import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { formatMoneyIn } from '../utils'
import { selectSettings } from '../features/policy/settingsSlice'

// formatMoney(value) in the pharmacy's configured currency
export function useFormatMoney() {
  const { currency } = useSelector(selectSettings)
  return useCallback((value) => formatMoneyIn(currency, value), [currency])
}
