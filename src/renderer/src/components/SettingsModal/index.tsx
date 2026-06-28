import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppSettings {
  ui: { theme: 'light' | 'dark' | 'system'; language: string; zoom: number; pianoHeight: number };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; openedAt: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      const loadSettings = async (): Promise<void> => {
        try {
          const ui = await window.electronAPI.settings.get('ui');
          const practice = await window.electronAPI.settings.get('practice');
          const files = await window.electronAPI.settings.getRecentFiles();

          // Apply defaults if necessary
          setSettings({
            ui: ui || { theme: 'system', language: 'ja', zoom: 1.0, pianoHeight: 120 },
            practice: practice || { defaultErrorMode: 'wait', metronomeEnabled: false },
          });
          setRecentFiles(files || []);
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      };
      loadSettings();
    }
  }, [isOpen]);

  if (!isOpen || !settings) return null;

  const updateUiSetting = async (
    key: keyof AppSettings['ui'],
    value: string | number
  ): Promise<void> => {
    const updatedUi = { ...settings.ui, [key]: value };
    setSettings({ ...settings, ui: updatedUi });
    await window.electronAPI.settings.set('ui', updatedUi);
  };

  const updatePracticeSetting = async (
    key: keyof AppSettings['practice'],
    value: string | boolean
  ): Promise<void> => {
    const updatedPractice = { ...settings.practice, [key]: value };
    setSettings({ ...settings, practice: updatedPractice });
    await window.electronAPI.settings.set('practice', updatedPractice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">
          {/* UI Settings */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              UI
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="theme"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Theme
                </label>
                <select
                  id="theme"
                  value={settings.ui.theme}
                  onChange={(e) => updateUiSetting('theme', e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="language"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Language
                </label>
                <select
                  id="language"
                  value={settings.ui.language}
                  onChange={(e) => updateUiSetting('language', e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </section>

          {/* Practice Settings */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Practice
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="errorMode"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Default Error Mode
                </label>
                <select
                  id="errorMode"
                  value={settings.practice.defaultErrorMode}
                  onChange={(e) => updatePracticeSetting('defaultErrorMode', e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="wait">Wait for correct note</option>
                  <option value="pass">Pass through on error</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  id="metronomeEnabled"
                  type="checkbox"
                  checked={settings.practice.metronomeEnabled}
                  onChange={(e) => updatePracticeSetting('metronomeEnabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                />
                <label
                  htmlFor="metronomeEnabled"
                  className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
                >
                  Enable Metronome by Default
                </label>
              </div>
            </div>
          </section>

          {/* Recent Files */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Recent Files
            </h3>
            {recentFiles.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No recent files</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
                {recentFiles.map((file, idx) => {
                  // Attempt to just show filename
                  const parts = file.path.split(/[\\/]/);
                  const filename = parts[parts.length - 1];
                  const date = new Date(file.openedAt).toLocaleDateString();
                  return (
                    <li key={idx} className="py-3 flex justify-between items-center">
                      <div className="flex flex-col truncate pr-4">
                        <span
                          className="text-sm font-medium text-gray-900 dark:text-white truncate"
                          title={file.path}
                        >
                          {filename}
                        </span>
                        <span className="text-xs text-gray-500 truncate">{file.path}</span>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">{date}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
