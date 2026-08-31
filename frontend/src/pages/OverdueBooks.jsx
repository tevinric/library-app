import { useState, useEffect } from 'react'
import {
  getOverdueActive, getFines, settleFines, unpayFine, getFineTransactions,
  createFollowUp, deleteFollowUp
} from '../api'
import { AlertIcon, CurrencyIcon, ReceiptIcon, LinkIcon, CheckIcon, UsersIcon } from '../components/Icons'

const formatRand = (amount) => `R ${Number(amount || 0).toFixed(2)}`
const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—'
const formatDateTime = (d) => d ? new Date(d).toLocaleString() : '—'
const initials = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?'

// One borrower row used by both the "Overdue Now" and "All Fines" lists —
// same shape, different accent color/metric, so it isn't duplicated per tab.
function BorrowerRow({ grp, accent, metricLabel, metricValue, metricClassName, secondaryValue, secondaryLabel, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-700/60 hover:bg-gray-700 rounded-lg p-4 flex items-center gap-4 cursor-pointer transition-colors border border-transparent hover:border-gray-600"
    >
      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md`}>
        {initials(grp.first_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{grp.first_name}</p>
        <p className="text-gray-400 text-sm font-mono">ID: {grp.borrower_code}</p>
      </div>
      <div className="text-center flex-shrink-0 px-3 hidden sm:block">
        <p className="text-white font-semibold">{grp.book_count ?? grp.books.length}</p>
        <p className="text-xs text-gray-500">book{(grp.book_count ?? grp.books.length) !== 1 ? 's' : ''}</p>
      </div>
      {secondaryValue != null && (
        <div className="text-center flex-shrink-0 px-3 hidden md:block">
          <p className="text-warning-400 font-semibold">{secondaryValue}</p>
          <p className="text-xs text-gray-500">{secondaryLabel}</p>
        </div>
      )}
      <div className="text-right flex-shrink-0">
        <p className={`text-lg font-bold ${metricClassName}`}>{metricValue}</p>
        <p className="text-xs text-gray-500">{metricLabel}</p>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
      status === 'Paid' ? 'bg-success-900/50 text-success-300' : 'bg-warning-900/50 text-warning-300'
    }`}>
      {status}
    </span>
  )
}

