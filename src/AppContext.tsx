import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { DEFAULT_SVG } from './utils/svgHelpers';

interface AppContextType {
  svgContent: string;
  setSvgContent: (content: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState({
    history: [DEFAULT_SVG],
    index: 0,
    current: DEFAULT_SVG
  });
  
  const timeoutRef = useRef<any>(null);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') !== 'light';
    }
    return true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const setSvgContent = (content: string) => {
    setState(prev => ({ ...prev, current: content }));

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.history[prev.index] === content) {
          return prev;
        }

        const newHistory = prev.history.slice(0, prev.index + 1);
        newHistory.push(content);

        if (newHistory.length > 50) {
          newHistory.shift();
        }

        return {
          history: newHistory,
          index: newHistory.length - 1,
          current: content
        };
      });
    }, 400);
  };

  const undo = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState(prev => {
      if (prev.index <= 0) return prev;
      const newIndex = prev.index - 1;
      return {
        ...prev,
        index: newIndex,
        current: prev.history[newIndex]
      };
    });
  };

  const redo = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState(prev => {
      if (prev.index >= prev.history.length - 1) return prev;
      const newIndex = prev.index + 1;
      return {
        ...prev,
        index: newIndex,
        current: prev.history[newIndex]
      };
    });
  };

  return (
    <AppContext.Provider value={{ 
      svgContent: state.current, 
      setSvgContent, 
      darkMode, 
      toggleDarkMode,
      undo,
      redo,
      canUndo: state.index > 0,
      canRedo: state.index < state.history.length - 1
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};