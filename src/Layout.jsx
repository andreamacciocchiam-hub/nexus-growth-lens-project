import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { BarChart3, Users, FileText, MessageSquare, Database, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { appParams } from '@/lib/app-params';

const navItems = [
  { name: 'Dashboard', path: 'Dashboard', icon: BarChart3, label: 'Dashboard BI' },
  { name: 'Dati', path: 'Dati', icon: Database, label: 'Dati Dettaglio' },
  { name: 'Clienti', path: 'Clienti', icon: Users, label: 'Clienti' },
  { name: 'Contratti', path: 'Contratti', icon: FileText, label: 'Contratti' },
  { name: 'Import', path: 'Import', icon: Upload, label: 'Importazione Dati' },
  { name: 'AIChat', path: 'AIChat', icon: MessageSquare, label: 'AI Chat' },
];

const APP_LOGO_URL = `https://base44.com/api/apps/manifests/${appParams.appId}/logo`;

export default function Layout({ children, currentPageName }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-60 bg-[#0a1628] text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-[#0a1628]">
              <img src={APP_LOGO_URL} alt="logo" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white">TIM Enterprise</h1>
              <p className="text-xs text-gray-400">Business Intelligence</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ name, path, icon: Icon, label }) => {
            const isActive = currentPageName === path;
            return (
              <Link
                key={path}
                to={createPageUrl(path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs text-gray-400">Dati 2025 & 2026</span>
          </div>
          <p className="text-xs text-gray-600 pl-4">TIM Enterprise BI v1.0</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}