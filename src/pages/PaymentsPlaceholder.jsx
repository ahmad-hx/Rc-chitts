import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Toast from '../components/Toast';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { Download, Search, Plus, Filter, RotateCcw } from 'lucide-react';
import { paymentService } from '../services/dbService';

export default function PaymentsPlaceholder() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Advanced Multi-filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
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
    return () => {
      mounted = false;
    };
  }, []);

  const filteredTransactions = transactions.filter((txn) => {
    const sq = searchQuery.toLowerCase();
    const matchesSearch =
      !sq ||
      (txn.member && txn.member.toLowerCase().includes(sq)) ||
      (txn.id && txn.id.toLowerCase().includes(sq)) ||
      (txn.phone && txn.phone.includes(sq)) ||
      (txn.group && txn.group.toLowerCase().includes(sq));

    const txnYear = txn.date ? new Date(txn.date).getFullYear().toString() : '2026';
    const txnMonth = txn.date ? new Date(txn.date).toLocaleString('en-US', { month: 'long' }).toLowerCase() : 'august';

    const matchesYear = yearFilter === 'all' || txnYear === yearFilter;
    const matchesMonth = monthFilter === 'all' || txnMonth === monthFilter.toLowerCase();
    const matchesMethod = methodFilter === 'all' || (txn.type && txn.type.toLowerCase() === methodFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (txn.status && txn.status.toLowerCase() === statusFilter.toLowerCase());

    return matchesSearch && matchesYear && matchesMonth && matchesMethod && matchesStatus;
  });

  const handleRecordPayment = (newTxn) => {
    setTransactions([newTxn, ...transactions]);
    showToast(`Payment of ₹${newTxn.amount.toLocaleString('en-IN')} recorded for ${newTxn.member}!`);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setYearFilter('all');
    setMonthFilter('all');
    setMethodFilter('all');
    setStatusFilter('all');
    showToast('Payment ledger filters reset.');
  };

  const handleExportLedger = () => {
    if (filteredTransactions.length === 0) {
      showToast('No payment transactions to export.', 'error');
      return;
    }

    const headers = ['Transaction ID', 'Member Name', 'Phone', 'Chit Group', 'Amount (INR)', 'Date', 'Payment Method', 'Status', 'Note'];
    const rows = filteredTransactions.map((t) => [
      t.id,
      `"${t.member}"`,
      `"${t.phone || ''}"`,
      t.group,
      t.amount,
      t.date,
      t.type,
      t.status,
      `"${t.note || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Raghavendra_Chitts_Payment_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredTransactions.length} transactions to CSV file!`);
  };

  const getStatusVariant = (status = '') => {
    const s = String(status).toLowerCase();
    switch (s) {
      case 'cleared':
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'info';
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">Accounting & Audit</p>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Payment History Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track monthly premium receipts, filter by Year/Month/Group, and export verified financial reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="gap-2 rounded-2xl cursor-pointer" onClick={handleExportLedger}>
            <Download className="w-4 h-4 text-sky-700" />
            Export Ledger CSV
          </Button>

          <Button variant="primary" className="gap-2 rounded-2xl cursor-pointer" onClick={() => setIsRecordModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* MULTI-FILTER BAR */}
      <Card className="border border-slate-200 bg-white p-5 rounded-3xl shadow-xs space-y-4">
        <div className="flex items-center justify-between font-bold text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>Financial Ledger Search & Filters</span>
          </div>
          <button onClick={handleResetFilters} className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search member, ID, or group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* YEAR */}
          <div>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Years</option>
              {['2026', '2025', '2024', '2023', '2022', '2021', '2020'].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* MONTH */}
          <div>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Months</option>
              {[
                'January',
                'February',
                'March',
                'April',
                'May',
                'June',
                'July',
                'August',
                'September',
                'October',
                'November',
                'December',
              ].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* METHOD */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Payment Methods</option>
              <option value="UPI / GPay">UPI / GPay</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash Receipt">Cash Receipt</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          {/* STATUS */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="cleared">Cleared / Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </Card>

      {/* TRANSACTIONS TABLE FOR DESKTOP / CARDS FOR MOBILE */}
      <Card className="border border-slate-200 bg-white rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold text-sm">Loading payment records...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-bold text-sm">No payment records found matching your filters.</div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Txn ID & Date</th>
                    <th className="px-6 py-4">Member Name</th>
                    <th className="px-6 py-4">Chit Group</th>
                    <th className="px-6 py-4">Amount Paid</th>
                    <th className="px-6 py-4">Payment Method</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-800">
                        {txn.id}
                        <span className="block text-[11px] font-normal text-slate-500">{txn.date}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">{txn.member}</span>
                        <span className="text-[11px] text-slate-500">{txn.phone || ''}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">{txn.group}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-black text-slate-900 text-sm">
                        ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-600">{txn.type || 'UPI / Cash'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(txn.status)}>{String(txn.status || 'cleared').toUpperCase()}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-slate-500">
                        {txn.recordedBy || 'Admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredTransactions.map((txn) => (
                <div key={txn.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{txn.member}</span>
                    <Badge variant={getStatusVariant(txn.status)}>{String(txn.status || 'cleared').toUpperCase()}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>{txn.group}</span>
                    <span className="font-black text-slate-900 text-sm font-sans">₹{Number(txn.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Date: {txn.date}</span>
                    <span>Method: {txn.type || 'UPI'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* RECORD PAYMENT MODAL */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onRecord={handleRecordPayment}
      />
    </div>
  );
}
