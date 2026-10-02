'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  File, 
  FileText, 
  Image as ImageIcon, 
  FileArchive, 
  Film, 
  Music, 
  Download, 
  CheckCircle2, 
  Clock, 
  X, 
  Eye, 
  Share2, 
  HardDrive,
  Sparkles,
  ArrowDownCircle,
  Trash2
} from 'lucide-react';
import { FileTransferState } from '@/lib/webrtc-peer';

interface FileSharingProps {
  transfers: FileTransferState[];
  onSendFile: (file: File) => void;
  peerCount: number;
  onDeleteTransfer?: (transferId: string) => void;
  onClearAll?: () => void;
}

export const FileSharing: React.FC<FileSharingProps> = ({
  transfers,
  onSendFile,
  peerCount,
  onDeleteTransfer,
  onClearAll
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<{ id: string; url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        onSendFile(file);
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => {
        onSendFile(file);
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-cyan-400" />;
    if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-indigo-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-400" />;
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      return <FileText className="w-5 h-5 text-amber-400" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar') || mimeType.includes('rar')) {
      return <FileArchive className="w-5 h-5 text-rose-400" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
          <HardDrive className="w-4 h-4" />
          <span>P2P File Stream</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
          <span>Zero Server Storage</span>
        </div>
      </div>

      <div className="p-4 flex flex-col h-full gap-4 overflow-y-auto">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
              : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/70'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="p-3 rounded-full bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-slate-700 text-cyan-400">
              <UploadCloud className="w-6 h-6 stroke-[1.75]" />
            </div>

            <div>
              <p className="text-xs sm:text-sm font-semibold text-slate-200">
                Drag & drop files here, or <span className="text-cyan-400 underline">browse</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {peerCount > 0
                  ? 'Files stream directly P2P to connected peers'
                  : 'Waiting for peers to join to begin streaming'}
              </p>
            </div>
          </div>
        </div>

        {/* Transfer Queue & History */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <span>Transfer History ({transfers.length})</span>
              {transfers.length > 0 && onClearAll && (
                <button
                  onClick={onClearAll}
                  className="flex items-center gap-1 text-[11px] font-normal text-slate-500 hover:text-rose-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-500/10"
                  title="Clear all transferred files"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
            {transfers.length > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">Encrypted P2P Stream</span>
            )}
          </div>

          {transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 min-h-[160px] text-slate-600 border border-slate-800/60 rounded-xl bg-slate-950/20 p-4 text-center">
              <ArrowDownCircle className="w-8 h-8 mb-2 stroke-[1.25] text-slate-700" />
              <p className="text-xs text-slate-500 font-medium">No files shared yet in this room</p>
              <p className="text-[11px] text-slate-600 mt-1">
                Drop any image, PDF, document, archive, or video to share instantly
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1">
              {transfers.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0">
                        {getFileIcon(item.type)}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>{formatFileSize(item.size)}</span>
                          <span>•</span>
                          <span className="text-cyan-400">
                            {item.senderId ? `From ${item.senderId.slice(-6)}` : 'Outgoing'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status / Action Button */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.status === 'completed' && item.blobUrl && (
                        <>
                          {item.previewUrl && (
                            <button
                              onClick={() => setSelectedPreview({ id: item.id, url: item.previewUrl!, name: item.name })}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
                              title="Preview Image"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <a
                            href={item.blobUrl}
                            download={item.name}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition-colors"
                            title="Download File"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </>
                      )}

                      {item.status === 'transferring' && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-mono">
                          <Clock className="w-3 h-3 animate-spin" />
                          <span>{item.progress}%</span>
                        </div>
                      )}

                      {/* Delete File/Image Button */}
                      {onDeleteTransfer && (
                        <button
                          onClick={() => onDeleteTransfer(item.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Image Preview Thumbnail */}
                  {item.previewUrl && (
                    <div className="relative mt-1 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 max-h-36 flex justify-center">
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="object-contain max-h-36 rounded"
                      />
                    </div>
                  )}

                  {/* Progress Bar */}
                  {item.status === 'transferring' && (
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800 mt-1">
                      <div
                        className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full transition-all duration-150"
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-hidden shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-slate-200 truncate">{selectedPreview.name}</h3>
              <div className="flex items-center gap-1.5">
                <a
                  href={selectedPreview.url}
                  download={selectedPreview.name}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 transition-colors"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                </a>
                {onDeleteTransfer && (
                  <button
                    onClick={() => {
                      if (selectedPreview) {
                        onDeleteTransfer(selectedPreview.id);
                        setSelectedPreview(null);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedPreview(null)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center max-h-[80vh] overflow-auto">
              <img src={selectedPreview.url} alt={selectedPreview.name} className="max-h-[75vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
