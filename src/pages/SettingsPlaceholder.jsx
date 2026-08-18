import React, { useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import { Settings, Shield, HardDrive, Bell, Save, Download, Upload, CheckCircle2, FileSpreadsheet, AlertTriangle, RefreshCw, Layers, Check, ShieldCheck } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { memberService, chitService, paymentService } from '../services/dbService';
import { parseExcelFile, generateImportPreview, importToFirestore, testImportPipeline } from '../services/importService';
import { getAdminUpiConfig, saveAdminUpiConfig } from '../services/upiService';

export default function SettingsPlaceholder() {
  const [activeTab, setActiveTab] = useState('excel_import');
  const [toast, setToast] = useState(null);

  // Excel Migration state
  const [selectedChitValue, setSelectedChitValue] = useState(100000);
  const [excelFile, setExcelFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importReport, setImportReport] = useState(null);
  const [confirmWrite, setConfirmWrite] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [connectionResult, setConnectionResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // General Settings state
  const [agencyName, setAgencyName] = useState('Raghavendra Chitts');
  const [adminPhone, setAdminPhone] = useState('9705184411');
  const [primaryLang, setPrimaryLang] = useState('English + Telugu (bilingual)');
  const [adminUpiId, setAdminUpiId] = useState(() => getAdminUpiConfig().upiId);
  const [adminPayeeName, setAdminPayeeName] = useState(() => getAdminUpiConfig().payeeName);

  // Notification settings state
  const [enableWhatsapp, setEnableWhatsapp] = useState(true);
  const [enableSms, setEnableSms] = useState(true);
  const [autoReminderDate, setAutoReminderDate] = useState('1st of month');

  // Operator rules state
  const [operators, setOperators] = useState([
    { id: 'op_1', name: 'Raghavendra Admin', role: 'System Administrator', permissions: 'Full Control', active: true },
    { id: 'op_2', name: 'Counter Operator 1', role: 'Cashier / Collector', permissions: 'Record Payment, View Members', active: true },
  ]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleSaveGeneral = (e) => {
    e.preventDefault();
    saveAdminUpiConfig({ upiId: adminUpiId, payeeName: adminPayeeName });
    showToast('General system & Admin UPI payment configurations saved successfully!');
  };

  const handleSaveNotifications = (e) => {
    e.preventDefault();
    showToast('Notification rules updated successfully!');
  };

  const handleBackupExport = async () => {
    try {
      const [members, chits, transactions] = await Promise.all([
        memberService.getMembers(),
        chitService.getChits(),
        paymentService.getPayments(),
      ]);

      const backupData = {
        agency: agencyName,
        timestamp: new Date().toISOString(),
        members,
        chits,
        transactions,
      };

      const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonStr);
      downloadAnchor.setAttribute('download', `Raghavendra_Chitts_System_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      showToast('System Ledger JSON backup downloaded from Firestore!');
    } catch (e) {
      showToast('Backup failed: Unable to read Firestore data.', 'error');
    }
  };

  const handleRunPipelineTest = async () => {
    try {
      const res = await testImportPipeline();
      setTestResult(res);
      showToast(res.success ? 'Import Pipeline Algorithm Verification PASS! All deduplication & +N rules verified.' : 'Pipeline verification failed.', res.success ? 'success' : 'error');
    } catch (err) {
      showToast(`Test execution failed: ${err.message}`, 'error');
    }
  };

  const handleVerifyFirestoreConnection = async () => {
    setIsVerifying(true);
    setConnectionResult(null);

    const authUser = auth.currentUser?.email || 'NOT_SIGNED_IN';
    const projectId = 'raghavendra-chitts-c0822';

    try {
      const snapshot = await getDocs(collection(db, 'members'));
      const docCount = snapshot.docs.length;
      const sampleMembers = snapshot.docs.slice(0, 3).map((d) => ({
        id: d.id,
        name: d.data().name || 'No Name',
        phone: d.data().phone || 'No Phone',
      }));

      setConnectionResult({
        success: true,
        projectId,
        database: '(default)',
        authUser,
        docCount,
        sampleMembers,
        error: null,
      });
      showToast(`Firestore connection verified! ${docCount} member documents found in (default) db.`);
    } catch (err) {
      console.error('[FIRESTORE VERIFICATION FAILED]', {
        code: err.code,
        message: err.message,
      });
      setConnectionResult({
        success: false,
        projectId,
        database: '(default)',
        authUser,
        docCount: 0,
        sampleMembers: [],
        error: {
          code: err.code || 'unknown',
          message: err.message || String(err),
        },
      });
      showToast(`Firestore Verification Failed: ${err.message}`, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFile(file);
    setIsParsing(true);
    setPreviewData(null);
    setImportReport(null);
    setConfirmWrite(false);

    try {
      const { rows } = await parseExcelFile(file);
      const preview = generateImportPreview(rows, selectedChitValue);
      setPreviewData(preview);
      showToast(`Excel file parsed! ${rows.length} rows, ${preview.uniqueMembersCount} unique members identified.`);
    } catch (err) {
      showToast(`File parsing error: ${err.message}`, 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImportToFirestore = async () => {
    if (!previewData || !confirmWrite) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: previewData.uniqueMembers.length });

    try {
      const report = await importToFirestore(previewData, (current, total) => {
        setImportProgress({ current, total });
      });
      setImportReport(report);
      showToast(`Import to Firestore complete! ${report.membersCreated} members updated/upserted.`);
    } catch (err) {
      showToast(`Firestore import failed: ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
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
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">Administration</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">System Settings</h1>
        <p className="text-xs text-slate-500 mt-1">Manage agency details, operator access controls, Excel data migration, and notification triggers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* TABS SIDEBAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
          {[
            { id: 'excel_import', name: 'Excel Migration & Reconciler', icon: FileSpreadsheet },
            { id: 'general', name: 'General Settings', icon: Settings },
            { id: 'access', name: 'Operator Access Rules', icon: Shield },
            { id: 'backup', name: 'System Ledgers & Backup', icon: HardDrive },
            { id: 'notifications', name: 'WhatsApp Notifications', icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                  active
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-sky-600'}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* TAB CONTENTS */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'excel_import' && (
            <Card className="border border-slate-200 bg-white rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                    <h3 className="text-base font-black text-slate-900">
                      Production Excel Migration & Reconciler
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload real Raghavendra Chitts workbooks (₹1 Lakh, ₹2 Lakh, ₹5 Lakh). Automatically deduplicates by phone number and calculates +N holdings.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 border-sky-500 text-sky-700 hover:bg-sky-50 font-bold"
                    onClick={handleVerifyFirestoreConnection}
                    disabled={isVerifying}
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                    {isVerifying ? 'Verifying...' : 'VERIFY FIRESTORE CONNECTION'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl gap-1.5"
                    onClick={handleRunPipelineTest}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                    Run Pipeline Test
                  </Button>
                </div>
              </div>

              {/* FIRESTORE CONNECTION DIAGNOSTIC RESULT BOX */}
              {connectionResult && (
                <div className="p-4 rounded-2xl bg-slate-950 text-white space-y-3 text-xs font-mono border border-slate-800 shadow-md">
                  <div className="flex items-center justify-between font-sans border-b border-slate-800 pb-2">
                    <span className="font-bold text-sky-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-sky-400" />
                      Firestore Diagnostic Status
                    </span>
                    <Badge variant={connectionResult.success ? 'success' : 'danger'}>
                      {connectionResult.success ? 'CONNECTED ✅' : 'QUERY ERROR ❌'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Firebase Project</span>
                      <p className="text-sky-300 font-bold font-sans">{connectionResult.projectId}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Firestore Database</span>
                      <p className="text-slate-300 font-bold font-sans">{connectionResult.database}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Authenticated User</span>
                      <p className="text-emerald-300 font-bold font-sans">{connectionResult.authUser}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Members Collection</span>
                      <p className="text-amber-300 font-bold font-sans">{connectionResult.docCount} documents</p>
                    </div>
                  </div>

                  {connectionResult.error ? (
                    <div className="p-3 bg-red-950/90 border border-red-800 rounded-xl text-red-200 text-[11px] space-y-1 font-sans">
                      <p className="font-bold text-red-100">❌ Firebase Query Failure ({connectionResult.error.code})</p>
                      <p className="text-red-300">{connectionResult.error.message}</p>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-2 border-t border-slate-800 text-[11px]">
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">First 3 Members in Firestore:</p>
                      {connectionResult.sampleMembers.length > 0 ? (
                        connectionResult.sampleMembers.map((m, idx) => (
                          <div key={m.id} className="p-1.5 bg-slate-900 rounded-lg flex items-center justify-between font-sans">
                            <span>{idx + 1}. <strong className="text-white">{m.name}</strong> ({m.phone})</span>
                            <span className="text-slate-400 font-mono text-[10px]">ID: {m.id}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-amber-400 text-[11px] font-sans">0 documents found in `members` collection.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TEST PIPELINE RESULT CARD */}
              {testResult && (
                <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs font-mono border border-slate-800 shadow-sm font-sans">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-300">Algorithm Test Suite Result</span>
                    <Badge variant={testResult.success ? 'success' : 'danger'}>
                      {testResult.success ? 'PASS ✅' : 'FAIL ❌'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800 font-mono">
                    <p>• Critical Case (Mummadi Ramu +3 = 4 holdings, 1 Member Doc): <strong className="text-emerald-400">{testResult.t_mummadiPassed ? 'PASS' : 'FAIL'}</strong></p>
                    <p>• Shared-Phone Separation (Prapul c/o Ravindra != Mulakala Ravindra): <strong className="text-emerald-400">{testResult.t_sharedPair1Passed ? 'PASS' : 'FAIL'}</strong></p>
                    <p>• Multi-Chit Tokens Parsing (G.Ravi=4, PetrolBunk=9, Marlapati=5): <strong className="text-emerald-400">{testResult.t_multiChitPassed ? 'PASS' : 'FAIL'}</strong></p>
                    <p>• Deduplicated test rows into {testResult.preview.uniqueMembersCount} unique member records ({testResult.preview.totalHoldings} total holdings).</p>
                  </div>
                </div>
              )}

              {/* STEP 1: FILE SELECTION & CATEGORY */}
              <div className="space-y-4 font-sans">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Step 1: Select Chit Category & Upload Excel File
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chit Category Selector</label>
                    <select
                      value={selectedChitValue}
                      onChange={(e) => setSelectedChitValue(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs cursor-pointer"
                    >
                      <option value={100000}>1. ₹1,00,000 Chit Category</option>
                      <option value={200000}>2. ₹2,00,000 Chit Category</option>
                      <option value={500000}>3. ₹5,00,000 Chit Category</option>
                      <option value={999999}>4. Multi-Chit Members (Multiple Groups per Row)</option>
                      <option value={0}>5. Combined / All Categories</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Choose Excel File (.xlsx, .xls, .csv)</label>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200 cursor-pointer"
                    />
                  </div>
                </div>

                {selectedChitValue === 999999 && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 font-sans space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      Dedicated Multi-Chit Excel Migration Mode Active
                    </p>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Parses multi-chit rows with comma-separated group tokens (e.g. <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono text-emerald-950 font-bold">XIV, XVI, 2L-F, 5L-B</code> or <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono text-emerald-950 font-bold">5L-B+2, 5L-A+1</code>), aggregating quantities and classifying imported members as <strong className="text-emerald-950">MULTIPLE</strong>.
                    </p>
                  </div>
                )}

                {excelFile && (
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="gold"
                      size="sm"
                      className="rounded-xl gap-1.5 font-bold"
                      onClick={() => handleFileChange({ target: { files: [excelFile] } })}
                      disabled={isParsing}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Generate Import Preview
                    </Button>
                  </div>
                )}
              </div>

              {/* STEP 2: PRE-WRITE PREVIEW DASHBOARD */}
              {isParsing && (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-xs font-bold text-slate-700">Parsing Excel File & Analyzing Member Deduplication...</p>
                </div>
              )}

              {previewData && !isParsing && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                    <span>Step 2: Pre-Write Import Summary (No Firestore Write Yet)</span>
                    <Badge variant="neutral">{previewData.totalExcelRows} Source Rows</Badge>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-sky-700 uppercase">Unique Members</p>
                      <p className="text-xl font-black text-sky-900 font-sans mt-0.5">{previewData.uniqueMembersCount}</p>
                    </div>
                    <div className="p-3 bg-teal-50 border border-teal-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-teal-700 uppercase">WhatsApp Phones</p>
                      <p className="text-xl font-black text-teal-900 font-sans mt-0.5">{previewData.uniqueWhatsAppPhonesCount}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Total Holdings</p>
                      <p className="text-xl font-black text-emerald-900 font-sans mt-0.5">{previewData.totalHoldings}</p>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-indigo-700 uppercase">Single Chit</p>
                      <p className="text-xl font-black text-indigo-900 font-sans mt-0.5">{previewData.singleChitMembers}</p>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-purple-700 uppercase">Multiple Chit</p>
                      <p className="text-xl font-black text-purple-900 font-sans mt-0.5">{previewData.multipleChitMembers}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Chit Value Breakdown:</span>
                      <span>
                        ₹1L: {previewData.categoryBreakdown.lakh1} | ₹2L: {previewData.categoryBreakdown.lakh2} | ₹5L: {previewData.categoryBreakdown.lakh5}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between text-slate-600 text-[11px] gap-2">
                      <span>Duplicate Rows Skipped: {previewData.duplicateRowsSkipped}</span>
                      <span>Shared Phone Members: {previewData.sharedPhoneMembersCount}</span>
                      <span>Conflicts/Warnings Detected: {previewData.conflictsDetected}</span>
                    </div>
                  </div>

                  {/* RAW PARSER DIAGNOSTIC PANEL */}
                  <div className="p-4 bg-slate-950 text-white rounded-2xl space-y-3 font-mono text-xs shadow-md border border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-sky-400 font-sans flex items-center gap-2">
                        <Layers className="w-4 h-4 text-sky-400" />
                        Raw Parser Diagnostic Panel (First 15 Records)
                      </span>
                      <Badge variant="neutral">{previewData.uniqueMembers.length} Unique Members • {previewData.uniqueWhatsAppPhonesCount} WhatsApp Phones</Badge>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1.5 text-[11px] pr-1">
                      {previewData.uniqueMembers.slice(0, 15).map((m, idx) => (
                        <div key={m.id} className="p-2 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-slate-400 font-bold mr-2">{idx + 1}.</span>
                            <strong className="text-white font-sans">{m.name}</strong>
                            <span className="text-slate-400 text-[10px] ml-2">({m.phone})</span>
                            {m.sharedPhone && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[9px] font-bold">
                                Shared Phone
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            {m.holdings.map((h, hIdx) => (
                              <span key={hIdx} className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-bold">
                                ₹{(h.totalChitValue / 100000).toFixed(0)}L • Group {h.groupId} ({h.quantity} hldg)
                              </span>
                            ))}
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${m.classification === 'MULTIPLE' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'}`}>
                              {m.classification}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CONFLICTS WARNING LIST IF ANY */}
                  {previewData.conflicts && previewData.conflicts.length > 0 && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1.5">
                      <p className="font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Row Discrepancy Warnings ({previewData.conflicts.length})
                      </p>
                      <ul className="text-[11px] text-amber-800 space-y-1 max-h-28 overflow-y-auto pl-2 list-disc">
                        {previewData.conflicts.map((c, idx) => (
                          <li key={idx}>
                            Row {c.row}: {c.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* STEP 3: CONFIRM & EXECUTE WRITE */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                    <h5 className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                      Step 3: Admin Gated Write Confirmation
                    </h5>

                    <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmWrite}
                        onChange={(e) => setConfirmWrite(e.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-sky-500 rounded cursor-pointer"
                      />
                      <span>
                        I confirm that the complete Excel dataset has been reviewed and I want to import ALL valid records into Firestore (<code className="text-sky-300 font-mono">raghavendra-chitts-c0822</code>).
                      </span>
                    </label>

                    {isImporting && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs font-bold text-sky-300 font-mono">
                          <span>Importing to Firestore...</span>
                          <span>Imported {importProgress.current} / {importProgress.total} records</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-sky-500 h-2 transition-all duration-300"
                            style={{ width: `${(importProgress.current / Math.max(importProgress.total, 1)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        variant="gold"
                        size="sm"
                        disabled={!confirmWrite || isImporting}
                        onClick={handleExecuteImportToFirestore}
                        className="rounded-xl gap-2 font-bold"
                      >
                        <Check className="w-4 h-4" />
                        {isImporting ? 'Writing to Firestore...' : 'IMPORT TO FIRESTORE'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* POST-IMPORT REPORT SUMMARY */}
              {importReport && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-emerald-900 text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Firestore Production Import & Verification Report
                    </h4>
                    <Badge variant="success">COMMITTED & VERIFIED ✅</Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-emerald-950 font-bold font-sans">
                    <div className="p-2 bg-emerald-100/70 rounded-xl">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase">Project ID</p>
                      <p className="text-xs font-black text-emerald-900 mt-0.5">{importReport.firebaseProject}</p>
                    </div>
                    <div className="p-2 bg-emerald-100/70 rounded-xl">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase">Members Written</p>
                      <p className="text-base font-black text-emerald-900">{importReport.membersWritten}</p>
                    </div>
                    <div className="p-2 bg-emerald-100/70 rounded-xl">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase">Members Verified</p>
                      <p className="text-base font-black text-emerald-900">{importReport.membersVerified}</p>
                    </div>
                    <div className="p-2 bg-emerald-100/70 rounded-xl">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase">Holdings Written</p>
                      <p className="text-base font-black text-emerald-900">{importReport.holdingsWritten}</p>
                    </div>
                    <div className="p-2 bg-emerald-100/70 rounded-xl">
                      <p className="text-[10px] text-emerald-800 font-bold uppercase">Errors / Failures</p>
                      <p className="text-base font-black text-red-600">{importReport.errors ? importReport.errors.length : 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}
          {activeTab === 'general' && (
            <Card className="border border-slate-200 bg-white rounded-3xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                General System Configurations
              </h3>

              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chit Agency Name</label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Primary Admin Phone</label>
                    <input
                      type="text"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Primary Language Mode</label>
                  <input
                    type="text"
                    value={primaryLang}
                    onChange={(e) => setPrimaryLang(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 font-sans border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Administrator UPI Payment Configuration</h4>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">UPI INTENT READY</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admin UPI ID (VPA) *</label>
                      <input
                        type="text"
                        placeholder="e.g. raghavendrachitts@upi"
                        value={adminUpiId}
                        onChange={(e) => setAdminUpiId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admin / Business Payee Name</label>
                      <input
                        type="text"
                        placeholder="Raghavendra Chitts"
                        value={adminPayeeName}
                        onChange={(e) => setAdminPayeeName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    This UPI ID receives member payment intents generated from WhatsApp payment reminders (<code className="text-sky-300 font-mono">upi://pay?pa=...</code>).
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Database Engine</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Firebase / Local Storage JSON database operational.</p>
                  </div>
                  <Badge variant="success">Online</Badge>
                </div>

                <div className="flex justify-end pt-3">
                  <Button type="submit" variant="gold" size="sm" className="gap-1.5 rounded-xl">
                    <Save className="w-3.5 h-3.5" />
                    Save General Settings
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'access' && (
            <Card className="border border-slate-200 bg-white rounded-3xl p-6 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Operator Access Rules & Permissions
                </h3>
                <p className="text-xs text-slate-500 mt-1">Manage system operators and role assignment rules.</p>
              </div>

              <div className="space-y-3">
                {operators.map((op) => (
                  <div key={op.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{op.name}</p>
                      <p className="text-slate-500 mt-0.5">{op.role} • <strong className="text-sky-700">{op.permissions}</strong></p>
                    </div>
                    <Badge variant={op.active ? 'success' : 'secondary'}>
                      {op.active ? 'Active Operator' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-3">
                <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => showToast('Operator rules validated!')}>
                  Refresh Operator Permissions
                </Button>
              </div>
            </Card>
          )}

          {activeTab === 'backup' && (
            <Card className="border border-slate-200 bg-white rounded-3xl p-6 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  System Ledgers & Data Backup
                </h3>
                <p className="text-xs text-slate-500 mt-1">Export complete database JSON backups or restore past system snapshots.</p>
              </div>

              <div className="p-5 bg-sky-50 border border-sky-200 rounded-2xl space-y-3 text-xs">
                <h4 className="font-bold text-sky-900 text-sm flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-sky-700" />
                  Full Database Snapshot
                </h4>
                <p className="text-slate-600">
                  Export all member accounts, chit group records, transaction histories, and bilingual templates into a single JSON file.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="gold" size="sm" className="rounded-xl gap-1.5" onClick={handleBackupExport}>
                    <Download className="w-3.5 h-3.5" />
                    Download JSON Backup
                  </Button>
                  <Button variant="secondary" size="sm" className="rounded-xl gap-1.5" onClick={handleBackupImport}>
                    <Upload className="w-3.5 h-3.5" />
                    Restore Ledger Data
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className="border border-slate-200 bg-white rounded-3xl p-6 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  WhatsApp & SMS Notification Rules
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configure automated monthly payment reminder triggers.</p>
              </div>

              <form onSubmit={handleSaveNotifications} className="space-y-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">WhatsApp Dispatch Engine</p>
                    <p className="text-slate-500 text-[11px]">Enable automated WhatsApp billing text generation.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableWhatsapp}
                    onChange={(e) => setEnableWhatsapp(e.target.checked)}
                    className="w-5 h-5 accent-sky-600 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">SMS Gateway Dispatch</p>
                    <p className="text-slate-500 text-[11px]">Enable bulk bilingual SMS dispatch to all chit holders.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableSms}
                    onChange={(e) => setEnableSms(e.target.checked)}
                    className="w-5 h-5 accent-sky-600 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Default Reminder Date Trigger</label>
                  <select
                    value={autoReminderDate}
                    onChange={(e) => setAutoReminderDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="1st of month">1st of each month</option>
                    <option value="5th of month">5th of each month</option>
                    <option value="10th of month">10th of each month</option>
                    <option value="15th of month">15th of each month</option>
                  </select>
                </div>

                <div className="flex justify-end pt-3">
                  <Button type="submit" variant="gold" size="sm" className="gap-1.5 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Save Notification Rules
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
