import React, { useState } from 'react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Toast from '../components/Toast';
import CreateChitModal from '../components/CreateChitModal';
import Modal from '../components/Modal';
import { Calendar, Users, ArrowRight, Plus, Layers, Gavel, CheckCircle2 } from 'lucide-react';
import { chitService, memberService, groupPaymentSettingsService } from '../services/dbService';

export default function ChitsPlaceholder() {
  const [chits, setChits] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupPaymentSettings, setGroupPaymentSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChitLedger, setSelectedChitLedger] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  React.useEffect(() => {
    let mounted = true;
    async function loadChitData() {
      setLoading(true);
      setError(null);
      try {
        const [fetchedChits, fetchedMembers, settingsRes] = await Promise.all([
          chitService.getChits(),
          memberService.getMembers(),
          groupPaymentSettingsService.getGroupPaymentSettings().catch(() => ({ settingsMap: {} })),
        ]);
        if (mounted) {
          setChits(Array.isArray(fetchedChits) ? fetchedChits : []);
          setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
          setGroupPaymentSettings(settingsRes?.settingsMap || {});
        }
      } catch (e) {
        if (mounted) {
          setError('Unable to load data from Firebase.');
          setChits([]);
          setMembers([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadChitData();
    return () => { mounted = false; };
  }, []);

  const getGroupMonthlyPremium = (group) => {
    const val = group?.totalChitValue || 100000;
    const grp = group?.groupId || 'I';
    const key = `${val}_${grp}`;
    if (typeof groupPaymentSettings[key] === 'number' && groupPaymentSettings[key] > 0) {
      return groupPaymentSettings[key];
    }
    return group?.monthlyPremium || Math.floor(val / 20);
  };

  const handleChitCreated = (newGroup) => {
    setChits([newGroup, ...chits]);
    showToast(`Chit Group ${newGroup.groupId} (${newGroup.name}) created successfully!`);
  };

  const getEnrolledMembers = (groupId) => {
    return members.filter(m =>
      (m.chits || []).some(c => (c.groupId === groupId) || (c.name && c.name.includes(groupId)))
    );
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
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">Portfolio</p>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Chit Groups</h1>
          <p className="text-xs text-slate-500 mt-1">View active chit fund groups, monthly premiums, capacity, next auction schedules, and full ledger details.</p>
        </div>
        <Button
          variant="primary"
          className="gap-2 rounded-2xl cursor-pointer"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Create Chit
        </Button>
      </div>

      {/* CHIT GROUP CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {chits.map((group) => {
          const enrolled = getEnrolledMembers(group.groupId);
          const enrolledCount = enrolled.length || group.currentMembers || 18;

          return (
            <Card key={group.id} className="border border-slate-200 bg-white rounded-3xl p-6 shadow-xs hover:shadow-md transition-shadow space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{group.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                      ID: {group.groupId || group.id}
                    </span>
                    <span className="text-xs text-slate-500">• {group.duration}</span>
                  </div>
                </div>
                <Badge variant="success">ACTIVE</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y border-slate-100 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Chit Value</span>
                  <span className="text-base font-black text-slate-900 font-sans">₹{(group?.totalChitValue || 100000).toLocaleString('en-IN')}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Monthly Premium</span>
                  <span className="text-base font-black text-sky-700 font-sans">₹{getGroupMonthlyPremium(group).toLocaleString('en-IN')}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Duration</span>
                  <span className="font-bold text-slate-800">{group.duration}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Capacity</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {enrolledCount} / {group.capacity} Members
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <span className="text-slate-600 font-semibold flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  Next Auction: <strong className="text-slate-900 font-mono">{group.nextAuctionDate}</strong>
                </span>

                <button
                  onClick={() => setSelectedChitLedger(group)}
                  className="text-sky-700 font-bold hover:text-sky-900 flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  View Ledger
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* CREATE CHIT MODAL */}
      <CreateChitModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleChitCreated}
      />

      {/* VIEW LEDGER MODAL */}
      {selectedChitLedger && (
        <Modal
          isOpen={!!selectedChitLedger}
          onClose={() => setSelectedChitLedger(null)}
          title={`Chit Ledger: ${selectedChitLedger.name}`}
          subtitle={`Group ID: ${selectedChitLedger?.groupId || 'N/A'} • Total Value: ₹${(selectedChitLedger?.totalChitValue || 100000).toLocaleString('en-IN')}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6">
            {/* LEDGER METRICS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Premium</span>
                <span className="font-black text-sky-700 text-sm font-sans">₹{getGroupMonthlyPremium(selectedChitLedger).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration</span>
                <span className="font-bold text-slate-900 text-sm">{selectedChitLedger.duration}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Enrolled Members</span>
                <span className="font-bold text-slate-900 text-sm">{getEnrolledMembers(selectedChitLedger.groupId).length || 18} / {selectedChitLedger.capacity}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next Auction Date</span>
                <span className="font-bold text-emerald-700 text-sm font-mono">{selectedChitLedger.nextAuctionDate}</span>
              </div>
            </div>

            {/* AUCTION HISTORY */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Gavel className="w-4 h-4 text-amber-600" />
                Past Auction Winners & Dividends
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Winner Member</th>
                      <th className="px-4 py-3">Bid Discount</th>
                      <th className="px-4 py-3">Dividend / Member</th>
                      <th className="px-4 py-3">Auction Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-sans">
                    {(selectedChitLedger.auctionHistory || []).length > 0 ? (
                      selectedChitLedger.auctionHistory.map((ah, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold">Month #{ah.month}</td>
                          <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {ah.winner}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">₹{ah.bidAmount.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 font-bold text-sky-700">₹{ah.dividend.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono">{ah.date}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">
                          First auction scheduled for {selectedChitLedger.nextAuctionDate}. No past auctions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ENROLLED MEMBERS LIST */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-600" />
                Enrolled Members ({getEnrolledMembers(selectedChitLedger.groupId).length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {getEnrolledMembers(selectedChitLedger.groupId).map((m) => (
                  <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{m.name}</p>
                      <p className="text-[10px] text-slate-500 font-sans">{m.phone}</p>
                    </div>
                    <Badge variant={m.status === 'active' ? 'success' : 'warning'}>
                      {m.status ? m.status.toUpperCase() : 'ACTIVE'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setSelectedChitLedger(null)}>
                Close Ledger
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
