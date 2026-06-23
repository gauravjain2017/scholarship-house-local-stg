import { useState, useCallback, useReducer, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { dealsAPI } from '../../api/deals';
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FiGrid,
  FiChevronUp,
  FiChevronDown,
  FiEdit2,
  FiSave,
  FiX,
  FiMoreVertical,
  FiCopy,
  FiEye,
  FiEyeOff,
  FiMonitor,
  FiTablet,
  FiSmartphone,
  FiRotateCcw,
  FiRotateCw,
  FiTrash2,
  FiChevronLeft,
  FiLayers,
  FiCode,
  FiChevronRight,
  FiType,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight,
  FiAlignJustify,
  FiImage,
} from 'react-icons/fi';
import {
  WIDGET_REGISTRY,
  BlockPreviewContent,
  DEFAULT_BLOCK_STYLE,
  STYLE_FIELDS,
  blockStyleToCSS,
  HEADING_TAGS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  TEXT_TRANSFORMS,
  TEXT_ALIGNS,
} from '../../components/BlockRenderers';

/* ═══════════════════════════════════════════════════
   Undo / Redo
   ═══════════════════════════════════════════════════ */
let nextId = 1;
const genId = () => `block-${nextId++}`;
const PALETTE_PREFIX = 'palette::';
const MAX_HISTORY = 50;

function historyReducer(state, action) {
  const push = (b) => ({
    past: [...state.past, state.blocks].slice(-MAX_HISTORY),
    blocks: b,
    future: [],
  });
  switch (action.type) {
    case 'SET': return push(action.blocks);
    case 'UNDO': {
      if (!state.past.length) return state;
      return { past: state.past.slice(0, -1), blocks: state.past.at(-1), future: [state.blocks, ...state.future].slice(0, MAX_HISTORY) };
    }
    case 'REDO': {
      if (!state.future.length) return state;
      return { past: [...state.past, state.blocks], blocks: state.future[0], future: state.future.slice(1) };
    }
    default: return state;
  }
}

/* ═══════════════════════════════════════════════════
   Palette widget (draggable)
   ═══════════════════════════════════════════════════ */
