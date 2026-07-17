'use client';

import { useState, useRef, useCallback } from 'react';
import { bijoyToUnicode } from '@/lib/bijoy-to-unicode';
import { unicodeToBijoy } from '@/lib/unicode-to-bijoy';
import { copyToClipboard, downloadText, readFileAsText } from '@/lib/utils';

type ConversionMode = 'unicode-to-bijoy' | 'bijoy-to-unicode';

export default function Converter() {
  const [mode, setMode] = useState<ConversionMode>('unicode-to-bijoy');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convert = useCallback(
    (text: string) => {
      if (!text) {
        setOutput('');
        return;
      }
      try {
        const result = mode === 'unicode-to-bijoy' ? unicodeToBijoy(text) : bijoyToUnicode(text);
        setOutput(result);
      } catch (e) {
        setOutput(`Error: ${e instanceof Error ? e.message : 'Conversion failed'}`);
      }
    },
    [mode]
  );

  const handleInputChange = (value: string) => {
    setInput(value);
    convert(value);
  };

  const handleModeChange = (newMode: ConversionMode) => {
    setMode(newMode);
    // Re-convert existing input with new mode
    if (input) {
      try {
        const result = newMode === 'unicode-to-bijoy' ? unicodeToBijoy(input) : bijoyToUnicode(input);
        setOutput(result);
      } catch {
        setOutput('');
      }
    }
  };

  const handleCopy = async () => {
    if (output) {
      const ok = await copyToClipboard(output);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleDownload = () => {
    if (output) {
      const ext = mode === 'unicode-to-bijoy' ? 'bijoy.txt' : 'unicode.txt';
      downloadText(output, ext);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      setInput(text);
      convert(text);
    } catch {
      alert('Failed to read file. Please ensure it is a text file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Mode Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleModeChange('unicode-to-bijoy')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            mode === 'unicode-to-bijoy'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Unicode → Bijoy
        </button>
        <button
          onClick={() => handleModeChange('bijoy-to-unicode')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            mode === 'bijoy-to-unicode'
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Bijoy → Unicode
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input Panel */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {mode === 'unicode-to-bijoy' ? 'Unicode Input' : 'Bijoy Input'}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Upload .txt
              </button>
              <button
                onClick={() => {
                  setInput('');
                  setOutput('');
                }}
                className="text-xs px-3 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative rounded-xl border-2 transition-all ${
              dragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                mode === 'unicode-to-bijoy'
                  ? 'Type or paste Unicode Bengali text here...\nExample: আমি বাংলায় গান গাই।'
                  : 'Type or paste Bijoy text here...\nExample: Avwg evsjvq Mvb MvB|'
              }
              className="w-full h-64 p-4 rounded-xl bg-transparent resize-none focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              dir="auto"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.text"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Output Panel */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {mode === 'unicode-to-bijoy' ? 'Bijoy Output' : 'Unicode Output'}
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                disabled={!output}
                className={`text-xs px-3 py-1 rounded transition-colors ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                disabled={!output}
                className="text-xs px-3 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download
              </button>
            </div>
          </div>
          <div className="rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
            <textarea
              value={output}
              readOnly
              placeholder="Converted text will appear here..."
              className="w-full h-64 p-4 rounded-xl bg-transparent resize-none focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              dir="auto"
            />
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
          {mode === 'unicode-to-bijoy' ? 'About Unicode → Bijoy' : 'About Bijoy → Unicode'}
        </h3>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          {mode === 'unicode-to-bijoy'
            ? 'Converts modern Unicode Bengali text to legacy Bijoy (SutonnyMJ) ANSI encoding. The output will look like random English characters — this is normal. Apply the SutonnyMJ font in your software (Word, Photoshop, etc.) to see the correct Bengali glyphs.'
            : 'Converts legacy Bijoy (SutonnyMJ) ANSI encoded text to modern Unicode Bengali. The input should be text typed with Bijoy keyboard using SutonnyMJ font. URLs and emails are preserved during conversion.'}
        </p>
      </div>
    </div>
  );
}
