import React, { useState } from 'react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Toast from '../components/Toast';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { Download, Search, Plus } from 'lucide-react';
import { paymentService } from '../services/dbService';

export default function PaymentsPlaceholder() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  React.useEffect(() => {
    let mounted = true;
    async function loadPaymentsFromDb() {
      setLoading(true);
      setError(null);
      try {
        const fetched = await paymentService.getPayments();
        if (mounted) {
          setTransactions(Array.isArray(fetched) ? fetched : []);
        }
      } catch (e) {
        if (mounted) {
          setError('Unable to load payments from Firebase.');
          setTransactions([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPaymentsFromDb();
    return () => { mounted = false; };
  }, []);

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      txn.member.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (txn.phone && txn.phone.includes(searchQuery));
    const matchesMethod = methodFilter === 'all' || txn.type === methodFilter;
    const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const handleRecordPayment = (newTxn) => {
    setTransactions([newTxn, ...transactions]);
    showToast(`Payment of ₹${newTxn.amount.toLocaleString('en-IN')} recorded for ${newTxn.member}!`);
  };

  // REAL CSV EXPORT FUNCTIONALITY
  const handleExportLedger = () => {
    if (filteredTransactions.length === 0) {
      showToast('No payment transactions to export.', 'error');
      return;
    }

    const headers = ['Transaction ID', 'Member Name', 'Phone', 'Chit Group', 'Amount (INR)', 'Date', 'Payment Method', 'Status', 'Note'];
    const rows = filteredTransactions.map(t => [
      t.id,
      `"${t.member}"`,
      `"${t.phone || ''}"`,
      t.group,
      t.amount,
      t.date,
      t.type,
      t.status,
      `"${t.note || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Raghavendra_Chitts_Payment_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredTransactions.length} transactions to CSV file!`);
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'cleared': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'info';
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">Accounting</p>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Payment Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">Track monthly premium collections, audit ledger transactions, and export accounting reports.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="gap-2 rounded-2xl cursor-pointer"
            onClick={handleExportLedger}
          >
            <Download className="w-4 h-4 text-sky-700" />
            Export Ledger CSV
          </Button>

          <Button
            variant="primary"
            className="gap-2 rounded-2xl cursor-pointer"
            onClick={() => setIsRecordModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <Card className="border border-slate-200 bg-white p-4 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 max-w-md w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search payments by member, phone, or TXN ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-bold"
            >
              <option value="all">All Payment Methods</option>
              <option value="online">Online / UPI</option>
              <option value="cash">Cash Counter</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer font-bold"
            >
              <option value="all">All Statuses</option>
              <option value="cleared">Cleared</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ERROR & LOADING STATES */}
      {error && (
        <Card className="p-8 border border-red-200 bg-red-50 text-center rounded-3xl">
          <p className="text-sm font-bold text-red-800">{error}</p>
        </Card>
      )}

      {loading && !error && (
        <Card className="p-8 border border-slate-200 bg-white text-center rounded-3xl">
          <p className="text-sm font-bold text-slate-600">Loading payments from Firebase...</p>
        </Card>
      )}

      {!loading && !error && transactions.length === 0 && (
        <Card className="p-8 border border-slate-200 bg-white text-center rounded-3xl">
          <p className="text-sm font-bold text-slate-700">No payments found.</p>
        </Card>
      )}

      {/* DESKTOP TABLE */}
      {!loading && !error && transactions.length > 0 && (
        <>
          <div className="hidden md:block overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transaction ID</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Member</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chit Group</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-xs">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No payment transactions found matching your filters.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-600">{txn.id}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{txn.member}</p>
                    {txn.phone && <p className="text-[10px] text-slate-400 font-sans">{txn.phone}</p>}
                  </td>
                  <td className="px-6 py-4 font-bold text-sky-800">Group {txn.group}</td>
                  <td className="px-6 py-4 font-black text-slate-900 font-sans text-sm">
                    ₹{txn.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">{txn.date}</td>
                  <td className="px-6 py-4 uppercase font-bold text-[10px] text-slate-600">
                    {txn.type.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={getStatusVariant(txn.status)}>
                      {txn.status.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE LIST CARDS VIEW */}
      <div className="md:hidden space-y-4">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-sm text-slate-500">
            No payment transactions found matching your filters.
          </div>
        ) : (
          filteredTransactions.map((txn) => (
            <Card key={txn.id} className="border border-slate-200 bg-white rounded-3xl p-5 text-xs space-y-3 shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="font-mono font-bold text-slate-600">{txn.id}</span>
                <Badge variant={getStatusVariant(txn.status)}>
                  {txn.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Member:</span>
                <span className="font-bold text-slate-900">{txn.member}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Chit Group:</span>
                <span className="font-bold text-sky-800">Group {txn.group}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Amount:</span>
                <span className="font-black text-slate-900 font-sans text-sm">₹{txn.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Method: {txn.type.toUpperCase()}</span>
                <span className="font-mono">{txn.date}</span>
              </div>
            </Card>
          ))
        )}
      </div>
        </>
      )}

      {/* RECORD PAYMENT MODAL */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onRecord={handleRecordPayment}
      />
    </div>
  );
}