function PaletteWidget({ widget }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${widget.type}`,
    data: { fromPalette: true, widget },
  });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border bg-white cursor-grab active:cursor-grabbing select-none transition-all ${isDragging ? 'border-blue-400 shadow-lg opacity-60 scale-[0.97]' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: widget.accentColor + '18', color: widget.accentColor }}>{widget.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-800 leading-tight">{widget.label}</div>
        <div className="text-[11px] text-gray-400 leading-snug mt-0.5 truncate">{widget.description}</div>
      </div>
      <FiMoreVertical className="text-gray-300 shrink-0" size={16} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Sortable canvas block
   ═══════════════════════════════════════════════════ */
function SortableBlock({ block, index, total, isSelected, onSelect, onRemove, onMoveUp, onMoveDown, onDuplicate, onToggleVisible }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : block.hidden ? 0.45 : 1 };
  const widgetMeta = WIDGET_REGISTRY.find((w) => w.type === block.type);
  const customStyle = blockStyleToCSS(block.style);

  return (
    <div ref={setNodeRef} style={style} data-block-id={block.id}
      className={`group relative rounded-xl border bg-white shadow-sm overflow-hidden transition-all cursor-pointer ${isDragging ? 'shadow-lg border-blue-300 ring-2 ring-blue-200' : isSelected ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : 'border-gray-200 hover:border-blue-300'}`}
      onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}>
      {block.hidden && (
        <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">Hidden</span>
        </div>
      )}
      <div className={`flex items-center gap-1 px-3 py-1.5 border-b transition-colors ${isSelected ? 'bg-blue-50/80 border-blue-100' : 'bg-gray-50/60 border-gray-100'}`}>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1" title="Drag" onClick={(e) => e.stopPropagation()}><FiGrid size={13} /></button>
        <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1.5 ml-0.5"><span className="text-sm">{widgetMeta?.icon}</span>{widgetMeta?.label}</span>
        <div className="ml-auto flex items-center gap-0">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(index) }} disabled={index === 0} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 disabled:pointer-events-none" title="Move up"><FiChevronUp size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(index) }} disabled={index === total - 1} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-25 disabled:pointer-events-none" title="Move down"><FiChevronDown size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(block.id) }} className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Duplicate"><FiCopy size={12} /></button>
          <button onClick={(e) => { e.stopPropagation(); onToggleVisible(block.id) }} className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50" title={block.hidden ? 'Show' : 'Hide'}>{block.hidden ? <FiEyeOff size={12} /> : <FiEye size={12} />}</button>
          <button onClick={(e) => { e.stopPropagation(); onSelect(block.id) }} className={`p-1.5 rounded-md transition-colors ${isSelected ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`} title="Edit"><FiEdit2 size={12} /></button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(block.id) }} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50" title="Delete"><FiX size={13} /></button>
        </div>
      </div>
      {/* Custom CSS class + inline styles on wrapper */}
      <div style={customStyle} className={block.cssClass || ''}>
        <BlockPreviewContent type={block.type} data={block.data} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Right-side Edit Panel
   ═══════════════════════════════════════════════════ */
function EditPanel({ block, onUpdateData, onUpdateStyle, onUpdateBlock, onClose }) {
  const [tab, setTab] = useState('content');
  const widgetMeta = WIDGET_REGISTRY.find((w) => w.type === block.type);
  const fields = widgetMeta?.fields || [];
  const tabs = [
    { id: 'content', label: 'Content', icon: <FiEdit2 size={12} /> },
    { id: 'style', label: 'Style', icon: <FiType size={12} /> },
    { id: 'advanced', label: 'Advanced', icon: <FiCode size={12} /> },
  ];

  return (
    <aside className="w-[340px] border-l border-gray-200 bg-white flex flex-col shrink-0 shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50/50">
        <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"><FiChevronLeft size={16} /></button>
        <span className="text-sm mr-1">{widgetMeta?.icon}</span>
        <span className="text-sm font-semibold text-gray-800">{widgetMeta?.label}</span>
        <span className="ml-auto text-[10px] text-gray-400 uppercase tracking-wider font-medium bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Editing</span>
      </div>
      <div className="flex border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${tab === t.id ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/40' : 'text-gray-400 hover:text-gray-600'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'content' && <ContentTab fields={fields} data={block.data} blockId={block.id} onUpdateData={onUpdateData} />}
        {tab === 'style' && <StyleTab style={block.style || {}} blockId={block.id} onUpdateStyle={onUpdateStyle} />}
        {tab === 'advanced' && <AdvancedTab block={block} onUpdateBlock={onUpdateBlock} />}
      </div>
    </aside>
  );
}

/* ── Content Tab ── */
function ContentTab({ fields, data, blockId, onUpdateData }) {
  const visibleFields = fields.filter((f) => {
    // For grid widget, hide cell fields beyond rows × columns
    const totalCells = (parseInt(data.rows) || 1) * (parseInt(data.columns) || 2);
    const match = f.key.match(/^cell(\d+)/);
    if (match && parseInt(match[1]) > totalCells) return false;
    // Conditional show/hide based on showWhen
    if (f.showWhen) {
      if (data[f.showWhen.key] !== f.showWhen.value) return false;
    }
    return true;
  });

  return (
    <div className="p-4 space-y-4">
      {visibleFields.map((f) => (
        <FieldControl key={f.key} field={f} value={data[f.key] ?? ''} onChange={(val) => onUpdateData(blockId, f.key, val)} />
      ))}
      {visibleFields.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No editable content fields.</p>}
    </div>
  );
}

/* ── Image Upload Field (S3) ── */
function ImageUploadField({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setProgress(0);
      const { getPresignedUploadUrl, uploadFileToS3WithProgress } = await import('../../api/upload');
      const { uploadUrl, fileUrl } = await getPresignedUploadUrl(file.name, file.type);
      await uploadFileToS3WithProgress(uploadUrl, file, setProgress);
      onChange(fileUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{label}</label>
      {value ? (
        <div className="relative group">
          <img src={value} alt="" className="w-full rounded-lg border border-gray-200 max-h-40 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <label className="px-3 py-1.5 bg-white text-gray-700 rounded-md text-xs font-medium cursor-pointer hover:bg-gray-100">
              Replace
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </label>
            <button onClick={() => onChange('')} className="px-3 py-1.5 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${uploading ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'}`}>
          {uploading ? (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-blue-600 font-medium">Uploading {progress}%</span>
            </>
          ) : (
            <>
              <FiImage size={20} className="text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">Click to upload image</span>
            </>
          )}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
        </label>
      )}
    </div>
  );
}

