'use client';

import React, { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { sass } from '@codemirror/lang-sass';
import { 
  Code2, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  FileCode, 
  Sparkles,
  Layers,
  Search
} from 'lucide-react';

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (newCode: string) => void;
  onLanguageChange: (newLang: string) => void;
  readOnly?: boolean;
}

export interface LanguageOption {
  id: string;
  name: string;
  ext: string;
  category: 'Popular' | 'Web' | 'Backend' | 'Systems & Mobile' | 'Data & Config';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  // Popular
  { id: 'javascript', name: 'JavaScript (JS)', ext: '.js', category: 'Popular' },
  { id: 'typescript', name: 'TypeScript (TS)', ext: '.ts', category: 'Popular' },
  { id: 'python', name: 'Python (PY)', ext: '.py', category: 'Popular' },
  { id: 'html', name: 'HTML5', ext: '.html', category: 'Popular' },
  { id: 'css', name: 'CSS3', ext: '.css', category: 'Popular' },
  { id: 'json', name: 'JSON', ext: '.json', category: 'Popular' },
  { id: 'markdown', name: 'Markdown (MD)', ext: '.md', category: 'Popular' },
  
  // Backend & Databases
  { id: 'java', name: 'Java', ext: '.java', category: 'Backend' },
  { id: 'php', name: 'PHP', ext: '.php', category: 'Backend' },
  { id: 'csharp', name: 'C# (.NET)', ext: '.cs', category: 'Backend' },
  { id: 'sql', name: 'SQL Database', ext: '.sql', category: 'Backend' },
  { id: 'ruby', name: 'Ruby', ext: '.rb', category: 'Backend' },
  { id: 'elixir', name: 'Elixir', ext: '.ex', category: 'Backend' },
  { id: 'graphql', name: 'GraphQL', ext: '.graphql', category: 'Backend' },

  // Systems & Mobile
  { id: 'cpp', name: 'C / C++', ext: '.cpp', category: 'Systems & Mobile' },
  { id: 'rust', name: 'Rust', ext: '.rs', category: 'Systems & Mobile' },
  { id: 'go', name: 'Go (Golang)', ext: '.go', category: 'Systems & Mobile' },
  { id: 'swift', name: 'Swift (iOS)', ext: '.swift', category: 'Systems & Mobile' },
  { id: 'kotlin', name: 'Kotlin (Android)', ext: '.kt', category: 'Systems & Mobile' },
  { id: 'dart', name: 'Dart / Flutter', ext: '.dart', category: 'Systems & Mobile' },
  { id: 'scala', name: 'Scala', ext: '.scala', category: 'Systems & Mobile' },

  // Data, Config & Web
  { id: 'scss', name: 'SCSS / SASS', ext: '.scss', category: 'Web' },
  { id: 'xml', name: 'XML / SVG', ext: '.xml', category: 'Data & Config' },
  { id: 'yaml', name: 'YAML / YML', ext: '.yaml', category: 'Data & Config' },
  { id: 'bash', name: 'Shell / Bash', ext: '.sh', category: 'Data & Config' },
  { id: 'dockerfile', name: 'Dockerfile', ext: '.dockerfile', category: 'Data & Config' },
  { id: 'r', name: 'R Language', ext: '.r', category: 'Data & Config' },
  { id: 'lua', name: 'Lua Script', ext: '.lua', category: 'Data & Config' },
  { id: 'perl', name: 'Perl', ext: '.pl', category: 'Data & Config' },
  { id: 'haskell', name: 'Haskell', ext: '.hs', category: 'Data & Config' },
  { id: 'plaintext', name: 'Plain Text', ext: '.txt', category: 'Data & Config' }
];

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language,
  onChange,
  onLanguageChange,
  readOnly = false
}) => {
  const [copied, setCopied] = useState(false);

  // Dynamic syntax extension loader based on language selection
  const extensions = useMemo(() => {
    switch (language) {
      case 'javascript':
        return [javascript({ jsx: true })];
      case 'typescript':
        return [javascript({ jsx: true, typescript: true })];
      case 'python':
        return [python()];
      case 'html':
        return [html()];
      case 'css':
        return [css()];
      case 'scss':
        return [sass()];
      case 'json':
        return [json()];
      case 'markdown':
        return [markdown()];
      case 'cpp':
      case 'csharp':
        return [cpp()];
      case 'java':
      case 'kotlin':
      case 'scala':
        return [java()];
      case 'php':
        return [php()];
      case 'rust':
        return [rust()];
      case 'go':
        return [go()];
      case 'sql':
        return [sql()];
      case 'xml':
        return [xml()];
      case 'yaml':
        return [yaml()];
      default:
        return [];
    }
  }, [language]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.id === language) || SUPPORTED_LANGUAGES[0];
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beamshare-code${langObj.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const charCount = useMemo(() => code.length, [code]);

  // Group languages by category for clean dropdown UI
  const categories = useMemo(() => {
    const map = new Map<string, LanguageOption[]>();
    SUPPORTED_LANGUAGES.forEach((lang) => {
      if (!map.has(lang.category)) map.set(lang.category, []);
      map.get(lang.category)?.push(lang);
    });
    return map;
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900/90 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Editor Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
            <Code2 className="w-4 h-4" />
            <span>P2P Workspace</span>
          </div>

          {/* Language Selector Dropdown (Categorized) */}
          <div className="relative">
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-cyan-500 focus:outline-none font-mono cursor-pointer hover:border-slate-600 transition-colors shadow-sm"
            >
              {Array.from(categories.entries()).map(([categoryName, langs]) => (
                <optgroup key={categoryName} label={`--- ${categoryName} ---`} className="bg-slate-950 text-cyan-400 font-bold">
                  {langs.map((lang) => (
                    <option key={lang.id} value={lang.id} className="bg-slate-900 text-slate-200 font-mono">
                      {lang.name} ({lang.ext})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Metrics */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
            <span>Lines: {lineCount}</span>
            <span>•</span>
            <span>Chars: {charCount}</span>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyCode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title="Copy code to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownloadCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Download code file"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Clear Code */}
          <button
            onClick={() => onChange('')}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Clear editor contents"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CodeMirror Workspace Canvas */}
      <div className="flex-1 w-full overflow-auto bg-[#090d16] text-slate-100 relative min-h-[380px]">
        <CodeMirror
          value={code}
          height="100%"
          minHeight="380px"
          theme={oneDark}
          extensions={extensions}
          onChange={(val) => onChange(val)}
          readOnly={readOnly}
          className="h-full text-sm font-mono"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />

        {code.trim().length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-600 p-6 text-center">
            <FileCode className="w-10 h-10 mb-2 stroke-[1.5] text-slate-700 animate-pulse" />
            <p className="text-sm font-medium text-slate-500">Start typing or paste code here...</p>
            <p className="text-xs text-slate-600 mt-1">Changes are synced instantly in real-time with all connected peers</p>
          </div>
        )}
      </div>
    </div>
  );
};
