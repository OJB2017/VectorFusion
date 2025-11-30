import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Upload, Download, Copy, Maximize2, AlertCircle, Trash2, GripHorizontal, ZoomIn, ZoomOut, RotateCcw, X, Palette, Pipette, Undo2, Redo2, Wand2, Split, Eraser, FileUp } from 'lucide-react';
import { Button } from '../components/Button';
import { parseSvgContent, downloadBlob, updateSvgElement, injectIdToSvg, rgbToHex, getGradientData, upsertGradient, generateUniqueId, GradientData, GradientStop, hexToHsv, hsvToHex, hsvToRgb, isColorRed, smartAnalyzeSvg, decomposePath, getNextId, generateReactComponent, generateReactNativeComponent } from '../utils/svgHelpers';
import { useAppContext } from '../AppContext';
import clsx from 'clsx';

interface ShapeProps {
  tagName: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  strokeDasharray?: string;
  strokeLinecap?: string;
  x?: string;
  y?: string;
  cx?: string;
  cy?: string;
  d?: string;
}

const CursorIcon = ({ filled, className }: { filled: boolean, className?: string }) => {
  const outer = "M74.95,489c6.3,0,12.4-1.5,18.3-4.3l151.3-74.2l151.4,74.3c5.8,2.9,12,4.3,18.3,4.3c13.7,0,26.6-7,34.3-18.6 c7.7-11.5,9-25.6,3.6-38.6L282.55,25.3c-6.5-15.6-21.1-25.3-38-25.3s-31.5,9.7-38,25.3L36.95,431.9c-5.4,13-4.1,27,3.6,38.6 C48.35,482.1,61.15,489.1,74.95,489z";
  const inner = "M59.55,441.3l169.6-406.6c4-9.5,12.8-10.3,15.4-10.3c2.6,0,11.4,0.7,15.4,10.3l169.6,406.6 c3,7.2,0.4,12.8-1.4,15.5c-4.6,7-13.7,9.7-21.4,5.9l-156.8-76.9c-1.7-0.8-3.5-1.3-5.4-1.3s-3.7,0.4-5.4,1.3l-156.8,76.9 c-7.8,3.8-16.8,1.1-21.4-5.9C59.15,454.1,56.55,448.5,59.55,441.3z";

  return (
    <svg width="24" height="24" viewBox="-100 -50 700 700" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g transform="rotate(-22.5 244.55 244.55)">
        <path 
          d={filled ? outer : `${outer} ${inner}`} 
          fill="currentColor"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
};

const ColorPicker = ({ color, onChange, onClose }: { color: string, onChange: (c: string) => void, onClose: () => void }) => {
  const initialHsv = useRef(hexToHsv(rgbToHex(color)));
  const [hsv, setHsv] = useState(initialHsv.current);
  
  useEffect(() => {
    if (document.activeElement?.tagName !== "INPUT") {
       setHsv(hexToHsv(rgbToHex(color)));
    }
  }, [color]);

  const handleSaturationChange = useCallback((e: MouseEvent, boxRect: DOMRect, currentH: number) => {
    const x = Math.max(0, Math.min(1, (e.clientX - boxRect.left) / boxRect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - boxRect.top) / boxRect.height));
    const newS = x * 100;
    const newV = (1 - y) * 100;
    const newHsv = { h: currentH, s: newS, v: newV };
    setHsv(newHsv);
    onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
  }, [onChange]);

  const handleHueChange = useCallback((e: MouseEvent, sliderRect: DOMRect, currentS: number, currentV: number) => {
    const x = Math.max(0, Math.min(1, (e.clientX - sliderRect.left) / sliderRect.width));
    const newH = x * 360;
    const newHsv = { h: newH, s: currentS, v: currentV };
    setHsv(newHsv);
    onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
  }, [onChange]);

  const startDrag = (e: React.MouseEvent, type: 'sat' | 'hue') => {
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const startHsv = hsv;
    const handleMove = (evt: MouseEvent) => {
      if (type === 'sat') handleSaturationChange(evt, rect, startHsv.h);
      else handleHueChange(evt, rect, startHsv.s, startHsv.v);
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    if (type === 'sat') handleSaturationChange(e.nativeEvent, rect, startHsv.h);
    else handleHueChange(e.nativeEvent, rect, startHsv.s, startHsv.v);
  };

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const currentRgb = hsvToRgb(hsv.h, hsv.s, hsv.v);

  const handleEyeDropper = async () => {
    if (!(window as any).EyeDropper) return;
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      const newHex = rgbToHex(result.sRGBHex);
      setHsv(hexToHsv(newHex));
      onChange(newHex);
    } catch (e) {
      console.log('Eyedropper cancelled');
    }
  };

  return (
    <div className="absolute top-10 left-0 z-50 p-3 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl w-64 animate-in fade-in zoom-in-95 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      <div 
        className="relative w-full h-32 rounded-lg cursor-crosshair overflow-hidden shadow-inner ring-1 ring-black/5 dark:ring-white/10"
        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)`, backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)' }}
        onMouseDown={(e) => startDrag(e, 'sat')}
      >
        <div className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md -ml-1.5 -mt-1.5 pointer-events-none" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: currentHex }} />
      </div>

      <div className="flex gap-2 items-center">
         <Button variant="ghost" size="sm" onClick={handleEyeDropper} icon={<Pipette size={16} />} title="Eyedropper" className="p-1.5 h-auto text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white" />
         <div 
           className="relative flex-1 h-3 rounded-full cursor-pointer shadow-inner ring-1 ring-black/5 dark:ring-white/10"
           style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
           onMouseDown={(e) => startDrag(e, 'hue')}
         >
           <div className="absolute top-1/2 -mt-2 -ml-2 w-4 h-4 border-2 border-white bg-transparent rounded-full shadow-sm pointer-events-none" style={{ left: `${(hsv.h / 360) * 100}%` }} />
         </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
         {['r','g','b'].map(k => (
            <div key={k} className="col-span-1 space-y-1">
                <label className="block text-[9px] text-slate-500 uppercase font-bold text-center">{k}</label>
                <input 
                  value={(currentRgb as any)[k]} 
                  onChange={(e) => {
                     const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                     const newRgb = { ...currentRgb, [k]: val };
                     const newHex = rgbToHex(`rgb(${newRgb.r}, ${newRgb.g}, ${newRgb.b})`);
                     setHsv(hexToHsv(newHex));
                     onChange(newHex);
                  }}
                  className="w-full bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded text-xs text-center py-1 text-slate-900 dark:text-neutral-200 focus:border-indigo-500 outline-none"
                />
            </div>
         ))}
      </div>
      
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1">
        <span className="text-xs text-slate-500 font-mono">#</span>
        <input 
          value={currentHex.replace('#', '').toUpperCase()}
          onChange={(e) => {
            const val = e.target.value;
            if (/^[0-9A-Fa-f]{0,6}$/.test(val) && val.length === 6) {
                const newH = rgbToHex('#' + val);
                setHsv(hexToHsv(newH));
                onChange(newH);
            }
          }}
          className="w-full bg-transparent text-xs font-mono text-slate-900 dark:text-neutral-200 outline-none uppercase"
        />
      </div>
      <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white dark:bg-neutral-900 border-t border-l border-slate-200 dark:border-neutral-800 transform rotate-45"></div>
    </div>
  );
};

interface LocalStop {
  id: string;
  offset: number;
  color: string;
}

const getAngleFromCoords = (x1: number, y1: number, x2: number, y2: number) => {
  const dy = y2 - y1;
  const dx = x2 - x1;
  let deg = Math.atan2(dy, dx) * 180 / Math.PI; 
  if (deg < 0) deg += 360;
  return Math.round(deg);
}

const getCoordsFromAngle = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  const r = 0.5;
  const cx = 0.5;
  const cy = 0.5;
  const dx = Math.cos(rad) * r;
  const dy = Math.sin(rad) * r;
  
  return {
    x1: ((cx - dx) * 100).toFixed(1) + '%',
    y1: ((cy - dy) * 100).toFixed(1) + '%',
    x2: ((cx + dx) * 100).toFixed(1) + '%',
    y2: ((cy + dy) * 100).toFixed(1) + '%'
  }
}

const GradientEditor = ({ gradId, code, onUpdate, onClose }: { gradId: string, code: string, onUpdate: (newCode: string) => void, onClose: () => void }) => {
  const [stops, setStops] = useState<LocalStop[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [type, setType] = useState<'linear' | 'radial'>('linear');
  const [angle, setAngle] = useState(90);
  const [radialPos, setRadialPos] = useState({ cx: 50, cy: 50 });
  
  const trackRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const stateRef = useRef({ type, angle, radialPos });
  
  useEffect(() => { stateRef.current = { type, angle, radialPos }; }, [type, angle, radialPos]);

  useEffect(() => {
    const d = getGradientData(code, gradId);
    if (d) {
       setType(d.type);
       const newStops = d.stops.map(s => {
         let off = parseFloat(s.offset);
         if (s.offset.includes('%')) off = parseFloat(s.offset);
         else if (off <= 1) off = off * 100;
         return { id: Math.random().toString(36).substr(2, 9), offset: isNaN(off) ? 0 : off, color: s.color };
       });
       newStops.sort((a,b) => a.offset - b.offset);
       setStops(newStops);
       if (newStops.length > 0) setSelectedStopId(newStops[0].id);

       if (d.type === 'linear' && d.coords) {
          const parsePos = (v: string) => v?.includes('%') ? parseFloat(v) : parseFloat(v) * 100;
          setAngle(getAngleFromCoords(parsePos(d.coords.x1 || '0'), parsePos(d.coords.y1 || '0'), parsePos(d.coords.x2 || '100'), parsePos(d.coords.y2 || '0')));
       } else if (d.type === 'radial' && d.coords) {
          const parsePos = (v: string) => v?.includes('%') ? parseFloat(v) : parseFloat(v) * 100;
          setRadialPos({ cx: parsePos(d.coords.cx || '50'), cy: parsePos(d.coords.cy || '50') });
       }
    }
  }, [gradId]);

  const pushUpdate = (newStops: LocalStop[], newType: 'linear' | 'radial', newAngle: number, newRadial: {cx: number, cy: number}) => {
     const sortedForSvg = [...newStops].sort((a,b) => a.offset - b.offset);
     const svgStops: GradientStop[] = sortedForSvg.map(s => ({
       offset: `${s.offset.toFixed(1)}%`,
       color: s.color
     }));
     
     let newCoords = {};
     if (newType === 'linear') {
       const c = getCoordsFromAngle(newAngle);
       newCoords = { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 };
     } else {
       newCoords = { cx: `${newRadial.cx}%`, cy: `${newRadial.cy}%`, r: '50%', fx: `${newRadial.cx}%`, fy: `${newRadial.cy}%` };
     }
     
     const newData: GradientData = { id: gradId, type: newType, coords: newCoords, stops: svgStops };
     onUpdate(upsertGradient(code, newData));
  };

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    
    let closestColor = '#ffffff';
    let minDist = 1000;
    stops.forEach(s => {
      const dist = Math.abs(s.offset - percent);
      if (dist < minDist) { minDist = dist; closestColor = s.color; }
    });

    const newStop: LocalStop = { id: Math.random().toString(36).substr(2, 9), offset: percent, color: closestColor };
    const newStops = [...stops, newStop];
    setStops(newStops);
    setSelectedStopId(newStop.id);
    pushUpdate(newStops, type, angle, radialPos);
  };

  const handleStopMouseDown = (e: React.MouseEvent, id: string) => {
     e.stopPropagation();
     setSelectedStopId(id);
     
     const track = trackRef.current;
     if (!track) return;
     const rect = track.getBoundingClientRect();

     const handleMove = (ev: MouseEvent) => {
       const percent = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
       
       setStops(prev => {
         const next = prev.map(s => s.id === id ? { ...s, offset: percent } : s);
         const s = stateRef.current;
         pushUpdate(next, s.type, s.angle, s.radialPos);
         return next;
       });
     };
     
     const handleUp = () => {
       window.removeEventListener('mousemove', handleMove);
       window.removeEventListener('mouseup', handleUp);
     };
     
     window.addEventListener('mousemove', handleMove);
     window.addEventListener('mouseup', handleUp);
  };

  const updateSelectedStop = (changes: Partial<LocalStop>) => {
    if (!selectedStopId) return;
    const newStops = stops.map(s => s.id === selectedStopId ? { ...s, ...changes } : s);
    setStops(newStops);
    pushUpdate(newStops, type, angle, radialPos);
  };

  const deleteSelectedStop = () => {
    if (!selectedStopId || stops.length <= 2) return;
    const newStops = stops.filter(s => s.id !== selectedStopId);
    setStops(newStops);
    setSelectedStopId(newStops[0].id);
    pushUpdate(newStops, type, angle, radialPos);
  };

  const selectedStop = stops.find(s => s.id === selectedStopId);
  const visualGradient = `linear-gradient(90deg, ${[...stops].sort((a,b)=>a.offset-b.offset).map(s => `${s.color} ${s.offset}%`).join(', ')})`;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-2xl border border-slate-200 dark:border-neutral-800 w-80 animate-in fade-in zoom-in-95 relative z-50 select-none">
       <div className="flex justify-between items-center mb-4">
         <div className="flex items-center gap-2">
           <Palette size={16} className="text-primary" />
           <span className="font-bold text-sm text-slate-700 dark:text-neutral-200">Gradient Editor</span>
         </div>
         <Button variant="ghost" size="sm" onClick={onClose} icon={<X size={16} />} className="p-1 h-auto rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800" />
       </div>

       <div className="mb-6 px-3 py-2">
         <div 
            className="h-10 w-full relative rounded-lg cursor-crosshair group shadow-md ring-1 ring-black/10 dark:ring-white/10" 
            ref={trackRef}
            onMouseDown={handleTrackMouseDown}
         >
            <div className="absolute inset-0 checkerboard rounded-lg opacity-50 pointer-events-none" />
            <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ background: visualGradient }} />
            
            {stops.map((stop) => (
               <div
                 key={stop.id}
                 className="absolute top-0 bottom-0 w-0 flex flex-col items-center justify-center group-hover:opacity-100"
                 style={{ left: `${stop.offset}%` }}
                 onMouseDown={(e) => handleStopMouseDown(e, stop.id)}
               >
                   <div 
                     className={clsx(
                        "w-4 h-full bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-600 shadow-lg cursor-ew-resize hover:scale-110 transition-transform relative z-10 rounded-sm flex items-center justify-center",
                        selectedStopId === stop.id && "ring-2 ring-primary border-primary z-20"
                     )}
                   >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stop.color }} />
                   </div>
               </div>
            ))}
         </div>
       </div>
       
       {selectedStop ? (
          <div className="bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-slate-100 dark:border-neutral-800 mb-4 space-y-3">
             <div className="flex items-center gap-2 justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stop Settings</span>
                <Button variant="ghost" size="sm" disabled={stops.length <= 2} onClick={deleteSelectedStop} icon={<Trash2 size={14} className="text-red-500" />} className="h-6 w-6 p-0 hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete Stop" />
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                   <div 
                      className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-md p-1.5 cursor-pointer hover:border-primary transition-colors h-9"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                   >
                      <div className="w-5 h-5 rounded border border-slate-100 dark:border-neutral-700 shadow-sm relative overflow-hidden shrink-0">
                         <div className="absolute inset-0 checkerboard opacity-40" />
                         <div className="absolute inset-0" style={{ backgroundColor: selectedStop.color }} />
                      </div>
                      <span className="text-xs font-mono text-slate-600 dark:text-neutral-300 uppercase truncate">{selectedStop.color}</span>
                   </div>
                   {showColorPicker && (
                      <div className="absolute top-full left-0 mt-2 z-50">
                         <ColorPicker 
                            color={rgbToHex(selectedStop.color)} 
                            onChange={(c) => updateSelectedStop({ color: c })} 
                            onClose={() => setShowColorPicker(false)} 
                         />
                         <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                      </div>
                   )}
                </div>
                
                <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-md p-1.5 h-9">
                   <span className="text-xs text-slate-400 font-bold ml-1">%</span>
                   <input 
                      type="number" min="0" max="100" step="0.1"
                      value={selectedStop.offset.toFixed(1)} 
                      onChange={(e) => updateSelectedStop({ offset: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                      className="w-full bg-transparent text-xs font-mono text-right outline-none text-slate-700 dark:text-neutral-200"
                   />
                </div>
             </div>
          </div>
       ) : (
          <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 dark:bg-neutral-800/30 rounded-lg border border-dashed border-slate-200 dark:border-neutral-800 mb-4">
             Select a stop to edit
          </div>
       )}
       
       <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-neutral-800">
          <div className="flex bg-slate-100 dark:bg-neutral-800 p-1 rounded-lg">
             {['linear', 'radial'].map(t => (
                <button 
                   key={t} 
                   onClick={() => { setType(t as any); pushUpdate(stops, t as any, angle, radialPos); }}
                   className={clsx(
                      "flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all tracking-wide",
                      type === t ? "bg-white dark:bg-primary text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300"
                   )}
                >
                   {t}
                </button>
             ))}
          </div>
          
          {type === 'linear' ? (
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-500 w-12 uppercase tracking-wide">Angle</span>
                <input 
                   type="range" min="0" max="360" value={angle} 
                   onChange={(e) => { const a = parseInt(e.target.value); setAngle(a); pushUpdate(stops, type, a, radialPos); }}
                   className="flex-1 h-1.5 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
                <span className="text-xs font-mono w-8 text-right text-slate-600 dark:text-neutral-400">{angle}°</span>
             </div>
          ) : (
             <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 w-12 uppercase tracking-wide">CX</span>
                    <input 
                       type="range" min="0" max="100" value={radialPos.cx} 
                       onChange={(e) => { const v = parseInt(e.target.value); setRadialPos(p => ({ ...p, cx: v })); pushUpdate(stops, type, angle, { ...radialPos, cx: v }); }}
                       className="flex-1 h-1.5 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <span className="text-xs font-mono w-8 text-right text-slate-600 dark:text-neutral-400">{radialPos.cx}%</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 w-12 uppercase tracking-wide">CY</span>
                    <input 
                       type="range" min="0" max="100" value={radialPos.cy} 
                       onChange={(e) => { const v = parseInt(e.target.value); setRadialPos(p => ({ ...p, cy: v })); pushUpdate(stops, type, angle, { ...radialPos, cy: v }); }}
                       className="flex-1 h-1.5 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <span className="text-xs font-mono w-8 text-right text-slate-600 dark:text-neutral-400">{radialPos.cy}%</span>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

const DataUriItem = ({ label, content }: { label: string, content: string }) => {
  const size = new Blob([content]).size;
  const sizeStr = size > 1024 ? `${(size / 1024).toFixed(2)} kB` : `${size} B`;

  const copy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-3 border border-slate-200 dark:border-neutral-800/50 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <span className="font-bold text-xs text-slate-700 dark:text-neutral-200">{label}</span>
           <span className="text-[10px] text-slate-400">{sizeStr}</span>
        </div>
        <button onClick={copy} className="text-slate-400 hover:text-primary transition-colors text-xs font-medium flex items-center gap-1">
           <Copy size={12} /> Copy
        </button>
      </div>
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded p-2 overflow-x-auto">
         <code className="text-[10px] font-mono whitespace-nowrap text-slate-600 dark:text-neutral-400">{content}</code>
      </div>
    </div>
  );
}

const DataUriView = ({ content }: { content: string }) => {
  const minified = content.replace(/>\s+</g, '><').trim().replace(/\n/g, '').replace(/\s+/g, ' ');
  const minifiedUri = `data:image/svg+xml,${minified.replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/{/g, '%7B').replace(/}/g, '%7D').replace(/</g, '%3C').replace(/>/g, '%3E')}`;
  
  const base64Uri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(minified)))}`;
  
  const encodedUri = `data:image/svg+xml,${encodeURIComponent(minified)}`;

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <DataUriItem label="Minified Data URI" content={minifiedUri} />
      <DataUriItem label="base64" content={base64Uri} />
      <DataUriItem label="encodeURIComponent" content={encodedUri} />
    </div>
  );
}

