// Mirrors the API rule: at least 8 characters with letters and numbers
export function validateNewPassword(password, confirmation) {
  const errors = {}
  if (!password) errors.password = 'Password is required'
  else if (password.length < 8) errors.password = 'Use at least 8 characters'
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = 'Use both letters and numbers'
  if (!confirmation) errors.password_confirmation = 'Confirm your password'
  else if (password && confirmation !== password) errors.password_confirmation = 'Passwords do not match'
  return errors
}
