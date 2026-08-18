import React, { useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function ExcelImportPlaceholder() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportStatus('');
    }
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setImportStatus('success');
    }, 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-brand-navy-deep font-sans">Import Excel</h2>
        <p className="text-sm text-brand-text-secondary">Upload your Raghavendra Chitts Excel ledger to validate, group multiple chits, and import members into the database.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-brand-border">
            <h3 className="text-sm font-bold text-brand-navy-deep uppercase tracking-wider mb-4 font-sans flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-gold-primary" />
              Upload Spreadsheet File
            </h3>

            <form onSubmit={handleUploadSubmit} className="space-y-6">
              {/* Drag and Drop Zone */}
              <div className="border-2 border-dashed border-brand-border hover:border-brand-gold-primary rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-white border border-brand-border rounded-xl shadow-3xs text-brand-navy-deep">
                    <FileSpreadsheet className="w-8 h-8 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-text-main">
                      {selectedFile ? selectedFile.name : 'Click to upload or drag & drop'}
                    </p>
                    <p className="text-xs text-brand-text-secondary mt-1">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Supports Excel (.xlsx, .xls) and CSV files'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedFile && !isProcessing && !importStatus && (
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedFile(null)}>Clear</Button>
                  <Button type="submit" variant="gold" size="sm">
                    Process & Validate File
                  </Button>
                </div>
              )}

              {isProcessing && (
                <div className="bg-slate-50 border border-brand-border rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-brand-gold-primary border-t-transparent animate-spin"></div>
                    <span className="text-xs font-semibold text-brand-navy-deep">Scanning columns, parsing rows, and validating groups...</span>
                  </div>
                </div>
              )}

              {importStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3 text-brand-success">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-bold">Excel Validation Completed Successfully!</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white border border-green-100 rounded-lg p-3">
                      <span className="text-brand-text-secondary block">Detected Members</span>
                      <span className="font-bold text-brand-navy-deep font-sans">47</span>
                    </div>
                    <div className="bg-white border border-green-100 rounded-lg p-3">
                      <span className="text-brand-text-secondary block">Matched Chits</span>
                      <span className="font-bold text-brand-navy-deep font-sans">82</span>
                    </div>
                    <div className="bg-white border border-green-100 rounded-lg p-3">
                      <span className="text-brand-text-secondary block">Pending Dues</span>
                      <span className="font-bold text-brand-navy-deep font-sans">₹1,84,000</span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-green-200">
                    <Button variant="primary" size="sm" className="gap-1.5" onClick={() => { setSelectedFile(null); setImportStatus(''); alert('Successfully imported and saved to mock memory!'); }}>
                      Apply Import to Database
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Card>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          <Card className="border border-brand-border">
            <h3 className="text-sm font-bold text-brand-navy-deep uppercase tracking-wider mb-4 font-sans flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-gold-primary" />
              Guidelines
            </h3>
            <ul className="space-y-3 text-xs text-brand-text-secondary leading-relaxed list-disc pl-4">
              <li>Columns must contain Member Name, Phone Number, Chit Group Value, Current Due, and Balance Amount.</li>
              <li>Multiple rows matching the same phone number are automatically grouped together under a single member.</li>
              <li>You can preview, inspect validation alerts, and confirm modifications before committing the import.</li>
            </ul>
          </Card>
        </div>

      </div>
    </div>
  );
}
