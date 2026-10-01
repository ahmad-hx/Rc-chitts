import React, { useState, useEffect, useRef } from 'react';
import Button from './Button';
import {
  ImagePlus,
  Image as ImageIcon,
  MoreVertical,
  Eye,
  Edit3,
  Trash2,
  Calendar,
  HardDrive,
  ExternalLink,
  Layers,
} from 'lucide-react';

export default function DashboardImageGallery({
  images = [],
  loading = false,
  onOpenSaveModal,
  onViewImage,
  onEditImage,
  onDeleteImage,
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (_) {
      return 'Recent';
    }
  };

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-5">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#285F52]">
              Cloud Media Storage
            </p>
            {images.length > 0 && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#EEF6F3] text-[#285F52] border border-[#BFD8D0]">
                {images.length} {images.length === 1 ? 'Image' : 'Images'}
              </span>
            )}
          </div>
          <h2 className="mt-0.5 text-xl font-black text-[#111111]">Saved Images</h2>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSaveModal}
          className="gap-2 rounded-xl border-[#BFD8D0] bg-[#EEF6F3] text-[#285F52] hover:bg-[#285F52] hover:text-white font-bold cursor-pointer transition-colors shrink-0"
        >
          <ImagePlus className="w-4 h-4" />
          <span>Save Image</span>
        </Button>
      </div>

      {/* GALLERY BODY */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#E5E7EB] bg-[#F7F8F7] p-3 space-y-3 animate-pulse"
            >
              <div className="h-40 bg-[#E5E7EB] rounded-xl" />
              <div className="h-4 bg-[#E5E7EB] rounded-md w-3/4" />
              <div className="h-3 bg-[#E5E7EB] rounded-md w-1/2" />
            </div>
          ))}
        </div>
      ) : images.length === 0 ? (
        /* EMPTY STATE */
        <div className="p-10 text-center rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#F7F8F7] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5E7EB] flex items-center justify-center text-[#667085] mx-auto shadow-xs">
            <ImageIcon className="w-6 h-6 text-[#98A2B3]" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <p className="text-sm font-bold text-[#111111]">No Saved Images Yet</p>
            <p className="text-xs text-[#667085]">
              Upload and store receipts, auction banners, chit notices, or office photos permanently using Firebase Storage.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenSaveModal}
            className="gap-1.5 rounded-xl bg-[#285F52] hover:bg-[#214D43] text-white font-bold shadow-xs cursor-pointer inline-flex mt-2"
          >
            <ImagePlus className="w-4 h-4" />
            <span>Upload First Image</span>
          </Button>
        </div>
      ) : (
        /* RESPONSIVE IMAGE GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {images.map((img) => {
            const isMenuOpen = activeMenuId === img.id;
            const displayTitle = img.title || img.fileName || 'Untitled Image';
            const formatBadge = img.fileType ? img.fileType.toUpperCase().replace('IMAGE/', '') : 'IMG';
            const sizeStr = formatFileSize(img.fileSize);

            return (
              <div
                key={img.id}
                className="group relative rounded-2xl border border-[#E5E7EB] bg-white hover:border-[#285F52]/40 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col overflow-hidden"
              >
                {/* THUMBNAIL CONTAINER */}
                <div
                  onClick={() => onViewImage(img)}
                  className="relative h-44 bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center"
                >
                  <img
                    src={img.imageUrl}
                    alt={displayTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* OVERLAY BADGES */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold tracking-wider uppercase">
                      {formatBadge}
                    </span>
                    {sizeStr && (
                      <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-slate-200 text-[9px] font-mono">
                        {sizeStr}
                      </span>
                    )}
                  </div>

                  {/* HOVER VIEW HINT */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 text-[#111111] text-xs font-bold shadow-md">
                      <Eye className="w-3.5 h-3.5 text-[#285F52]" />
                      <span>View</span>
                    </span>
                  </div>
                </div>

                {/* CARD BODY */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2 bg-white">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        onClick={() => onViewImage(img)}
                        className="text-xs font-bold text-[#111111] truncate cursor-pointer hover:text-[#285F52] transition-colors flex-1"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </h3>

                      {/* 3-DOT ACTION MENU */}
                      <div className="relative shrink-0" ref={isMenuOpen ? menuRef : null}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : img.id);
                          }}
                          className="p-1 rounded-lg hover:bg-[#F7F8F7] text-[#667085] hover:text-[#111111] transition-colors cursor-pointer"
                          aria-label="Actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* POPUP MENU */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-7 z-30 w-36 rounded-xl bg-white p-1 shadow-lg border border-[#E5E7EB] text-xs font-semibold animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onViewImage(img);
                              }}
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#F7F8F7] text-[#111111] cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#285F52]" />
                              <span>View Image</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onEditImage(img);
                              }}
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#F7F8F7] text-[#111111] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#B7791F]" />
                              <span>Edit Info</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onDeleteImage(img);
                              }}
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#FEF3F2] text-[#B42318] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#B42318]" />
                              <span>Delete Image</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {img.description && (
                      <p className="text-[11px] text-[#667085] line-clamp-2 leading-snug">
                        {img.description}
                      </p>
                    )}
                  </div>

                  {/* UPLOAD DATE FOOTER */}
                  <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between text-[10px] text-[#98A2B3]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#667085]" />
                      <span>{formatDate(img.createdAt)}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => onViewImage(img)}
                      className="text-[#285F52] hover:underline font-bold text-[10px] cursor-pointer"
                    >
                      Open &rarr;
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
