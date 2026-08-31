import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '../api'
import { SettingsIcon } from '../components/Icons'

function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ late_fee_per_day: '0.00', default_lending_days: '14' })
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await getSettings()
      setForm({
        late_fee_per_day: String(response.data.late_fee_per_day),
        default_lending_days: String(response.data.default_lending_days)
      })
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    try {
      setSaving(true)
      const response = await updateSettings({
        late_fee_per_day: form.late_fee_per_day,
        default_lending_days: form.default_lending_days
      })
      setForm({
        late_fee_per_day: String(response.data.late_fee_per_day),
        default_lending_days: String(response.data.default_lending_days)
      })
      setMessage({ type: 'success', text: 'Settings saved successfully.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Error saving settings.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="icon-circle from-primary-500 to-primary-600 w-12 h-12">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Library-wide configuration</p>
        </div>
      </div>

      <div className="card max-w-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Late Fees & Lending</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Late Fee per Day (Rands)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.late_fee_per_day}
              onChange={(e) => setForm({ ...form, late_fee_per_day: e.target.value })}
              className="w-full px-4 py-2"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Charged for every day a book is overdue: <span className="text-gray-400">days overdue × this rate</span>.
              Changing this rate updates the amount for any book that is currently overdue and not yet
              returned — it re-prices the whole overdue period, not just days going forward. Fines already
              finalized (book returned) are never affected.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default Lending Period (days)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={form.default_lending_days}
              onChange={(e) => setForm({ ...form, default_lending_days: e.target.value })}
              className="w-full px-4 py-2"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-fills the "Due in (days)" field on the Borrow page. Can still be overridden per checkout.
            </p>
          </div>

          {message && (
            <div className={message.type === 'success' ? 'alert-success' : 'alert-danger'}>
              <p className={message.type === 'success' ? 'text-success-200' : 'text-danger-200'}>
                {message.text}
              </p>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Settings