const Studio: React.FC = () => {
  const { svgContent: code, setSvgContent: setCode, darkMode, undo, redo, canUndo, canRedo } = useAppContext();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProps, setSelectedProps] = useState<ShapeProps | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingGradient, setEditingGradient] = useState<{ id: string, prop: 'fill' | 'stroke' } | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<{ prop: 'fill' | 'stroke', initialColor: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isClickingEnabled, setIsClickingEnabled] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 20, y: 20 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'react' | 'react-native' | 'data-uri'>('preview');
  
  const [previewBg, setPreviewBg] = useState('preview-bg-check-light');

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panelStartPosRef = useRef({ x: 0, y: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const sizingWrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const editorDecorationsRef = useRef<string[]>([]);
  const dragCounter = useRef(0);
  const lastMousePos = useRef({ x: 0, y: 0 });
  
  const isHoveringEditor = useRef(false);

  useEffect(() => {
    setPreviewBg(darkMode ? 'preview-bg-check-dark' : 'preview-bg-check-light');
  }, [darkMode]);

  useEffect(() => {
    if (!code.trim()) { setError("SVG code is empty"); return; }
    const doc = parseSvgContent(code);
    if (!doc || doc.querySelector('parsererror')) setError("Invalid SVG syntax");
    else setError(null);
  }, [code]);

  useEffect(() => {
    if (selectedId && editorRef.current) {
      const model = editorRef.current.getModel();
      if (!model) return;
      
      const escapedId = selectedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = model.findMatches(`id\\s*=\\s*["']${escapedId}["']`, false, true, false, null, false);
      
      if (matches && matches.length > 0) {
        const match = matches[0];
        editorRef.current.revealRangeInCenter(match.range);
        editorRef.current.setSelection(match.range);
      }
    }
  }, [selectedId, code]);

  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (!model) return;
      if (hoveredId) {
        const escapedId = hoveredId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = model.findMatches(`id\\s*=\\s*["']${escapedId}["']`, false, true, false, null, false);
        
        if (matches && matches.length > 0) {
          const match = matches[0];
          
          editorDecorationsRef.current = editorRef.current.deltaDecorations(editorDecorationsRef.current, [{ 
            range: match.range, 
            options: { 
              isWholeLine: false, 
              className: 'monaco-highlight-text', 
              glyphMarginClassName: 'monaco-highlight-line',
              overviewRuler: { color: 'rgba(99, 102, 241, 0.7)', position: 1 } 
            } 
          }]);
          
          if (!isHoveringEditor.current) {
             editorRef.current.revealRangeInCenter(match.range); 
          }
        }
      } else {
        editorDecorationsRef.current = editorRef.current.deltaDecorations(editorDecorationsRef.current, []);
      }
    }
  }, [hoveredId, code]);

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        e.preventDefault();
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };
  
    const handleWindowMouseUp = () => {
      if (isPanning) setIsPanning(false);
    };
  
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isPanning]);

  const handleEditorDidMount: OnMount = (editor, monaco) => { 
    editorRef.current = editor; 
    
    const container = editor.getContainerDomNode();
    container.addEventListener('mouseenter', () => { isHoveringEditor.current = true; });
    container.addEventListener('mouseleave', () => { isHoveringEditor.current = false; });
    
    editor.onMouseMove((e) => {
      isHoveringEditor.current = true;
      if (!e.target || !e.target.position) return;
      const model = editor.getModel();
      if (!model) return;
      
      const pos = e.target.position;
      const offset = model.getOffsetAt(pos);
      const text = model.getValue();
      
      const limit = 1000000;
      
      const searchWindowStart = Math.max(0, offset - limit);
      const searchWindowEnd = Math.min(text.length, offset + limit);
      
      const windowText = text.slice(searchWindowStart, searchWindowEnd);
      const relativeOffset = offset - searchWindowStart;
      
      let relativeStart = -1;
      let checkPos = relativeOffset;
      
      while (checkPos >= 0) {
        const lastOpen = windowText.lastIndexOf('<', checkPos);
        if (lastOpen === -1) break;
        
        const nextChar = windowText[lastOpen + 1];
        if (nextChar && nextChar !== '/' && nextChar !== '!' && nextChar !== '?') {
          relativeStart = lastOpen;
          break;
        }
        checkPos = lastOpen - 1;
      }
      
      if (relativeStart !== -1) {
        const relativeEnd = windowText.indexOf('>', relativeStart);
        
        if (relativeEnd !== -1 && relativeEnd >= relativeOffset) {
           const tagChunk = windowText.slice(relativeStart, relativeEnd + 1);
           const idMatch = tagChunk.match(/id\s*=\s*["']([^"']+)["']/);
           if (idMatch) {
              setHoveredId(idMatch[1]);
              return;
           }
        }
      }

      const lineContent = model.getLineContent(pos.lineNumber);
      const column = pos.column;
      const matches = [...lineContent.matchAll(/id\s*=\s*["']([^"']+)["']/g)];
      
      if (matches.length > 0) {
        let closestMatch = matches[0];
        let minDiff = Math.abs((matches[0].index || 0) - column);
        
        for (const m of matches) {
           const matchIndex = m.index || 0;
           const diff = Math.abs(matchIndex - column);
           if (diff < minDiff) {
              minDiff = diff;
              closestMatch = m;
           }
        }
        
        if (closestMatch && closestMatch[1]) {
           setHoveredId(closestMatch[1]);
        } else {
           setHoveredId(null);
        }
      } else {
         setHoveredId(null);
      }
    });
    
    editor.onMouseLeave(() => {
        setHoveredId(null);
        isHoveringEditor.current = false;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { 
      setCode(event.target?.result as string); 
      setSelectedId(null); 
      setZoom(1); 
      setPan({ x: 0, y: 0 });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const hasFile = Array.from(e.dataTransfer.items).some(item => item.kind === 'file');
      if (hasFile) {
        setIsDraggingFile(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    dragCounter.current = 0;
    
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'image/svg+xml' || file.name.endsWith('.svg'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
          setCode(event.target?.result as string);
          setSelectedId(null);
          setZoom(1);
          setPan({ x: 0, y: 0 });
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = () => {
    const { content, count } = smartAnalyzeSvg(code);
    if (count > 0) { setCode(content); setError(null); setSelectedId(null); }
  };

  const handleClear = () => { 
    setCode(''); 
    setSelectedId(null); 
    setHoveredId(null); 
    setError(null); 
    setPan({ x: 0, y: 0 });
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };
  
  const handleSeparateShape = () => {
    if (!selectedId || !selectedProps || selectedProps.tagName !== 'path' || !selectedProps.d) return;
    const subPaths = decomposePath(selectedProps.d);
    if (subPaths.length <= 1) { alert("This shape is already a single path or all parts are connected."); return; }
    const doc = parseSvgContent(code);
    if (!doc) return;
    const pathEl = doc.getElementById(selectedId);
    if (pathEl && pathEl.parentNode) {
      subPaths.forEach(d => {
        const newPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        Array.from(pathEl.attributes).forEach(attr => { if (attr.name !== 'd' && attr.name !== 'id') newPath.setAttribute(attr.name, attr.value); });
        newPath.setAttribute('d', d);
        newPath.setAttribute('id', getNextId(doc, 'path'));
        pathEl.parentNode?.insertBefore(newPath, pathEl);
      });
      pathEl.parentNode.removeChild(pathEl);
      setCode(new XMLSerializer().serializeToString(doc));
      setSelectedId(null);
    }
  };

  const updateSelectionAndProps = useCallback(() => {
    if (!contentRef.current) return;
    const svgEl = contentRef.current.querySelector('svg');
    if (!svgEl) return;
    if (selectedId) {
      const el = svgEl.getElementById(selectedId);
      if (el) {
         const computedStyle = window.getComputedStyle(el);
         setSelectedProps({
          tagName: el.tagName,
          fill: el.getAttribute('fill') || computedStyle.fill || 'none',
          stroke: el.getAttribute('stroke') || computedStyle.stroke || 'none',
          strokeWidth: el.getAttribute('stroke-width') || computedStyle.strokeWidth || '1',
          x: el.getAttribute('x') || undefined, y: el.getAttribute('y') || undefined,
          cx: el.getAttribute('cx') || undefined, cy: el.getAttribute('cy') || undefined,
          d: el.getAttribute('d') || undefined
        });
      } else { setSelectedId(null); setSelectedProps(null); }
    } else { setSelectedProps(null); }
  }, [selectedId, code]);

  useEffect(() => { updateSelectionAndProps(); window.addEventListener('resize', updateSelectionAndProps); const observer = new MutationObserver(updateSelectionAndProps); if (contentRef.current) observer.observe(contentRef.current, { subtree: true, attributes: true }); return () => { window.removeEventListener('resize', updateSelectionAndProps); observer.disconnect(); }; }, [updateSelectionAndProps]);

  const handlePanelDragStart = (e: React.MouseEvent) => { e.preventDefault(); setIsDraggingPanel(true); dragStartRef.current = { x: e.clientX, y: e.clientY }; panelStartPosRef.current = { ...panelPos }; };
  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDraggingPanel) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanelPos({ x: panelStartPosRef.current.x + dx, y: Math.max(0, panelStartPosRef.current.y + dy) });
    };
    const handleDragEnd = () => setIsDraggingPanel(false);
    if (isDraggingPanel) { window.addEventListener('mousemove', handleDragMove); window.addEventListener('mouseup', handleDragEnd); }
    return () => { window.removeEventListener('mousemove', handleDragMove); window.removeEventListener('mouseup', handleDragEnd); };
  }, [isDraggingPanel]);

  const handleWheel = useCallback((e: React.WheelEvent) => { if (e.shiftKey) { e.preventDefault(); setZoom(prev => Math.max(0.1, Math.min(8, prev + (e.deltaY > 0 ? -0.1 : 0.1)))); } }, []);
  
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (isClickingEnabled) return; 
    if (e.button === 0) { 
        setIsPanning(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (isPanning) return;
    
    isHoveringEditor.current = false;

    let target = e.target as Element;
    
    if (target.classList.contains('__studio_highlight__')) {
       target = target.previousElementSibling as Element || target.parentElement as Element;
    }

    if (target === contentRef.current || target.tagName === 'DIV' || target.tagName.toLowerCase() === 'svg') {
       setHoveredId(null);
       return;
    }
    
    let id = target.getAttribute('id');

    if (!id && target.parentElement && target.parentElement.tagName.toLowerCase() !== 'svg' && target.parentElement !== contentRef.current) {
        id = target.parentElement.getAttribute('id');
    }
    
    setHoveredId(id || null);
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isClickingEnabled) return;

    let target = e.target as Element;
    
    if (target.classList.contains('__studio_highlight__')) {
       target = target.previousElementSibling as Element || target.parentElement as Element;
    }

    if (['svg', 'div'].includes(target.tagName.toLowerCase()) || target === contentRef.current) { setSelectedId(null); setActiveColorPicker(null); setEditingGradient(null); return; }
    
    let id = target.getAttribute('id');
    
    if (!id && contentRef.current) {
       if (['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'path', 'text', 'image'].includes(target.tagName.toLowerCase())) {
           const index = Array.from(contentRef.current.querySelectorAll(target.tagName)).indexOf(target);
           const result = injectIdToSvg(code, target.tagName, index);
           if (result) { setCode(result.newContent); setSelectedId(result.newId); setActiveColorPicker(null); setEditingGradient(null); return; }
       }
    }
    
    if (!id) {
        let current: Element | null = target;
        while (current && current !== contentRef.current) {
            if (current.tagName === 'svg') break;
            const pid = current.getAttribute('id');
            if (pid) { id = pid; break; }
            current = current.parentElement;
        }
    }

    if (id) { setSelectedId(id); setActiveColorPicker(null); setEditingGradient(null); }
  };

  const updateShape = (attr: string, value: string) => { if (!selectedId) return; setSelectedProps(prev => prev ? ({ ...prev, [attr]: value }) : null); setCode(updateSvgElement(code, selectedId, { [attr]: value })); };
  const createAndEditGradient = (prop: 'fill' | 'stroke') => {
    if (!selectedId || !selectedProps) return;
    const gradId = generateUniqueId(code, 'gradient');
    const startColor = rgbToHex(selectedProps[prop]);
    const newGradient: GradientData = { id: gradId, type: 'linear', coords: { x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, stops: [{ offset: '0%', color: startColor }, { offset: '100%', color: startColor === '#ffffff' ? '#000000' : '#ffffff' }] };
    let newCode = upsertGradient(code, newGradient);
    newCode = updateSvgElement(newCode, selectedId, { [prop]: `url(#${gradId})` });
    setCode(newCode);
    setEditingGradient({ id: gradId, prop });
    setActiveColorPicker(null);
  };

  const isUrlRef = (val: string) => val && val.trim().match(/^url\(['"]?#([^'")]+)['"]?\)/i);

  const getGeneratedCode = useMemo(() => {
    if (rightPanelMode === 'react') return generateReactComponent(code);
    if (rightPanelMode === 'react-native') return generateReactNativeComponent(code);
    return code; 
  }, [code, rightPanelMode]);

  const previewCode = useMemo(() => {
    if (!code) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(code, 'image/svg+xml');
      if (doc.querySelector('parsererror')) return code;

      const injectHighlight = (id: string, filterId: string) => {
        const el = doc.getElementById(id);
        if (!el || !el.parentNode) return;
        
        const clone = el.cloneNode(true) as Element;
        clone.removeAttribute('id');
        clone.setAttribute('class', '__studio_highlight__');
        
        clone.setAttribute('mask', 'none');
        clone.setAttribute('clip-path', 'none');
        
        clone.setAttribute('filter', `url(#${filterId})`);
        clone.setAttribute('style', 'pointer-events: none; fill-opacity: 1; stroke-opacity: 1; opacity: 1;');
        
        if (!clone.getAttribute('stroke') && clone.getAttribute('fill') === 'none') {
             clone.setAttribute('fill', '#000000');
        }

        el.parentNode.insertBefore(clone, el.nextSibling);
      };

      if (selectedId) injectHighlight(selectedId, 'studio-selection-filter');
      if (hoveredId && hoveredId !== selectedId) injectHighlight(hoveredId, 'studio-hover-filter');

      return new XMLSerializer().serializeToString(doc);
    } catch (e) {
      return code;
    }
  }, [code, selectedId, hoveredId]);

  return (
    <div 
      className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-background text-slate-700 dark:text-neutral-300 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <svg width="0" height="0" className="absolute pointer-events-none" style={{ position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
         <defs>
            <filter id="studio-selection-filter" x="-500%" y="-500%" width="1000%" height="1000%">
               <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated"/>
               <feComposite in="dilated" in2="SourceAlpha" operator="out" result="outline"/>
               <feFlood floodColor="#ef4444" result="flood"/>
               <feComposite in="flood" in2="outline" operator="in" result="coloredOutline"/>
               <feMerge>
                  <feMergeNode in="coloredOutline"/>
               </feMerge>
            </filter>
            <filter id="studio-hover-filter" x="-500%" y="-500%" width="1000%" height="1000%">
               <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="dilated"/>
               <feComposite in="dilated" in2="SourceAlpha" operator="out" result="outline"/>
               <feFlood floodColor="#ef4444" floodOpacity="0.6" result="flood"/>
               <feComposite in="flood" in2="outline" operator="in" result="coloredOutline"/>
               <feMerge>
                  <feMergeNode in="coloredOutline"/>
               </feMerge>
            </filter>
         </defs>
      </svg>
      <style>{`
        .monaco-highlight-text { 
           background-color: rgba(99, 102, 241, 0.2); 
           color: #6366f1 !important; 
           font-weight: bold;
           border: 1px solid rgba(99, 102, 241, 0.4);
           border-radius: 3px;
        }
        
        .monaco-highlight-line {
           background-color: #6366f1;
           width: 5px !important;
           margin-left: 5px;
        }
        
        [id="${selectedId}"] { 
           cursor: move; 
        } 
        
        [id="${hoveredId}"] { 
           cursor: pointer;
        }
      `}</style>
      
      {isDraggingFile && (
        <div className="absolute inset-0 z-[100] bg-primary/20 backdrop-blur-sm flex items-center justify-center border-4 border-primary border-dashed m-4 rounded-xl animate-in fade-in">
           <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                 <FileUp size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Drop SVG File Here</h3>
                <p className="text-slate-500 dark:text-neutral-400 mt-1">Open file in Studio</p>
              </div>
           </div>
        </div>
      )}

      <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-neutral-800 min-w-0 bg-white dark:bg-neutral-900/50">
        <div className="h-12 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between px-4 bg-surface shrink-0 relative z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">Code Editor</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
             <div className="flex items-center mr-2 border-r border-slate-200 dark:border-neutral-800 pr-2 gap-1">
                <Button size="sm" variant="ghost" disabled={!canUndo} onClick={undo} icon={<Undo2 size={16} />} title="Undo" />
                <Button size="sm" variant="ghost" disabled={!canRedo} onClick={redo} icon={<Redo2 size={16} />} title="Redo" />
             </div>
             <Button size="sm" variant="ghost" onClick={handleClear} icon={<Eraser size={16} />} title="Clear Editor" />
             <Button size="sm" variant="ghost" onClick={handleAnalyze} icon={<Wand2 size={16} />} title="Auto Analyze & Separate" />
             <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16} />} title="Upload SVG" />
             <input ref={fileInputRef} type="file" accept=".svg" className="hidden" onChange={handleFileUpload} />
             <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(code)} icon={<Copy size={16} />} title="Copy SVG Code" />
             <Button size="sm" variant="ghost" onClick={() => downloadBlob(code, 'icon.svg', 'image/svg+xml')} icon={<Download size={16} />} title="Download File" />
          </div>
        </div>
        <div className="flex-1 relative">
           {error && <div className="absolute top-2 right-4 z-10 bg-red-500/10 border border-red-500/50 text-red-500 text-xs px-3 py-2 rounded flex items-center gap-2 backdrop-blur-md"><AlertCircle size={12} /> {error}</div>}
           <Editor 
             height="100%" 
             defaultLanguage="xml" 
             language="xml"
             theme={darkMode ? "vs-dark" : "light"} 
             value={code} 
             onChange={(val) => { if (val) setCode(val); }} 
             onMount={handleEditorDidMount} 
             options={{ 
               readOnly: false, 
               minimap: { enabled: false }, 
               fontSize: 13, 
               fontFamily: '"Google Sans Code", monospace', 
               wordWrap: 'on', 
               padding: { top: 16, bottom: 16 } 
             }} 
           />
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-black relative">
        <div className="h-12 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between px-4 bg-surface z-10 shadow-sm shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
               <div className="flex bg-slate-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-slate-200 dark:border-neutral-800">
                  <button 
                     className={clsx("px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wider transition-colors", rightPanelMode === 'preview' ? "bg-white dark:bg-neutral-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300")} 
                     onClick={() => setRightPanelMode('preview')}
                  >
                     Preview
                  </button>
                  <button 
                     className={clsx("px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wider transition-colors", rightPanelMode === 'react' ? "bg-white dark:bg-neutral-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300")} 
                     onClick={() => setRightPanelMode('react')}
                  >
                     React
                  </button>
                  <button 
                     className={clsx("px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wider transition-colors", rightPanelMode === 'react-native' ? "bg-white dark:bg-neutral-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300")} 
                     onClick={() => setRightPanelMode('react-native')}
                  >
                     React Native
                  </button>
                  <button 
                     className={clsx("px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wider transition-colors whitespace-nowrap", rightPanelMode === 'data-uri' ? "bg-white dark:bg-neutral-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300")} 
                     onClick={() => setRightPanelMode('data-uri')}
                  >
                     Data URI
                  </button>
               </div>
            </div>
            
            <div className="flex items-center gap-1">
               {rightPanelMode === 'preview' ? (
                  <>
                     <Button 
                        variant={isClickingEnabled ? "secondary" : "ghost"} 
                        size="sm" 
                        onClick={() => setIsClickingEnabled(!isClickingEnabled)} 
                        icon={<CursorIcon filled={isClickingEnabled} />} 
                        title={isClickingEnabled ? "Selection Mode" : "Pan Mode"} 
                        className={clsx("p-1.5 h-auto", isClickingEnabled ? "text-primary bg-primary/10 ring-1 ring-primary/20" : "text-slate-500")} 
                     />
                     <div className="w-px h-4 bg-slate-200 dark:bg-neutral-700 mx-2" />

                     <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.2, zoom - 0.2))} icon={<ZoomOut size={16} />} title="Zoom Out" className="p-1.5 h-auto text-slate-500" />
                     <span className="text-xs font-mono w-10 text-center text-slate-600 dark:text-slate-500">{Math.round(zoom * 100)}%</span>
                     <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(5, zoom + 0.2))} icon={<ZoomIn size={16} />} title="Zoom In" className="p-1.5 h-auto text-slate-500" />
                     <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} icon={<RotateCcw size={16} />} title="Reset Zoom" className="p-1.5 h-auto text-slate-500 ml-1" />
                  </>
               ) : (
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(getGeneratedCode)} icon={<Copy size={16} />} title="Copy Code" />
               )}
            </div>
        </div>

        <div className="flex-1 relative overflow-hidden flex flex-col">
          {rightPanelMode === 'preview' && (
             <>
                <div 
                  ref={previewContainerRef} 
                  onWheel={handleWheel} 
                  onMouseDown={handleContainerMouseDown}
                  className={clsx(
                    "flex-1 relative overflow-hidden flex items-center justify-center p-8 transition-colors",
                    previewBg,
                    isClickingEnabled ? "cursor-default" : isPanning ? "cursor-grabbing" : "cursor-move"
                  )}
                  onClick={() => { setSelectedId(null); setEditingGradient(null); setActiveColorPicker(null); }}
                >
                  <div ref={sizingWrapperRef} className="relative shadow-2xl transition-transform duration-75 ease-out origin-center ring-1 ring-slate-200 dark:ring-neutral-800" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, maxWidth: '90%', maxHeight: '90%', minWidth: '50px', minHeight: '50px', display: 'inline-flex' }}>
                     <div ref={contentRef} className="w-full h-full [&>svg]:block [&>svg]:w-full [&>svg]:h-full [&>svg]:overflow-visible pointer-events-auto" onClick={handlePreviewClick} onMouseMove={handlePreviewMouseMove} onMouseLeave={() => setHoveredId(null)} dangerouslySetInnerHTML={{ __html: previewCode }} />
                  </div>
                </div>
                
                <div className="absolute bottom-4 right-4 flex gap-2 p-1.5 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-slate-200 dark:border-neutral-800 z-30">
                  <button 
                    onClick={() => setPreviewBg('preview-bg-light')} 
                    className={clsx(
                       "w-6 h-6 rounded border transition-all",
                       previewBg === 'preview-bg-light' ? "ring-2 ring-primary border-transparent" : "border-slate-200 dark:border-neutral-600 hover:scale-110"
                    )}
                    title="White Background"
                  >
                     <div className="w-full h-full bg-white rounded-sm" />
                  </button>
                  <button 
                    onClick={() => setPreviewBg('preview-bg-check-light')} 
                    className={clsx(
                       "w-6 h-6 rounded border transition-all overflow-hidden",
                       previewBg === 'preview-bg-check-light' ? "ring-2 ring-primary border-transparent" : "border-slate-200 dark:border-neutral-600 hover:scale-110"
                    )}
                    title="Light Grid Background"
                  >
                     <div className="w-full h-full preview-bg-check-light" />
                  </button>
                  <button 
                    onClick={() => setPreviewBg('preview-bg-check-dark')} 
                    className={clsx(
                       "w-6 h-6 rounded border transition-all overflow-hidden",
                       previewBg === 'preview-bg-check-dark' ? "ring-2 ring-primary border-transparent" : "border-slate-200 dark:border-neutral-600 hover:scale-110"
                    )}
                    title="Dark Grid Background"
                  >
                     <div className="w-full h-full preview-bg-check-dark" />
                  </button>
                  <button 
                    onClick={() => setPreviewBg('preview-bg-dark')} 
                    className={clsx(
                       "w-6 h-6 rounded border transition-all",
                       previewBg === 'preview-bg-dark' ? "ring-2 ring-primary border-transparent" : "border-slate-200 dark:border-neutral-600 hover:scale-110"
                    )}
                    title="Black Background"
                  >
                     <div className="w-full h-full bg-black rounded-sm" />
                  </button>
                </div>
             </>
          )}

          {rightPanelMode === 'data-uri' && (
             <div className="flex-1 bg-white dark:bg-neutral-900 border-t border-slate-200 dark:border-neutral-800">
               <DataUriView content={code} />
             </div>
          )}

          {(rightPanelMode === 'react' || rightPanelMode === 'react-native') && (
             <div className="flex-1 bg-white dark:bg-neutral-900 border-t border-slate-200 dark:border-neutral-800">
               <Editor 
                  height="100%" 
                  defaultLanguage="javascript" 
                  language="javascript" 
                  theme={darkMode ? "vs-dark" : "light"} 
                  value={getGeneratedCode} 
                  options={{ 
                    readOnly: true, 
                    minimap: { enabled: false }, 
                    fontSize: 13, 
                    fontFamily: '"Google Sans Code", monospace', 
                    wordWrap: 'on', 
                    padding: { top: 16, bottom: 16 } 
                  }} 
                />
             </div>
          )}
        </div>
        
        {rightPanelMode === 'preview' && selectedId && selectedProps && (
          <div className="absolute w-72 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-visible animate-in fade-in zoom-in-95 z-[100] ring-1 ring-black/5" style={{ transform: `translate(${panelPos.x}px, ${panelPos.y}px)`, top: 0, left: 0 }}>
            <div className="flex justify-between items-center bg-white/50 dark:bg-white/5 p-3 border-b border-slate-200/50 dark:border-white/5 cursor-grab active:cursor-grabbing select-none rounded-t-2xl" onMouseDown={handlePanelDragStart}>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2"><GripHorizontal size={14} className="text-slate-400" />{selectedProps.tagName}</span>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedId(null); setEditingGradient(null); setActiveColorPicker(null); }} icon={<X size={14} />} title="Close Panel" className="p-1 h-auto rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white" />
            </div>
            <div className="p-4 space-y-5">
              {selectedProps.tagName === 'path' && selectedProps.d && decomposePath(selectedProps.d).length > 1 && (<div className="pb-3 border-b border-slate-200 dark:border-white/10"><Button variant="secondary" size="sm" className="w-full justify-between" icon={<Split size={14}/>} onClick={handleSeparateShape} title="Split compound path into separate shapes">Separate Shapes</Button></div>)}
              <div className="space-y-2 relative">
                <div className="flex justify-between items-center">
                   <label className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">Fill</label>
                   {isUrlRef(selectedProps.fill) ? (<Button variant="ghost" size="sm" onClick={() => { const match = selectedProps.fill.match(/^url\(['"]?#([^'")]+)['"]?\)/i); if (match) { setEditingGradient({ id: match[1], prop: 'fill' }); setActiveColorPicker(null); } }} className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 h-auto rounded-full font-medium transition-colors" title="Edit existing gradient">Edit Gradient</Button>) : (<Button variant="ghost" size="sm" onClick={() => createAndEditGradient('fill')} className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1 p-0 h-auto bg-transparent hover:bg-transparent shadow-none" title="Convert to Gradient"><Palette size={10} /> Gradient</Button>)}
                </div>
                {editingGradient?.prop === 'fill' ? (
                   <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200]">
                      <GradientEditor gradId={editingGradient.id} code={code} onUpdate={setCode} onClose={() => setEditingGradient(null)} />
                      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10" onClick={() => setEditingGradient(null)} />
                   </div>
                ) : (
                  <div className="flex items-center gap-2">
                     {!isUrlRef(selectedProps.fill) && (
                       <div className="relative">
                          <Button variant="ghost" className="w-9 h-9 p-0 rounded-lg overflow-hidden border border-slate-200 dark:border-neutral-700 shadow-sm shrink-0 ring-1 ring-slate-900/5 relative hover:bg-transparent" onClick={() => setActiveColorPicker(activeColorPicker?.prop === 'fill' ? null : { prop: 'fill', initialColor: selectedProps.fill })} title="Change Fill Color">
                            <div className="absolute inset-0 checkerboard opacity-20" />
                            <div className="absolute inset-0" style={{ backgroundColor: selectedProps.fill }} />
                          </Button>
                          {activeColorPicker?.prop === 'fill' && (<><div className="fixed inset-0 z-40" onClick={() => setActiveColorPicker(null)} /><ColorPicker color={rgbToHex(selectedProps.fill)} onChange={(c) => updateShape('fill', c)} onClose={() => setActiveColorPicker(null)} /></>)}
                       </div>
                     )}
                     <input type="text" value={selectedProps.fill} onChange={(e) => updateShape('fill', e.target.value)} className="flex-1 min-w-0 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-primary outline-none transition-colors shadow-sm" />
                  </div>
                )}
              </div>
              <div className="space-y-2 relative">
                 <div className="flex justify-between items-center">
                   <label className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">Stroke</label>
                   {isUrlRef(selectedProps.stroke) ? (<Button variant="ghost" size="sm" onClick={() => { const match = selectedProps.stroke.match(/^url\(['"]?#([^'")]+)['"]?\)/i); if (match) { setEditingGradient({ id: match[1], prop: 'stroke' }); setActiveColorPicker(null); } }} className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 h-auto rounded-full font-medium transition-colors" title="Edit existing gradient">Edit Gradient</Button>) : (<Button variant="ghost" size="sm" onClick={() => createAndEditGradient('stroke')} className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1 p-0 h-auto bg-transparent hover:bg-transparent shadow-none" title="Convert to Gradient"><Palette size={10} /> Gradient</Button>)}
                </div>
                {editingGradient?.prop === 'stroke' ? (
                   <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200]">
                      <GradientEditor gradId={editingGradient.id} code={code} onUpdate={setCode} onClose={() => setEditingGradient(null)} />
                      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10" onClick={() => setEditingGradient(null)} />
                   </div>
                ) : (
                  <div className="flex items-center gap-2">
                     {!isUrlRef(selectedProps.stroke) && (
                       <div className="relative">
                          <Button variant="ghost" className="w-9 h-9 p-0 rounded-lg overflow-hidden border border-slate-200 dark:border-neutral-700 shadow-sm shrink-0 ring-1 ring-slate-900/5 relative hover:bg-transparent" onClick={() => setActiveColorPicker(activeColorPicker?.prop === 'stroke' ? null : { prop: 'stroke', initialColor: selectedProps.stroke })} title="Change Stroke Color">
                             <div className="absolute inset-0 checkerboard opacity-20" />
                             <div className="absolute inset-0" style={{ backgroundColor: selectedProps.stroke === 'none' ? 'transparent' : selectedProps.stroke }} />
                          </Button>
                          {activeColorPicker?.prop === 'stroke' && (<><div className="fixed inset-0 z-40" onClick={() => setActiveColorPicker(null)} /><ColorPicker color={rgbToHex(selectedProps.stroke)} onChange={(c) => updateShape('stroke', c)} onClose={() => setActiveColorPicker(null)} /></>)}
                       </div>
                     )}
                     <input type="text" value={selectedProps.stroke} onChange={(e) => updateShape('stroke', e.target.value)} className="flex-1 min-w-0 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-primary outline-none transition-colors shadow-sm" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><label className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">Width</label><span className="text-xs font-mono text-slate-500">{parseFloat(selectedProps.strokeWidth) || 0}px</span></div>
                <input type="range" min="0" max="20" step="0.5" value={parseFloat(selectedProps.strokeWidth) || 0} onChange={(e) => updateShape('strokeWidth', e.target.value)} className="w-full h-1.5 bg-slate-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary hover:[&::-webkit-slider-thumb]:scale-125 transition-all shadow-sm"/>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                <Button variant="danger" size="sm" className="w-full justify-center" icon={<Trash2 size={14} />} title="Remove this element" onClick={() => { const doc = parseSvgContent(code); const el = doc?.getElementById(selectedId); if (el && doc) { el.parentNode?.removeChild(el); setCode(new XMLSerializer().serializeToString(doc)); setSelectedId(null); } }}>Delete Shape</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Studio;