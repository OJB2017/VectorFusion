import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Studio from './pages/Studio';
import Cropper from './pages/Cropper';
import Exporter from './pages/Exporter';
import { AppProvider } from './AppContext';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('studio');

  return (
    <AppProvider>
      <div className="min-h-screen bg-background font-sans selection:bg-primary/30 transition-colors duration-300 flex flex-col">
        <Navbar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 relative overflow-hidden">
          
          {currentView === 'studio' && (
            <div className="absolute inset-0 animate-in fade-in duration-300">
              <Studio />
            </div>
          )}

          {currentView === 'cropper' && (
            <div className="absolute inset-0 animate-in fade-in duration-300 overflow-auto">
              <Cropper />
            </div>
          )}

          {currentView === 'exporter' && (
            <div className="absolute inset-0 animate-in fade-in duration-300 overflow-auto">
              <Exporter />
            </div>
          )}

        </main>
      </div>
    </AppProvider>
  );
};

export default App;