import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, MousePointer2, Scissors, Scan, SquareDashedMousePointer, FileUp } from 'lucide-react';
import { Button } from '../components/Button';
import { parseSvgContent, downloadBlob } from '../utils/svgHelpers';
import { useAppContext } from '../AppContext';
import clsx from 'clsx';

type CropMode = 'keep-inside' | 'cut-out';

const Cropper: React.FC = () => {
  const { svgContent, setSvgContent } = useAppContext();
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 200, h: 200 }); 
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 });
  const [cropMode, setCropMode] = useState<CropMode>('keep-inside');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounter = useRef(0);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const doc = parseSvgContent(svgContent);
    if (!doc) return;
    const svgEl = doc.querySelector('svg');
    if (svgEl) {
      const vb = svgEl.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
      if (vb && vb.length === 4) {
        setViewBox({ x: vb[0], y: vb[1], w: vb[2], h: vb[3] });
        setCrop({ x: vb[0] + vb[2]*0.25, y: vb[1] + vb[3]*0.25, w: vb[2]*0.5, h: vb[3]*0.5 });
      } else {
        const w = parseFloat(svgEl.getAttribute('width') || '200');
        const h = parseFloat(svgEl.getAttribute('height') || '200');
        setViewBox({ x: 0, y: 0, w, h });
        setCrop({ x: w*0.25, y: h*0.25, w: w*0.5, h: h*0.5 });
      }
    }
  }, [svgContent]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setSvgContent(event.target?.result as string);
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
          setSvgContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleExport = () => {
    const doc = parseSvgContent(svgContent);
    if (!doc) return;
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return;

    const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    while (svgEl.firstChild) {
      g.appendChild(svgEl.firstChild);
    }
    
    let defs = svgEl.querySelector('defs');
    if (!defs) {
      defs = doc.createElementNS("http://www.w3.org/2000/svg", "defs");
      svgEl.insertBefore(defs, svgEl.firstChild);
    }

    const uniqueId = Math.random().toString(36).substr(2, 6);

    if (cropMode === 'keep-inside') {
      const clipId = `crop-clip-${uniqueId}`;
      const clipPath = doc.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clipPath.setAttribute('id', clipId);
      
      const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute('x', String(crop.x));
      rect.setAttribute('y', String(crop.y));
      rect.setAttribute('width', String(crop.w));
      rect.setAttribute('height', String(crop.h));
      
      clipPath.appendChild(rect);
      defs.appendChild(clipPath);
      
      g.setAttribute('clip-path', `url(#${clipId})`);
      svgEl.appendChild(g);

      svgEl.setAttribute('viewBox', `${crop.x} ${crop.y} ${crop.w} ${crop.h}`);
      
    } else {
      const maskId = `crop-mask-${uniqueId}`;
      const mask = doc.createElementNS("http://www.w3.org/2000/svg", "mask");
      mask.setAttribute('id', maskId);
      
      const bgWhite = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgWhite.setAttribute('x', String(viewBox.x - 10000));
      bgWhite.setAttribute('y', String(viewBox.y - 10000));
      bgWhite.setAttribute('width', String(viewBox.w + 20000));
      bgWhite.setAttribute('height', String(viewBox.h + 20000));
      bgWhite.setAttribute('fill', 'white');
      
      const cutOut = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      cutOut.setAttribute('x', String(crop.x));
      cutOut.setAttribute('y', String(crop.y));
      cutOut.setAttribute('width', String(crop.w));
      cutOut.setAttribute('height', String(crop.h));
      cutOut.setAttribute('fill', 'black');
      
      mask.appendChild(bgWhite);
      mask.appendChild(cutOut);
      defs.appendChild(mask);
      
      g.setAttribute('mask', `url(#${maskId})`);
      svgEl.appendChild(g);
      
      svgEl.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    }

    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');

    const serializer = new XMLSerializer();
    const newSvg = serializer.serializeToString(doc);
    downloadBlob(newSvg, `processed-${cropMode}.svg`, 'image/svg+xml');
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [startMousePos, setStartMousePos] = useState({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    setDragHandle(handle);
    
    const svgPos = getSvgPoint(e.clientX, e.clientY);
    setStartMousePos(svgPos);
    setStartCrop({ ...crop });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const currentSvgPos = getSvgPoint(e.clientX, e.clientY);
    const dx = currentSvgPos.x - startMousePos.x;
    const dy = currentSvgPos.y - startMousePos.y;

    let newCrop = { ...startCrop };
    
    const minX = viewBox.x;
    const maxX = viewBox.x + viewBox.w;
    const minY = viewBox.y;
    const maxY = viewBox.y + viewBox.h;

    if (dragHandle === 'move') {
      let nextX = startCrop.x + dx;
      let nextY = startCrop.y + dy;

      if (nextX < minX) nextX = minX;
      if (nextX + newCrop.w > maxX) nextX = maxX - newCrop.w;

      if (nextY < minY) nextY = minY;
      if (nextY + newCrop.h > maxY) nextY = maxY - newCrop.h;

      newCrop.x = nextX;
      newCrop.y = nextY;
    } else {
      if (dragHandle?.includes('e')) {
        const proposedW = startCrop.w + dx;
        const maxW = maxX - newCrop.x;
        newCrop.w = Math.max(1, Math.min(proposedW, maxW));
      }
      
      if (dragHandle?.includes('w')) {
        const proposedX = startCrop.x + dx;
        const maxLeftX = startCrop.x + startCrop.w - 1;
        const clampedX = Math.max(minX, Math.min(proposedX, maxLeftX));
        const delta = clampedX - startCrop.x;
        
        newCrop.x = clampedX;
        newCrop.w = startCrop.w - delta;
      }
      
      if (dragHandle?.includes('s')) {
        const proposedH = startCrop.h + dy;
        const maxH = maxY - newCrop.y;
        newCrop.h = Math.max(1, Math.min(proposedH, maxH));
      }
      
      if (dragHandle?.includes('n')) {
        const proposedY = startCrop.y + dy;
        const maxTopY = startCrop.y + startCrop.h - 1;
        const clampedY = Math.max(minY, Math.min(proposedY, maxTopY));
        const delta = clampedY - startCrop.y;
        
        newCrop.y = clampedY;
        newCrop.h = startCrop.h - delta;
      }
    }

    setCrop(newCrop);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragHandle(null);
  };

  return (
    <div 
      className="h-[calc(100vh-4rem)] bg-background flex flex-col p-4 md:p-6 items-center overflow-hidden transition-colors duration-300 relative" 
      onMouseUp={handleMouseUp} 
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseUp}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="absolute inset-0 z-[100] bg-primary/20 backdrop-blur-sm flex items-center justify-center border-4 border-primary border-dashed m-4 rounded-xl animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                 <FileUp size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Drop SVG File Here</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Open file in Cropper</p>
              </div>
           </div>
        </div>
      )}

      <div className="w-full max-w-6xl mb-6 flex flex-col xl:flex-row gap-4 justify-between items-center bg-surface p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl shrink-0 z-20">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-indigo-500/20 rounded-lg text-indigo-500 dark:text-indigo-400">
             <MousePointer2 size={24} />
           </div>
           <div>
             <h2 className="text-lg font-bold text-slate-900 dark:text-white">SVG Precision Cropper</h2>
             <p className="text-sm text-slate-500 dark:text-slate-400">Non-destructive vector masking and clipping</p>
           </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setCropMode('keep-inside')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              cropMode === 'keep-inside' 
                ? "bg-white dark:bg-primary text-primary dark:text-white shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Scan size={16} />
            Keep Selection
          </button>
          <button
            onClick={() => setCropMode('cut-out')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              cropMode === 'cut-out' 
                ? "bg-white dark:bg-primary text-primary dark:text-white shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Scissors size={16} />
            Cut Out
          </button>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<Upload size={16}/>}>Upload</Button>
          <input ref={fileInputRef} type="file" accept=".svg" className="hidden" onChange={handleFileUpload} />
          
          <Button onClick={handleExport} icon={<Download size={16}/>}>
            {cropMode === 'keep-inside' ? 'Export Crop' : 'Export Cutout'}
          </Button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl bg-slate-200 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden flex items-center justify-center p-8 transition-colors duration-300">
        <div 
           className="relative shadow-2xl checkerboard max-w-full max-h-full"
           style={{ 
             aspectRatio: `${viewBox.w} / ${viewBox.h}`,
             height: viewBox.h > viewBox.w ? '100%' : 'auto',
             width: viewBox.w >= viewBox.h ? '100%' : 'auto'
           }}
        >
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="w-full h-full block select-none"
          >
            <g dangerouslySetInnerHTML={{ __html: svgContent.replace(/<svg[^>]*>|<\/svg>/g, '') }} />

            <g pointerEvents="none">
               {cropMode === 'keep-inside' ? (
                 <path 
                    d={`M ${viewBox.x - 10000} ${viewBox.y - 10000} H ${viewBox.w + 20000} V ${viewBox.h + 20000} H ${viewBox.x - 10000} z 
                        M ${crop.x} ${crop.y} h ${crop.w} v ${crop.h} h -${crop.w} z`} 
                    fill="black" 
                    fillOpacity="0.6" 
                    fillRule="evenodd"
                 />
               ) : (
                 <rect 
                    x={crop.x} y={crop.y} width={crop.w} height={crop.h}
                    fill="#ef4444" fillOpacity="0.4"
                    stroke="#ef4444" strokeWidth={viewBox.w * 0.005}
                 />
               )}
            </g>

            <g>
               <rect
                 x={crop.x} y={crop.y} width={crop.w} height={crop.h}
                 fill="transparent"
                 stroke={cropMode === 'keep-inside' ? 'white' : 'red'}
                 strokeWidth={viewBox.w * 0.002}
                 strokeDasharray={viewBox.w * 0.01}
                 className="cursor-move hover:stroke-opacity-100 transition-opacity"
                 onMouseDown={(e) => handleMouseDown(e, 'move')}
               />
               
               {[
                 { id: 'nw', x: crop.x, y: crop.y, cursor: 'nw-resize' },
                 { id: 'ne', x: crop.x + crop.w, y: crop.y, cursor: 'ne-resize' },
                 { id: 'sw', x: crop.x, y: crop.y + crop.h, cursor: 'sw-resize' },
                 { id: 'se', x: crop.x + crop.w, y: crop.y + crop.h, cursor: 'se-resize' },
               ].map(handle => (
                 <rect
                   key={handle.id}
                   x={handle.x - (viewBox.w * 0.01)} 
                   y={handle.y - (viewBox.w * 0.01)}
                   width={viewBox.w * 0.02}
                   height={viewBox.w * 0.02}
                   fill="white"
                   stroke="black"
                   strokeWidth={viewBox.w * 0.002}
                   style={{ cursor: handle.cursor }}
                   onMouseDown={(e) => handleMouseDown(e, handle.id)}
                 />
               ))}
            </g>
          </svg>
        </div>
      </div>
      
      <div className="mt-4 flex flex-wrap justify-center gap-4 md:gap-8 text-xs md:text-sm text-slate-500 dark:text-slate-400 font-mono bg-surface/50 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2"><SquareDashedMousePointer size={14}/> Selection Info</div>
        <div><span className="text-slate-400 dark:text-slate-500">X:</span> {Math.round(crop.x)}</div>
        <div><span className="text-slate-400 dark:text-slate-500">Y:</span> {Math.round(crop.y)}</div>
        <div><span className="text-slate-400 dark:text-slate-500">W:</span> {Math.round(crop.w)}</div>
        <div><span className="text-slate-400 dark:text-slate-500">H:</span> {Math.round(crop.h)}</div>
      </div>
    </div>
  );
};

export default Cropper;