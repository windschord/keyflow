import { render, screen } from '@testing-library/react';
import Versions from './Versions';

describe('Versions', () => {
  it('renders version numbers from window.electron', () => {
    render(<Versions />);
    expect(screen.getByText(/Electron v29\.0\.0/)).toBeTruthy();
    expect(screen.getByText(/Chromium v122\.0\.0/)).toBeTruthy();
    expect(screen.getByText(/Node v20\.0\.0/)).toBeTruthy();
  });
});
