// AI Supplier Bill Scanner Modal: Gemini Flash Vision OCR (gemini-3.5-flash-lite / gemini-3.8-flash)
// Multimodal invoice extraction (Marg ERP, Busy, Tally) -> Editable Verification Grid
// ZERO DUMMY DATA POLICY: Zero fake items. Direct real extraction.

import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  Trash2,
  Plus,
  ArrowRight,
  Edit2,
  Check,
} from 'lucide-react';
import { geminiOcrService, ExtractedInvoice, ExtractedInvoiceItem } from '../../services/geminiOcrService';

interface AiInvoiceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceExtracted: (extracted: ExtractedInvoice) => void;
}

export const AiInvoiceScanModal: React.FC<AiInvoiceScanModalProps> = ({
  isOpen,
  onClose,
  onInvoiceExtracted,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>(geminiOcrService.getApiKey());
  const [isEditingKey, setIsEditingKey] = useState<boolean>(!geminiOcrService.getApiKey());
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveApiKey = () => {
    geminiOcrService.setApiKey(apiKeyInput);
    setIsEditingKey(false);
    setStatusMessage('Gemini API Key saved successfully.');
  };

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      processAiImage(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const processAiImage = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Uploading to Gemini Flash Vision & extracting invoice rows...');
    try {
      const data = await geminiOcrService.extractInvoiceFromImage(base64, mimeType);
      setExtractedData(data);
      setStatusMessage(`Successfully extracted ${data.items.length} items from ${data.vendor_name || 'bill'}! Please verify below before approving.`);
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMessage(err.message || 'Invoice extraction failed. Please ensure the document is clear or enter details manually.');
      setStatusMessage('');
      setExtractedData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Allow in-grid editing of extracted items
  const handleItemChange = (index: number, field: keyof ExtractedInvoiceItem, value: any) => {
    if (!extractedData) return;
    const updatedItems = [...extractedData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    // Recalculate totals
    const subTotal = updatedItems.reduce(
      (acc, it) => acc + (Number(it.billed_qty) || 0) * (Number(it.purchase_rate) || 0) * (1 - (Number(it.discount_percent) || 0) / 100),
      0
    );
    const totalGst = updatedItems.reduce(
      (acc, it) =>
        acc +
        (Number(it.billed_qty) || 0) *
          (Number(it.purchase_rate) || 0) *
          (1 - (Number(it.discount_percent) || 0) / 100) *
          ((Number(it.gst_percent) || 0) / 100),
      0
    );

    setExtractedData({
      ...extractedData,
      items: updatedItems,
      sub_total: Math.round(subTotal * 100) / 100,
      total_gst: Math.round(totalGst * 100) / 100,
      grand_total: Math.round((subTotal + totalGst) * 100) / 100,
    });
  };

  const handleDeleteItem = (index: number) => {
    if (!extractedData) return;
    const updatedItems = extractedData.items.filter((_, idx) => idx !== index);
    const subTotal = updatedItems.reduce(
      (acc, it) => acc + (Number(it.billed_qty) || 0) * (Number(it.purchase_rate) || 0) * (1 - (Number(it.discount_percent) || 0) / 100),
      0
    );
    const totalGst = updatedItems.reduce(
      (acc, it) =>
        acc +
        (Number(it.billed_qty) || 0) *
          (Number(it.purchase_rate) || 0) *
          (1 - (Number(it.discount_percent) || 0) / 100) *
          ((Number(it.gst_percent) || 0) / 100),
      0
    );

    setExtractedData({
      ...extractedData,
      items: updatedItems,
      sub_total: Math.round(subTotal * 100) / 100,
      total_gst: Math.round(totalGst * 100) / 100,
      grand_total: Math.round((subTotal + totalGst) * 100) / 100,
    });
  };

  const handleApprove = () => {
    if (!extractedData || extractedData.items.length === 0) return;
    onInvoiceExtracted(extractedData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-700 w-full max-w-5xl shadow-2xl rounded-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="font-extrabold text-base tracking-wide">
              AI Supplier Bill Scanner (Marg ERP / Busy Invoice Reader)
            </span>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-bold">
              Gemini Vision (3.5 / 3.8 Flash)
            </span>
          </div>

          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
          {/* Gemini API Key Bar */}
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-sm flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              <Key className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                Gemini Vision API Key:
              </span>
              {isEditingKey ? (
                <div className="flex items-center space-x-2 flex-1 max-w-md">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Paste Gemini API Key from aistudio.google.com..."
                    className="w-full px-2 py-1 font-mono text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-sm text-xs flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {apiKeyInput ? `••••••••${apiKeyInput.slice(-8)}` : 'Not Configured'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingKey(true)}
                    className="text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-0.5 text-xs font-bold"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Change Key</span>
                  </button>
                </div>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              {apiKeyInput ? '🟢 Vision OCR Active' : '🔴 API Key Needed'}
            </span>
          </div>

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-sky-400 dark:border-sky-600 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/40 p-6 text-center cursor-pointer rounded-sm transition-colors flex flex-col items-center justify-center space-y-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="p-3 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 rounded-full">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {selectedFileName ? `Selected: ${selectedFileName} (Click to change)` : 'Click to Upload Wholesale Bill Photo or PDF'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Supports JPG, PNG, WEBP, or Marg/Busy PDF invoices. AI parses batches, expiries, rates &amp; schemes (e.g. 100+20).
              </div>
            </div>
          </div>

          {/* Status / Loading Alert */}
          {isProcessing && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-700 rounded-sm flex items-center space-x-2 text-sky-900 dark:text-sky-200">
              <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
              <span className="font-bold">{statusMessage || 'Processing invoice...'}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-sm flex items-start space-x-2 text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Extraction Failed:</div>
                <div className="text-xs">{errorMessage}</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Ensure the image is sharp and legible, or enter items manually in the purchase entry grid.
                </div>
              </div>
            </div>
          )}

          {/* Extracted Preview Grid (Editable) */}
          {extractedData && (
            <div className="border border-slate-300 dark:border-slate-700 rounded-sm space-y-2">
              {/* Supplier Header Meta */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Extracted Wholesaler</div>
                  <div className="font-black text-sm text-slate-900 dark:text-white uppercase">
                    {extractedData.vendor_name || 'SUPPLIER NAME'}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    GSTIN: <span className="font-mono font-bold">{extractedData.vendor_gstin || 'N/A'}</span> | D.L.: {extractedData.vendor_dl_no || 'N/A'}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Invoice Meta</div>
                  <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                    Inv #{extractedData.invoice_no} ({extractedData.invoice_date})
                  </div>
                  <div className="font-mono font-black text-emerald-600 text-sm">
                    Grand Total: ₹{extractedData.grand_total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items Table with In-Grid Editing */}
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold uppercase">
                    <tr>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-8">#</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700">Product Name</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-20">HSN</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-24">Batch</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-16">Exp.</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center w-16">Billed</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center w-16">Free</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right w-20">MRP (₹)</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right w-20">Rate (₹)</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center w-14">GST%</th>
                      <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right w-24">Total (₹)</th>
                      <th className="p-2 text-center w-10">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {extractedData.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold uppercase">
                          <input
                            type="text"
                            value={it.product_name}
                            onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                            className="w-full px-1.5 py-0.5 uppercase border border-transparent hover:border-slate-300 focus:border-sky-500 rounded font-bold"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700">
                          <input
                            type="text"
                            value={it.hsn_code}
                            onChange={(e) => handleItemChange(idx, 'hsn_code', e.target.value)}
                            className="w-full px-1.5 py-0.5 font-mono text-[11px] border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono font-bold">
                          <input
                            type="text"
                            value={it.batch_no}
                            onChange={(e) => handleItemChange(idx, 'batch_no', e.target.value.toUpperCase())}
                            className="w-full px-1.5 py-0.5 uppercase font-mono font-bold border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">
                          <input
                            type="text"
                            value={it.exp_date_mm_yy}
                            onChange={(e) => handleItemChange(idx, 'exp_date_mm_yy', e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-1.5 py-0.5 font-mono border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-center">
                          <input
                            type="number"
                            min="0"
                            value={it.billed_qty}
                            onChange={(e) => handleItemChange(idx, 'billed_qty', parseInt(e.target.value) || 0)}
                            className="w-full px-1.5 py-0.5 text-center font-bold border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-center">
                          <input
                            type="number"
                            min="0"
                            value={it.free_qty}
                            onChange={(e) => handleItemChange(idx, 'free_qty', parseInt(e.target.value) || 0)}
                            className="w-full px-1.5 py-0.5 text-center font-bold text-emerald-600 border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={it.mrp}
                            onChange={(e) => handleItemChange(idx, 'mrp', parseFloat(e.target.value) || 0)}
                            className="w-full px-1.5 py-0.5 text-right font-mono border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={it.purchase_rate}
                            onChange={(e) => handleItemChange(idx, 'purchase_rate', parseFloat(e.target.value) || 0)}
                            className="w-full px-1.5 py-0.5 text-right font-mono font-bold border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-center">
                          <input
                            type="number"
                            value={it.gst_percent}
                            onChange={(e) => handleItemChange(idx, 'gst_percent', parseFloat(e.target.value) || 0)}
                            className="w-full px-1.5 py-0.5 text-center font-mono border border-transparent hover:border-slate-300 rounded"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-300 dark:border-slate-700 text-right font-mono font-bold">
                          ₹{it.line_amount.toFixed(2)}
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 p-3 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            {extractedData ? `Ready to transfer ${extractedData.items.length} items to purchase entry grid.` : 'Upload bill image to begin.'}
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={!extractedData || extractedData.items.length === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-sm shadow-md flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve &amp; Transfer to Purchase Grid</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
