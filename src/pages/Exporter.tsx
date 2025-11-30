import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Image as ImageIcon, Check, FileUp } from 'lucide-react';
import { Button } from '../components/Button';
import { parseSvgContent } from '../utils/svgHelpers';
import { useAppContext } from '../AppContext';
import clsx from 'clsx';

const Exporter: React.FC = () => {
  const { svgContent, setSvgContent } = useAppContext();
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [width, setWidth] = useState<number | string>(1024);
  const [height, setHeight] = useState<number | string>(1024);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const doc = parseSvgContent(svgContent);
    const svg = doc?.querySelector('svg');
    if (svg) {
      const w = parseFloat(svg.getAttribute('width') || '0');
      const h = parseFloat(svg.getAttribute('height') || '0');
      const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
      
      let finalW = w;
      let finalH = h;
      
      if ((!w || !h) && vb && vb.length === 4) {
        finalW = vb[2];
        finalH = vb[3];
      }
      
      if (finalW && finalH) {
        setAspectRatio(finalW / finalH);
        setWidth(1024);
        setHeight(Math.round(1024 / (finalW / finalH)));
      }
    }
  }, [svgContent]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setSvgContent(event.target?.result as string);
    reader.readAsText(file);
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
      reader.onload = (event) => setSvgContent(event.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleWidthChange = (val: string | number) => {
    if (val === '') {
      setWidth('');
      if (maintainAspect) setHeight('');
      return;
    }

    const num = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(num)) return;

    setWidth(num);
    if (maintainAspect) {
      setHeight(Math.round(num / aspectRatio));
    }
  };

  const handleHeightChange = (val: string | number) => {
    if (val === '') {
      setHeight('');
      if (maintainAspect) setWidth('');
      return;
    }

    const num = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(num)) return;

    setHeight(num);
    if (maintainAspect) {
      setWidth(Math.round(num * aspectRatio));
    }
  };

  const drawToCanvas = async (): Promise<string> => {
    if (!canvasRef.current) return '';
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const w = Number(width) || 0;
    const h = Number(height) || 0;

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    if (format === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL(`image/${format}`, 0.9));
      };
      img.src = url;
    });
  };

  const handleExport = async () => {
    const dataUrl = await drawToCanvas();
    const link = document.createElement('a');
    link.download = `exported-image.${format}`;
    link.href = dataUrl;
    link.click();
  };

  const renderWidth = Number(width) || 0;
  const renderHeight = Number(height) || 0;

  return (
    <div 
      className="h-[calc(100vh-4rem)] bg-background flex flex-col md:flex-row overflow-hidden transition-colors duration-300 relative"
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
                <p className="text-slate-500 dark:text-slate-400 mt-1">Open file in Exporter</p>
              </div>
           </div>
        </div>
      )}

      <div className="w-full md:w-80 border-r border-slate-200 dark:border-slate-700 bg-surface p-6 flex flex-col gap-8 overflow-y-auto z-10 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Export Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Convert vectors to high-res raster images locally.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">File</label>
             <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                <label className="relative flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-primary hover:text-primary transition-colors text-slate-500 dark:text-slate-400">
                  <Upload size={20} />
                  <span>Upload SVG</span>
                  <input type="file" accept=".svg" className="hidden" onChange={handleFileUpload} />
                </label>
             </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'jpeg', 'webp'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={clsx(
                    "px-2 py-2 text-sm font-bold rounded uppercase border transition-all",
                    format === f 
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                      : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-500"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dimensions</label>
                <button 
                  onClick={() => setMaintainAspect(!maintainAspect)}
                  className={clsx("text-xs flex items-center gap-1 transition-colors", maintainAspect ? "text-primary" : "text-slate-500")}
                >
                  {maintainAspect ? <Check size={12}/> : null} Lock Aspect
                </button>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Width (px)</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={width}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm focus:border-primary outline-none text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Height (px)</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={height}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm focus:border-primary outline-none text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
             </div>
             
             <div className="flex flex-wrap gap-2">
                {[512, 1024, 1920, 3840].map(w => (
                  <button 
                    key={w}
                    onClick={() => handleWidthChange(w)}
                    className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                  >
                    {w >= 1920 ? (w === 3840 ? '4K' : '1080p') : `${w}w`}
                  </button>
                ))}
             </div>
          </div>

          <Button onClick={handleExport} size="lg" className="w-full" icon={<Download size={20}/>}>
            Export Image
          </Button>
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-slate-100 dark:bg-black/40 p-8 flex items-center justify-center overflow-auto checkerboard relative transition-colors duration-300">
        <div 
          className="shadow-2xl bg-transparent transition-all duration-300 origin-center"
          style={{ 
             width: renderWidth > 800 ? 800 : renderWidth, 
             aspectRatio: `${renderWidth}/${renderHeight}`,
             maxWidth: '100%',
             maxHeight: '100%',
             objectFit: 'contain'
          }}
        >
           <div 
             className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
             dangerouslySetInnerHTML={{ __html: svgContent }} 
           />
        </div>
        
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default Exporter;