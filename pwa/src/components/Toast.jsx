import { useEffect, useState, useCallback } from 'react'

/** Simple toast hook: const { toast, show } = useToast(); {toast} in JSX */
export function useToast() {
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), msg.error ? 3500 : 1600)
    return () => clearTimeout(t)
  }, [msg])

  const show = useCallback((text, { error = false } = {}) => setMsg({ text, error }), [])

  const toast = msg ? (
    <div className={`toast ${msg.error ? 'toast--error' : ''}`} role="status">
      {msg.text}
    </div>
  ) : null

  return { toast, show }
}