function OverdueBooks() {
  const [tab, setTab] = useState('overdue') // 'overdue' | 'fines' | 'transactions'
  const [overdueGroups, setOverdueGroups] = useState([])
  const [fineGroups, setFineGroups] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [txLoaded, setTxLoaded] = useState(false)
  const [selected, setSelected] = useState(null) // { ...group, __tab }
  const [selectedFineIds, setSelectedFineIds] = useState(new Set())
  const [busyCheckoutIds, setBusyCheckoutIds] = useState(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (tab === 'transactions' && !txLoaded) loadTransactions() }, [tab])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [overdueRes, finesRes] = await Promise.all([getOverdueActive(), getFines()])
      setOverdueGroups(overdueRes.data)
      setFineGroups(finesRes.data)
      setSelected(prev => {
        if (!prev) return prev
        const source = prev.__tab === 'fines' ? finesRes.data : overdueRes.data
        const refreshed = source.find(g => g.borrower_id === prev.borrower_id)
        return refreshed ? { ...refreshed, __tab: prev.__tab } : null
      })
    } catch (error) {
      console.error('Error loading overdue/fines data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async () => {
    try {
      setTxLoading(true)
      const response = await getFineTransactions()
      setTransactions(response.data)
      setTxLoaded(true)
    } catch (error) {
      console.error('Error loading fine transactions:', error)
    } finally {
      setTxLoading(false)
    }
  }

  const openBorrower = (grp, fromTab) => {
    setSelected({ ...grp, __tab: fromTab })
    setSelectedFineIds(new Set())
  }

  const closeModal = () => {
    setSelected(null)
    setSelectedFineIds(new Set())
  }

  // Cross-links between tabs replace what used to be separate pages —
  // no URL params, just switch tab and re-open the same borrower.
  const jumpToBorrower = (borrowerId, targetTab) => {
    setTab(targetTab)
    const source = targetTab === 'fines' ? fineGroups : overdueGroups
    const grp = source.find(g => g.borrower_id === borrowerId)
    setSelected(grp ? { ...grp, __tab: targetTab } : null)
    setSelectedFineIds(new Set())
  }

  const toggleSelectFine = (fineId) => {
    setSelectedFineIds(prev => {
      const next = new Set(prev)
      if (next.has(fineId)) next.delete(fineId)
      else next.add(fineId)
      return next
    })
  }

  const refreshAfterPaymentChange = async () => {
    await loadAll()
    if (txLoaded) await loadTransactions()
  }

  const handleSettle = async (fineIds) => {
    if (fineIds.length === 0) return
    try {
      setBusy(true)
      await settleFines(fineIds)
      setSelectedFineIds(new Set())
      await refreshAfterPaymentChange()
    } catch (error) {
      alert('Error settling fine(s): ' + error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleUnpay = async (fineId) => {
    try {
      setBusy(true)
      await unpayFine(fineId)
      await refreshAfterPaymentChange()
    } catch (error) {
      alert('Error reversing payment: ' + error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleReverseTransaction = async (txn) => {
    if (!txn.reversible || busy) return
    if (!confirm(`Reverse the ${formatRand(txn.amount)} payment for "${txn.title}"?`)) return
    try {
      setBusy(true)
      await unpayFine(txn.fine_id)
      await Promise.all([loadTransactions(), loadAll()])
    } catch (error) {
      alert('Error reversing payment: ' + error.message)
    } finally {
      setBusy(false)
    }
  }

  const updateBookInState = (checkoutId, changes) => {
    const apply = (list) => list.map(grp => ({
      ...grp,
      books: grp.books.map(bk => bk.checkout_id === checkoutId ? { ...bk, ...changes } : bk)
    }))
    setOverdueGroups(apply)
    setSelected(prev => prev ? {
      ...prev,
      books: prev.books.map(bk => bk.checkout_id === checkoutId ? { ...bk, ...changes } : bk)
    } : prev)
  }

  const toggleFollowUp = async (book) => {
    const isLocked = book.follow_up_id && book.follow_up_status !== 'Pending'
    if (isLocked || busyCheckoutIds.has(book.checkout_id)) return

    setBusyCheckoutIds(prev => new Set([...prev, book.checkout_id]))
    try {
      if (book.follow_up_id) {
        await deleteFollowUp(book.follow_up_id)
        updateBookInState(book.checkout_id, { follow_up_id: null, follow_up_status: null })
      } else {
        const response = await createFollowUp({
          checkout_id: book.checkout_id,
          reason: `Flagged from Overdue Books — ${book.days_overdue} day${book.days_overdue !== 1 ? 's' : ''} overdue`
        })
        updateBookInState(book.checkout_id, { follow_up_id: response.data.id, follow_up_status: response.data.status })
      }
    } catch (error) {
      if (error.response?.status === 400) {
        // Someone else already created/changed it — resync from the server
        await loadAll()
      } else {
        alert('Error updating follow-up: ' + error.message)
      }
    } finally {
      setBusyCheckoutIds(prev => {
        const next = new Set(prev)
        next.delete(book.checkout_id)
        return next
      })
    }
  }

  const unpaidIdsFor = (grp) => grp.books.filter(b => b.status === 'Unpaid').map(b => b.fine_id)
  const hasUnpaid = (grp) => grp.books.some(b => b.status === 'Unpaid')
  const hasPaidHistory = (grp) => grp.books.some(b => b.status === 'Paid')
  const hasActiveOverdueBooks = (grp) => grp?.books?.some(b => b.checkout_status === 'Checked Out')

  const booksOverdueCount = overdueGroups.reduce((s, g) => s + (g.book_count ?? g.books.length), 0)
  const totalOutstanding = fineGroups.reduce((s, g) => s + Number(g.total_outstanding || 0), 0)
  const totalCollected = fineGroups.reduce((s, g) => s + Number(g.total_paid || 0), 0)

  if (loading && overdueGroups.length === 0 && fineGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="icon-circle from-danger-500 to-danger-600 w-12 h-12">
          <AlertIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Overdue & Fines</h1>
          <p className="text-gray-400 mt-1">Track overdue books, manage fines, and review payment history</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-danger-500 to-danger-600">
              <AlertIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Books Overdue</p>
              <p className="text-xl sm:text-2xl font-bold text-danger-400 leading-tight mt-0.5">{booksOverdueCount}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{overdueGroups.length} borrower{overdueGroups.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-primary-500 to-primary-600">
              <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Borrowers Affected</p>
              <p className="stat-number leading-tight mt-0.5">{overdueGroups.length}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Currently overdue</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-warning-500 to-warning-600">
              <CurrencyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Outstanding</p>
              <p className="text-xl sm:text-2xl font-bold text-warning-400 leading-tight mt-0.5">{formatRand(totalOutstanding)}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Unpaid fines</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="stat-icon from-success-500 to-success-600">
              <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">Collected</p>
              <p className="text-xl sm:text-2xl font-bold text-success-400 leading-tight mt-0.5">{formatRand(totalCollected)}</p>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Fines paid to date</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 overflow-x-auto">
        <button
          onClick={() => setTab('overdue')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            tab === 'overdue' ? 'border-danger-500 text-danger-400' : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Overdue Now
          {overdueGroups.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-danger-900/60 text-danger-300">{overdueGroups.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('fines')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            tab === 'fines' ? 'border-warning-500 text-warning-400' : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          All Fines
          {fineGroups.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-warning-900/60 text-warning-300">{fineGroups.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('transactions')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            tab === 'transactions' ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ReceiptIcon className="w-4 h-4" />
          Transaction Log
        </button>
      </div>

      {/* Overdue Now */}
      {tab === 'overdue' && (
        overdueGroups.length === 0 ? (
          <div className="card text-center py-10">
            <div className="icon-circle from-success-500 to-success-600 w-14 h-14 mx-auto mb-4">
              <CheckIcon className="w-7 h-7 text-white" />
            </div>
            <p className="text-white font-semibold">Nothing overdue right now</p>
            <p className="text-gray-400 text-sm mt-1">Every borrowed book is within its due date</p>
          </div>
        ) : (
          <div className="card">
            <div className="space-y-3">
              {overdueGroups.map((grp) => (
                <BorrowerRow
                  key={grp.borrower_id}
                  grp={grp}
                  accent="from-danger-500 to-danger-700"
                  metricLabel="longest overdue"
                  metricValue={`${grp.max_days_overdue}d`}
                  metricClassName="text-danger-400"
                  secondaryValue={formatRand(grp.total_outstanding)}
                  secondaryLabel="fine due"
                  onClick={() => openBorrower(grp, 'overdue')}
                />
              ))}
            </div>
          </div>
        )
      )}

      {/* All Fines */}
      {tab === 'fines' && (
        fineGroups.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-400">No fines on record</p>
          </div>
        ) : (
          <div className="card">
            <div className="space-y-3">
              {fineGroups.map((grp) => (
                <BorrowerRow
                  key={grp.borrower_id}
                  grp={grp}
                  accent="from-primary-500 to-primary-700"
                  metricLabel="balance due"
                  metricValue={formatRand(grp.total_outstanding)}
                  metricClassName={grp.total_outstanding > 0 ? 'text-danger-400' : 'text-success-400'}
                  onClick={() => openBorrower(grp, 'fines')}
                />
              ))}
            </div>
          </div>
        )
      )}

      {/* Transaction Log */}
      {tab === 'transactions' && (
        <div className="card">
          {txLoading && transactions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No fine payment activity yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-700">
                    <th className="pb-3 pr-4 font-medium">When</th>
                    <th className="pb-3 pr-4 font-medium">Borrower</th>
                    <th className="pb-3 pr-4 font-medium">Book</th>
                    <th className="pb-3 pr-4 font-medium">Action</th>
                    <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Processed By</th>
                    <th className="pb-3 font-medium text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/60">
                  {transactions.map((txn) => (
                    <tr key={txn.payment_id} className="text-gray-300">
                      <td className="py-3 pr-4 whitespace-nowrap text-gray-400">{formatDateTime(txn.occurred_at)}</td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={() => jumpToBorrower(txn.borrower_id, 'fines')}
                          className="text-primary-400 hover:text-primary-300 font-medium text-left"
                        >
                          {txn.first_name}
                        </button>
                        <p className="text-gray-500 text-xs font-mono">{txn.borrower_code}</p>
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        <p className="truncate">{txn.title}</p>
                        <p className="text-gray-500 text-xs">Copy #{txn.copy_number}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          txn.action === 'Paid' ? 'bg-success-900/50 text-success-300' : 'bg-gray-600/60 text-gray-300'
                        }`}>
                          {txn.action}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-warning-400 whitespace-nowrap">
                        {formatRand(txn.amount)}
                      </td>
                      <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{txn.processed_by_email || '—'}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        {txn.reversible && (
                          <button
                            onClick={() => handleReverseTransaction(txn)}
                            disabled={busy}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Borrower detail modal — shared by Overdue Now and All Fines */}
      {selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selected.first_name}</h2>
                <p className="text-primary-400 font-mono text-sm">ID: {selected.borrower_code}</p>
              </div>
              <div className="flex items-center gap-4">
                {selected.__tab === 'overdue' && hasPaidHistory(selected) && (
                  <button
                    onClick={() => jumpToBorrower(selected.borrower_id, 'fines')}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
                    title="View this borrower's full fine & payment history"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Full Fine History
                  </button>
                )}
                {selected.__tab === 'fines' && hasActiveOverdueBooks(selected) && (
                  <button
                    onClick={() => jumpToBorrower(selected.borrower_id, 'overdue')}
                    className="flex items-center gap-1.5 text-xs font-medium text-danger-400 hover:text-danger-300 transition-colors"
                    title="View this borrower's active overdue books"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Overdue Now
                  </button>
                )}
                <button onClick={closeModal} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {selected.books.map((book) => {
                const isLocked = book.follow_up_id && book.follow_up_status !== 'Pending'
                return (
                  <div key={book.fine_id} className="bg-gray-700 rounded-lg p-4 flex gap-4">
                    {book.status === 'Unpaid' && (
                      <input
                        type="checkbox"
                        checked={selectedFineIds.has(book.fine_id)}
                        onChange={() => toggleSelectFine(book.fine_id)}
                        className="w-5 h-5 mt-1 flex-shrink-0"
                      />
                    )}
                    {(book.cover_medium || book.cover_large) && (
                      <img
                        src={book.cover_medium || book.cover_large}
                        alt={book.title}
                        className="w-14 h-auto rounded shadow flex-shrink-0"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{book.title}</p>
                      <p className="text-gray-400 text-sm">by {book.author} · Copy #{book.copy_number}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                        <div>
                          <p className="text-gray-500">Due</p>
                          <p className="text-gray-300">{formatDate(book.due_date)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Days Overdue</p>
                          <p className="text-danger-400 font-semibold">{book.days_overdue}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Rate Applied</p>
                          <p className="text-gray-300">{formatRand(book.rate_applied)}/day</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Amount</p>
                          <p className="text-warning-400 font-semibold">{formatRand(book.amount)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <StatusPill status={book.status} />
                        {book.checkout_status && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-600/60 text-gray-300">
                            {book.checkout_status}
                          </span>
                        )}
                        {book.status === 'Paid' && (
                          <span className="text-xs text-gray-500">
                            {formatDateTime(book.paid_at)}{book.paid_by_email ? ` · by ${book.paid_by_email}` : ''}
                          </span>
                        )}
                      </div>
                      {selected.__tab === 'overdue' && (
                        <label className={`inline-flex items-center gap-1.5 mt-2 text-xs ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!book.follow_up_id}
                            disabled={isLocked || busyCheckoutIds.has(book.checkout_id)}
                            onChange={() => toggleFollowUp(book)}
                            className="w-4 h-4"
                          />
                          <span className={isLocked ? 'text-gray-500' : 'text-gray-300'}>
                            {isLocked ? `In Follow Ups (${book.follow_up_status})` : 'Add to Follow Ups'}
                          </span>
                        </label>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {book.status === 'Unpaid' ? (
                        <button
                          onClick={() => handleSettle([book.fine_id])}
                          disabled={busy}
                          className="btn-success text-xs px-3 py-2"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnpay(book.fine_id)}
                          disabled={busy}
                          className="btn-secondary text-xs px-3 py-2"
                        >
                          Undo Payment
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-600 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Balance Due</span>
                <span className="text-2xl font-bold text-danger-400">
                  {formatRand(selected.books.filter(b => b.status === 'Unpaid').reduce((s, b) => s + Number(b.amount || 0), 0))}
                </span>
              </div>
              {hasUnpaid(selected) && (
                <div className="flex flex-wrap gap-3 justify-end">
                  <button
                    onClick={() => handleSettle([...selectedFineIds])}
                    disabled={busy || selectedFineIds.size === 0}
                    className="btn-secondary"
                  >
                    Settle Selected ({selectedFineIds.size})
                  </button>
                  <button
                    onClick={() => handleSettle(unpaidIdsFor(selected))}
                    disabled={busy}
                    className="btn-success"
                  >
                    Settle All Outstanding
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OverdueBooks
