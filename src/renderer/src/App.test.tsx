import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

describe('App', () => {
  it('renders without crashing and handles ipc', () => {
    const mockSend = vi.fn();
    Object.defineProperty(window, 'electron', {
      value: {
        ipcRenderer: {
          send: mockSend,
        },
        process: {
          versions: {
            node: 'v18',
            chrome: 'v100',
            electron: 'v29',
          }
        }
      },
      writable: true,
      configurable: true,
    });

    render(<App />);
    const link = screen.getByText('Send IPC');
    fireEvent.click(link);
    expect(mockSend).toHaveBeenCalledWith('ping');
  });
});
