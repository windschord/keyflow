import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
  });

  it('calls ipcRenderer.send when Send IPC link is clicked', () => {
    render(<App />);
    const sendIpcLink = screen.getByText('Send IPC');
    fireEvent.click(sendIpcLink);
    expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith('ping');
  });
});
