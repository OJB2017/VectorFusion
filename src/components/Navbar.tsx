import React from 'react';
import { Code2, Crop, Image, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useAppContext } from '../AppContext';
import { DEFAULT_SVG } from '../utils/svgHelpers';

interface NavbarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, onViewChange }) => {
  const { darkMode, toggleDarkMode } = useAppContext();

  const navItems = [
    { id: 'studio', label: 'Code Studio', icon: <Code2 size={18} /> },
    { id: 'cropper', label: 'Cropper', icon: <Crop size={18} /> },
    { id: 'exporter', label: 'Exporter', icon: <Image size={18} /> },
  ];

  return (
    <nav className="h-16 border-b border-slate-200 dark:border-neutral-800 bg-surface/95 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 lg:px-8 transition-colors duration-300">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewChange('studio')}>
        <div className="w-8 h-8 rounded-lg shadow-md overflow-hidden shrink-0">
          <img 
            src={`data:image/svg+xml;utf8,${encodeURIComponent(DEFAULT_SVG)}`} 
            alt="VectorFusion Logo" 
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-xl font-bold shimmer-text">
          VectorFusion
        </span>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-900/50 p-1 rounded-xl border border-slate-200 dark:border-neutral-800/50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              currentView === item.id
                ? "bg-white dark:bg-neutral-800 text-primary shadow-sm"
                : "text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-800"
            )}
          >
            {item.icon}
            <span className="hidden md:block">{item.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={toggleDarkMode}
        className="p-2.5 rounded-lg text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Toggle dark mode"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </nav>
  );
};

export default Navbar;