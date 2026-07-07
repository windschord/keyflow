import React, { useState } from 'react';
import { APP_NAME, APP_LICENSE_NAME, APP_LICENSE_URL, SALAMANDER_CREDIT } from './credits';
// ビルド時生成物（scripts/generate-licenses.mjs、gitignore対象）。
// predev/prebuild/prelint/pretest/pretest:coverageの各npmフックで自動生成される（DEC-008）。
import licenses from '../../generated/licenses.json';

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  licenseText: string;
}

const licenseEntries = licenses as LicenseEntry[];

export const AboutPanel: React.FC = () => {
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const toggleExpanded = (name: string): void => {
    setExpandedName((current) => (current === name ? null : name));
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{APP_NAME}</div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '2px' }}>
          v{__APP_VERSION__}
        </div>
        <div style={{ fontSize: '0.875rem', marginTop: '8px' }}>
          <a href={APP_LICENSE_URL} target="_blank" rel="noreferrer">
            {APP_LICENSE_NAME}
          </a>
        </div>
      </div>

      <div style={{ marginBottom: '16px', fontSize: '0.875rem', color: '#374151' }}>
        {SALAMANDER_CREDIT.text}
      </div>

      <div>
        <h4
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#6b7280',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          使用ライブラリ
        </h4>
        {licenseEntries.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
            ライブラリ情報がありません
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
            }}
          >
            {licenseEntries.map((entry) => (
              <li key={entry.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => toggleExpanded(entry.name)}
                  aria-expanded={expandedName === entry.name}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <span>{entry.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {entry.version} / {entry.license}
                  </span>
                </button>
                {expandedName === entry.name && (
                  <pre
                    style={{
                      margin: 0,
                      padding: '8px 12px',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      backgroundColor: '#f9fafb',
                      maxHeight: '160px',
                      overflowY: 'auto',
                    }}
                  >
                    {entry.licenseText}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