/* ── Field Control (supports all types) ── */
function FieldControl({ field, value, onChange }) {
  const labelEl = (
    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{field.label}</label>
  );

  switch (field.type) {
    case 'textarea':
      return <div>{labelEl}<textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y bg-white" /></div>;

    case 'color':
      return (
        <div>{labelEl}
          <div className="flex items-center gap-2">
            <input type="color" value={value || '#4f46e5'} onChange={(e) => onChange(e.target.value)} className="w-10 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="#hex" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white font-mono" />
          </div>
        </div>
      );

    case 'select':
      return <div>{labelEl}<select value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">{(field.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;

    case 'range':
      return (
        <div>{labelEl}
          <div className="flex items-center gap-3">
            <input type="range" min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-blue-600" />
            <span className="text-xs font-mono text-gray-500 w-10 text-right">{value}</span>
          </div>
        </div>
      );

    case 'number':
      return (
        <div>{labelEl}
          <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
        </div>
      );

    case 'headingTag':
      return (
        <div>{labelEl}
          <div className="flex flex-wrap gap-1">
            {HEADING_TAGS.map((tag) => (
              <button key={tag} onClick={() => onChange(tag)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase transition-colors ${value === tag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      );

    case 'textAlign':
      return (
        <div>{labelEl}
          <div className="flex gap-1">
            {[
              { val: 'left', icon: <FiAlignLeft size={14} /> },
              { val: 'center', icon: <FiAlignCenter size={14} /> },
              { val: 'right', icon: <FiAlignRight size={14} /> },
              { val: 'justify', icon: <FiAlignJustify size={14} /> },
            ].map((a) => (
              <button key={a.val} onClick={() => onChange(a.val)}
                className={`p-2 rounded-md transition-colors ${value === a.val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {a.icon}
              </button>
            ))}
          </div>
        </div>
      );

    case 'imageUpload':
      return <ImageUploadField label={field.label} value={value} onChange={onChange} />;

    case 'propertySelector':
      return <div>{labelEl}<PropertySelector value={value} onChange={onChange} /></div>;

    default:
      return <div>{labelEl}<input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" /></div>;
  }
}

/* ── Property Selector for Properties Slider ── */
function PropertySelector({ value, onChange }) {
  const [allProperties, setAllProperties] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = useMemo(() => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [value]);

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  useEffect(() => {
    setLoading(true);
    dealsAPI.getPublishedDeals().then((deals) => {
      setAllProperties(deals);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allProperties;
    const term = search.toLowerCase();
    return allProperties.filter((p) =>
      (p.title || '').toLowerCase().includes(term) ||
      (p.address || '').toLowerCase().includes(term)
    );
  }, [allProperties, search]);


  const addProperty = (prop) => {
    if (selectedIds.has(prop.id)) return;
    const updated = [...selected, prop];
    onChange(JSON.stringify(updated));
  };

  const removeProperty = (id) => {
    const updated = selected.filter((p) => p.id !== id);
    onChange(JSON.stringify(updated));
  };

  const moveProperty = (index, dir) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= selected.length) return;
    const updated = [...selected];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(JSON.stringify(updated));
  };

  return (
    <div ref={wrapperRef} className="space-y-2">
      {/* Selected properties */}
      {selected.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {selected.map((prop, idx) => (
            <div key={prop.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs">
              {(prop.exteriorImages?.[0] || prop.images?.[0]) ? (
                <img src={prop.exteriorImages?.[0] || prop.images[0]} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">
                  {(() => {
                    const streetNum = prop.streetAddress?.trim().split(' ')[0].replace(/\D/g, '') || '';
                    const postal = prop.postalCode?.trim() || '';
                    const prefix = !streetNum && !postal ? '' : !streetNum ? postal : !postal ? streetNum : `${streetNum}-${postal}`;
                    return prefix ? `(${prefix}) ${prop.title || 'Untitled'}` : (prop.title || 'Untitled');
                  })()}
                </div>
                {prop.address && <div className="text-gray-500 truncate text-[10px]">{prop.address}</div>}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => moveProperty(idx, -1)} disabled={idx === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move up">
                  <FiChevronUp size={12} />
                </button>
                <button onClick={() => moveProperty(idx, 1)} disabled={idx === selected.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move down">
                  <FiChevronDown size={12} />
                </button>
                <button onClick={() => removeProperty(prop.id)}
                  className="p-0.5 text-red-400 hover:text-red-600 ml-1" title="Remove">
                  <FiX size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & dropdown */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setDropdownOpen(true)}
          placeholder="Search properties to add..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
        />
        {dropdownOpen && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">Loading properties...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No properties found</div>
            ) : (
              filtered.map((prop) => {
                const isSelected = selectedIds.has(prop.id);




                return (
                  <button
                    key={prop.id}
                    onClick={() => { if (!isSelected) addProperty(prop); }}
                    disabled={isSelected}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${isSelected ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}`}
                  >
                    {(prop.exteriorImages?.[0] || prop.images?.[0]) ? (
                      <img src={prop.exteriorImages?.[0] || prop.images[0]} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 text-[10px]">No img</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">
                        {(() => {
                          const streetNum = prop.streetAddress?.trim().split(' ')[0].replace(/\D/g, '') || '';
                          const postal = prop.postalCode?.trim() || '';
                          const prefix = !streetNum && !postal ? '' : !streetNum ? postal : !postal ? streetNum : `${streetNum}-${postal}`;
                          return prefix ? `(${prefix}) ${prop.title || 'Untitled'}` : (prop.title || 'Untitled');
                        })()}
                      </div>
                      {prop.address && <div className="text-gray-500 truncate text-[10px]">{prop.address}</div>}
                    </div>
                    {isSelected && <span className="text-[10px] text-blue-500 font-medium flex-shrink-0">Added</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="text-[10px] text-gray-400">
        {selected.length} {selected.length === 1 ? 'property' : 'properties'} selected
      </div>
    </div>
  );
}

/* ── Style Tab with collapsible sections ── */
function StyleTab({ style, blockId, onUpdateStyle }) {
  const [openSections, setOpenSections] = useState({ Typography: true, Spacing: false });
  const merged = { ...DEFAULT_BLOCK_STYLE, ...style };

  const toggle = (group) => setOpenSections((prev) => ({ ...prev, [group]: !prev[group] }));

  return (
    <div className="divide-y divide-gray-100">
      {STYLE_FIELDS.map((group) => (
        <div key={group.group}>
          <button onClick={() => toggle(group.group)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/50 transition-colors">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{group.group}</span>
            <FiChevronRight size={14} className={`text-gray-400 transition-transform ${openSections[group.group] ? 'rotate-90' : ''}`} />
          </button>
          {openSections[group.group] && (
            <div className="px-4 pb-4">
              <div className={`grid gap-3 ${group.fields.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {group.fields.map((f) => (
                  <StyleFieldControl key={f.key} field={f} value={merged[f.key]} onChange={(val) => onUpdateStyle(blockId, f.key, val)} />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Style field control ── */
function StyleFieldControl({ field, value, onChange }) {
  const label = <label className="text-[10px] text-gray-400 font-medium mb-1 block">{field.label}</label>;

  switch (field.type) {
    case 'color':
      return (
        <div>{label}
          <div className="flex items-center gap-1.5">
            <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="none" className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      );

    case 'number':
      return (
        <div>{label}
          <div className="flex items-center">
            <input type="number" value={value} step={field.step || 1} onChange={(e) => onChange(e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
            {field.unit && <span className="text-[10px] text-gray-400 ml-1.5 shrink-0">{field.unit}</span>}
          </div>
        </div>
      );

    case 'range':
      return (
        <div className="col-span-full">{label}
          <div className="flex items-center gap-2">
            <input type="range" min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-blue-600" />
            <span className="text-xs font-mono text-gray-500 w-10 text-right">{value}</span>
          </div>
        </div>
      );

    case 'select':
      return (
        <div>{label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            {(field.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      );

    case 'fontFamily':
      return (
        <div className="col-span-full">{label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Default</option>
            {FONT_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      );

    case 'fontWeight':
      return (
        <div>{label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Default</option>
            {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      );

    case 'textAlign':
      return (
        <div className="col-span-full">{label}
          <div className="flex gap-1">
            {[
              { val: 'left', icon: <FiAlignLeft size={12} /> },
              { val: 'center', icon: <FiAlignCenter size={12} /> },
              { val: 'right', icon: <FiAlignRight size={12} /> },
              { val: 'justify', icon: <FiAlignJustify size={12} /> },
            ].map((a) => (
              <button key={a.val} onClick={() => onChange(a.val)} className={`p-1.5 rounded-md transition-colors ${value === a.val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{a.icon}</button>
            ))}
          </div>
        </div>
      );

    case 'textTransform':
      return (
        <div className="col-span-full">{label}
          <div className="flex gap-1">
            {TEXT_TRANSFORMS.map((t) => (
              <button key={t.value} onClick={() => onChange(t.value)} className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${value === t.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{t.label}</button>
            ))}
          </div>
        </div>
      );

    default:
      return <div className="col-span-full">{label}<input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" /></div>;
  }
}

/* ── Advanced Tab ── */
function AdvancedTab({ block, onUpdateBlock }) {
  return (
    <div className="p-4 space-y-5">
      {/* Block info */}
      <div>
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Block Info</h4>
        <div className="text-xs text-gray-500 space-y-1.5 bg-gray-50 rounded-lg p-3">
          <div className="flex justify-between"><span>ID</span><span className="font-mono text-gray-400">{block.id}</span></div>
          <div className="flex justify-between"><span>Type</span><span className="font-mono text-gray-400">{block.type}</span></div>
          <div className="flex justify-between"><span>Visible</span><span className={block.hidden ? 'text-amber-500' : 'text-green-500'}>{block.hidden ? 'Hidden' : 'Visible'}</span></div>
        </div>
      </div>

      {/* CSS Class */}
      <div>
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">CSS Class</h4>
        <input type="text" value={block.cssClass || ''} onChange={(e) => onUpdateBlock(block.id, 'cssClass', e.target.value)}
          placeholder="e.g. my-custom-block" className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono" />
      </div>

      {/* CSS ID */}
      <div>
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">CSS ID</h4>
        <input type="text" value={block.cssId || ''} onChange={(e) => onUpdateBlock(block.id, 'cssId', e.target.value)}
          placeholder="e.g. hero-section" className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono" />
      </div>

      {/* Custom CSS */}
      <div>
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom CSS</h4>
        <p className="text-[10px] text-gray-400 mb-2">
          Use <code className="bg-gray-100 px-1 rounded text-[10px]">selector</code> to target this block. E.g: <code className="bg-gray-100 px-1 rounded text-[10px]">selector .my-class {"{"} color: red; {"}"}</code>
        </p>
        <textarea
          value={block.customCSS || ''}
          onChange={(e) => onUpdateBlock(block.id, 'customCSS', e.target.value)}
          rows={6}
          placeholder={`selector {\n  /* your CSS here */\n}`}
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-900 text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono resize-y"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Custom CSS sidebar editor
   ═══════════════════════════════════════════════════ */
function GlobalCSSEditor({ css, onChange }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Global Custom CSS</h3>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Write CSS that applies globally to the homepage. Changes appear in real time.
        </p>
      </div>
      <div className="flex-1 px-4 pb-4">
        <textarea
          value={css}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-900 text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono resize-none"
          placeholder={`/* Global CSS */\n.hero-block {\n  box-shadow: 0 4px 20px rgba(0,0,0,0.1);\n}`}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Drag overlays
   ═══════════════════════════════════════════════════ */
function PaletteOverlay({ widget }) {
  return (
    <div className="w-60 rounded-xl border-2 border-blue-400 bg-white shadow-2xl p-3 flex items-center gap-3 opacity-90">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: widget.accentColor + '18', color: widget.accentColor }}>{widget.icon}</span>
      <div><div className="text-sm font-semibold text-gray-800">{widget.label}</div><div className="text-[11px] text-gray-400">{widget.description}</div></div>
    </div>
  );
}

function BlockOverlay({ block }) {
  const m = WIDGET_REGISTRY.find((w) => w.type === block.type);
  return (
    <div className="rounded-xl border-2 border-blue-400 bg-white shadow-2xl overflow-hidden opacity-90 max-w-[560px]">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 bg-blue-50/60">
        <FiGrid size={14} className="text-blue-400" /><span className="text-xs font-medium text-blue-600 flex items-center gap-1.5 ml-1"><span>{m?.icon}</span>{m?.label}</span>
      </div>
      <div className="p-4"><BlockPreviewContent type={block.type} data={block.data} /></div>
    </div>
  );
}

function CanvasDropZone({ children, isOver }) {
  const { setNodeRef } = useDroppable({ id: 'canvas-drop-zone' });
  return (
    <div ref={setNodeRef} className={`h-full w-full rounded-2xl border-2 border-dashed transition-all ${isOver ? 'border-blue-400 bg-blue-50/50' : 'border-transparent'}`}>
      <div className="h-full">{children}</div>
    </div>
  );
}

const VIEWPORTS = {
  desktop: { icon: FiMonitor, width: '100%', label: 'Desktop' },
  tablet: { icon: FiTablet, width: '768px', label: 'Tablet' },
  mobile: { icon: FiSmartphone, width: '375px', label: 'Mobile' },
};

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */
const ManageClientAbout = () => {
  const navigate = useNavigate();
  const [history, dispatch] = useReducer(historyReducer, { past: [], blocks: [], future: [] });
  const blocks = history.blocks;

  const [selectedId, setSelectedId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  const [viewport, setViewport] = useState('desktop');
  const [sidebarMode, setSidebarMode] = useState('widgets'); // 'widgets' | 'layers' | 'css'
  const [globalCSS, setGlobalCSS] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load saved layout from DB on mount
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const res = await api.get('/manage-homepages/client_about');
        const { payload, global_css } = res.data.data;
        if (payload) {
          const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const restored = parsed.map((b) => ({ ...b, id: genId() }));
            dispatch({ type: 'SET', blocks: restored });
          }
        }
        if (global_css) setGlobalCSS(global_css);
      } catch (e) { /* no saved layout yet */ }
    };
    loadLayout();
  }, []);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId), [blocks, selectedId]);

  const setBlocks = useCallback((updater) => {
    const newBlocks = typeof updater === 'function' ? updater(blocks) : updater;
    dispatch({ type: 'SET', blocks: newBlocks });
  }, [blocks]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  // Block ops
  const addBlock = useCallback((widget, insertIndex) => {
    const b = { id: genId(), type: widget.type, data: { ...widget.defaultData }, style: { ...DEFAULT_BLOCK_STYLE }, hidden: false, cssClass: '', cssId: '', customCSS: '' };
    setBlocks((prev) => {
      if (insertIndex != null && insertIndex >= 0 && insertIndex <= prev.length) { const n = [...prev]; n.splice(insertIndex, 0, b); return n; }
      return [...prev, b];
    });
    setSelectedId(b.id);
  }, [setBlocks]);

  const removeBlock = useCallback((id) => { setBlocks((p) => p.filter((b) => b.id !== id)); if (selectedId === id) setSelectedId(null); }, [setBlocks, selectedId]);
  const duplicateBlock = useCallback((id) => { setBlocks((p) => { const i = p.findIndex((b) => b.id === id); if (i < 0) return p; const c = { ...p[i], id: genId(), data: { ...p[i].data }, style: { ...p[i].style } }; const n = [...p]; n.splice(i + 1, 0, c); return n; }); }, [setBlocks]);
  const toggleVisible = useCallback((id) => { setBlocks((p) => p.map((b) => b.id === id ? { ...b, hidden: !b.hidden } : b)); }, [setBlocks]);
  const moveUp = useCallback((i) => { if (i <= 0) return; setBlocks((p) => arrayMove(p, i, i - 1)); }, [setBlocks]);
  const moveDown = useCallback((i) => { setBlocks((p) => { if (i >= p.length - 1) return p; return arrayMove(p, i, i + 1); }); }, [setBlocks]);
  const updateBlockData = useCallback((id, k, v) => { setBlocks((p) => p.map((b) => b.id === id ? { ...b, data: { ...b.data, [k]: v } } : b)); }, [setBlocks]);
  const updateBlockStyle = useCallback((id, k, v) => { setBlocks((p) => p.map((b) => b.id === id ? { ...b, style: { ...(b.style || {}), [k]: v } } : b)); }, [setBlocks]);
  const updateBlockProp = useCallback((id, k, v) => { setBlocks((p) => p.map((b) => b.id === id ? { ...b, [k]: v } : b)); }, [setBlocks]);

  const clearAll = useCallback(() => { if (!blocks.length || !window.confirm('Remove all blocks?')) return; setBlocks([]); setSelectedId(null); }, [blocks.length, setBlocks]);


  const saveLayout = useCallback(async () => {
    setSaving(true);
    const payload = blocks.map(({ type, data, style, hidden, cssClass, cssId, customCSS }) => (
      { type, data, style, hidden, cssClass, cssId, customCSS }
    ));

    try {
      await api.post('/manage-homepages', {
        type: 'client_about',
        payload: JSON.stringify(payload),
        global_css: globalCSS,
      });
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
    setSaving(false);
  }, [blocks, globalCSS]);

  // DnD
  const handleDragStart = useCallback((e) => setActiveId(e.active.id), []);
  const handleDragOver = useCallback((e) => { setIsOverCanvas(e.over != null && (e.over.id === 'canvas-drop-zone' || !String(e.over.id).startsWith(PALETTE_PREFIX))); }, []);
  const handleDragEnd = useCallback((e) => {
    const { active, over } = e; setActiveId(null); setIsOverCanvas(false);
    const aid = String(active.id); const isPal = aid.startsWith(PALETTE_PREFIX);
    if (isPal) {
      const w = WIDGET_REGISTRY.find((x) => x.type === aid.replace(PALETTE_PREFIX, '')); if (!w) return;
      if (over && !String(over.id).startsWith(PALETTE_PREFIX) && over.id !== 'canvas-drop-zone') { const oi = blocks.findIndex((b) => b.id === over.id); addBlock(w, oi >= 0 ? oi + 1 : undefined); } else if (over) { addBlock(w); }
    } else {
      if (!over || active.id === over.id) return;
      setBlocks((p) => { const oi = p.findIndex((b) => b.id === active.id); const ni = p.findIndex((b) => b.id === over.id); if (oi < 0 || ni < 0) return p; return arrayMove(p, oi, ni); });
    }
  }, [blocks, addBlock, setBlocks]);
  const handleDragCancel = useCallback(() => { setActiveId(null); setIsOverCanvas(false); }, []);

  const activeIdStr = activeId ? String(activeId) : '';
  const isPaletteDrag = activeIdStr.startsWith(PALETTE_PREFIX);
  const activePaletteWidget = isPaletteDrag ? WIDGET_REGISTRY.find((w) => w.type === activeIdStr.replace(PALETTE_PREFIX, '')) : null;
  const activeBlock = !isPaletteDrag ? blocks.find((b) => b.id === activeId) : null;
  const collisionDetection = useCallback((args) => { const pc = pointerWithin(args); return pc.length > 0 ? pc : rectIntersection(args); }, []);
  const vp = VIEWPORTS[viewport];

  return (
    <div className="h-screen bg-app flex flex-col overflow-hidden">
      {/* Inject global CSS */}
      {globalCSS && <style>{globalCSS}</style>}

      {/* ══ Header ══ */}
      <header className="flex items-center justify-between px-4 md:px-6 h-14 bg-white border-b border-gray-200 shrink-0 z-20">
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>Admin</span><span className="mx-1">&rsaquo;</span>
          <span className="cursor-pointer hover:text-gray-700" onClick={() => navigate('/settings/filters')}>Settings</span>
          <span className="mx-1">&rsaquo;</span><span className="text-gray-800 font-medium">Manage Client About Page</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {Object.entries(VIEWPORTS).map(([k, v]) => {
            const I = v.icon; return (
              <button key={k} onClick={() => setViewport(k)} className={`p-1.5 rounded-md transition-colors ${viewport === k ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title={v.label}><I size={15} /></button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 mr-2">
            <button onClick={undo} disabled={!history.past.length} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none" title="Undo (Ctrl+Z)"><FiRotateCcw size={15} /></button>
            <button onClick={redo} disabled={!history.future.length} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none" title="Redo (Ctrl+Y)"><FiRotateCw size={15} /></button>
          </div>
          <button onClick={() => navigate('/submit')} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors submit_btn">+ Submit Property</button>
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="flex flex-1 overflow-hidden">
          {/* ══ Left Sidebar ══ */}
          <aside className="w-[270px] border-r border-gray-200 bg-white flex flex-col shrink-0">
            <div className="flex border-b border-gray-200">
              {[
                { id: 'widgets', icon: <FiGrid size={12} />, label: 'Widgets' },
                { id: 'layers', icon: <FiLayers size={12} />, label: 'Layers' },
                { id: 'css', icon: <FiCode size={12} />, label: 'CSS' },
              ].map((t) => (
                <button key={t.id} onClick={() => setSidebarMode(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors ${sidebarMode === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {sidebarMode === 'widgets' && (
              <>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                  {WIDGET_REGISTRY.map((w) => <PaletteWidget key={w.type} widget={w} />)}
                </div>
                <div className="border-t border-gray-100 px-4 py-3">
                  <h3 className="text-[11px] font-bold text-gray-500 mb-2">How to use</h3>
                  <ul className="space-y-1 text-[11px] text-gray-500 leading-relaxed">
                    <li className="flex items-start gap-1.5"><span className="text-blue-400 shrink-0 mt-px">&#10070;</span><span><b className="text-blue-500">Drag</b> a widget to the canvas</span></li>
                    <li className="flex items-start gap-1.5"><FiGrid size={10} className="text-gray-400 shrink-0 mt-0.5" /><span><b className="text-gray-600">Reorder</b> via the drag handle</span></li>
                    <li className="flex items-start gap-1.5"><FiEdit2 size={10} className="text-gray-400 shrink-0 mt-0.5" /><span><b className="text-gray-600">Click</b> any block to edit</span></li>
                    <li className="flex items-start gap-1.5"><FiCopy size={10} className="text-gray-400 shrink-0 mt-0.5" /><span><b className="text-gray-600">Duplicate</b> or <b className="text-gray-600">Hide</b> from toolbar</span></li>
                  </ul>
                </div>
              </>
            )}

            {sidebarMode === 'layers' && (
              <div className="flex-1 overflow-y-auto py-2">
                {blocks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">No layers yet</p>
                ) : blocks.map((block, i) => {
                  const meta = WIDGET_REGISTRY.find((w) => w.type === block.type);
                  return (
                    <button key={block.id} onClick={() => {
                        setSelectedId(block.id);
                        const el = document.querySelector(`[data-block-id="${block.id}"]`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${selectedId === block.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <span className="text-xs text-gray-400 w-4 text-right shrink-0">{i + 1}</span>
                      <span className="text-sm">{meta?.icon}</span>
                      <span className="text-xs font-medium truncate flex-1">{meta?.label}</span>
                      {block.hidden && <FiEyeOff size={11} className="text-gray-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {sidebarMode === 'css' && (
              <GlobalCSSEditor css={globalCSS} onChange={setGlobalCSS} />
            )}
          </aside>

          {/* ══ Canvas ══ */}
          <main className="flex-1 flex flex-col overflow-hidden bg-gray-100/80">
            <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full" style={{ background: blocks.length > 0 ? '#4f46e5' : '#cbd5e1' }} />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Canvas &mdash; {blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={clearAll} disabled={!blocks.length} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"><FiTrash2 size={12} /> Clear</button>
                <button onClick={saveLayout} disabled={!blocks.length || saving} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none transition-colors"><FiSave size={13} /> {saving ? 'Saving...' : 'Save layout'}</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 0 }} onClick={() => setSelectedId(null)}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <CanvasDropZone isOver={isOverCanvas && isPaletteDrag}>
                  {blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-200/60 flex items-center justify-center mb-4"><FiGrid size={28} className="text-gray-300" /></div>
                      <p className="text-sm font-medium text-gray-500 mb-1">No blocks yet</p>
                      <p className="text-xs text-gray-400 max-w-xs">Drag a widget from the left panel and drop it here to start building.</p>
                    </div>
                  ) : (
                    <div className="mx-auto space-y-4 py-1 transition-all" style={{ maxWidth: vp.width }}>
                      {blocks.map((block, i) => (
                        <SortableBlock key={block.id} block={block} index={i} total={blocks.length} isSelected={selectedId === block.id} onSelect={setSelectedId} onRemove={removeBlock} onMoveUp={moveUp} onMoveDown={moveDown} onDuplicate={duplicateBlock} onToggleVisible={toggleVisible} />
                      ))}
                    </div>
                  )}
                </CanvasDropZone>
              </SortableContext>
            </div>
          </main>

          {/* ══ Right Edit Panel ══ */}
          {selectedBlock && (
            <EditPanel block={selectedBlock} onUpdateData={updateBlockData} onUpdateStyle={updateBlockStyle} onUpdateBlock={updateBlockProp} onClose={() => setSelectedId(null)} />
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activePaletteWidget ? <PaletteOverlay widget={activePaletteWidget} /> : activeBlock ? <BlockOverlay block={activeBlock} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default ManageClientAbout;
