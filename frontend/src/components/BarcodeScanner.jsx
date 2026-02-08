import { useState, useEffect, useRef } from 'react'

/**
 * BarcodeScanner Component
 *
 * Handles USB barcode scanner input with the following features:
 * - Auto-focuses on mount and maintains focus
 * - Accumulates rapid keystrokes (scanners type fast)
 * - Triggers onScan callback when Enter key is pressed
 * - Provides visual feedback during scanning
 * - Allows manual entry as fallback
 *
 * USB barcode scanners typically:
 * - Send characters very quickly (< 50ms between chars)
 * - Append Enter key after the barcode
 * - Act as keyboard input devices
 *
 * @param {function} onScan - Callback function triggered when barcode is scanned (Enter pressed)
 * @param {string} placeholder - Input placeholder text
 * @param {boolean} autoFocus - Auto-focus input on mount (default: true)
 * @param {boolean} disabled - Disable the input
 * @param {string} value - Controlled value (optional)
 * @param {function} onChange - Controlled onChange handler (optional)
 * @param {string} className - Additional CSS classes
 */
function BarcodeScanner({
  onScan,
  placeholder = "Scan or type barcode...",
  autoFocus = true,
  disabled = false,
  value = "",
  onChange = null,
  className = ""
}) {
  const [localValue, setLocalValue] = useState(value)
  const [isScanning, setIsScanning] = useState(false)
  const inputRef = useRef(null)
  const scanTimeoutRef = useRef(null)

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus()
    }
  }, [autoFocus, disabled])

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (e) => {
    const newValue = e.target.value
    setLocalValue(newValue)

    // Call external onChange if provided
    if (onChange) {
      onChange(newValue)
    }

    // Visual feedback: detect rapid input (likely scanner)
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    setIsScanning(true)
    scanTimeoutRef.current = setTimeout(() => {
      setIsScanning(false)
    }, 100)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && localValue.trim()) {
      e.preventDefault()
      setIsScanning(false)
      onScan(localValue.trim())
      // Clear after scan
      setLocalValue('')
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-white transition-all ${
          isScanning ? 'border-primary-500 ring-2 ring-primary-500/50' : 'border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-primary-500 ${className}`}
        autoComplete="off"
        spellCheck="false"
      />
      {isScanning && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-pulse text-primary-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

export default BarcodeScanner
