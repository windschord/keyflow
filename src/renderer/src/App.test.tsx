import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

vi.mock('./components/ScoreRenderer', () => ({
  ScoreRenderer: () => <div data-testid="mock-score-renderer">ScoreRenderer</div>,
}));

vi.mock('./components/PianoKeyboard', () => ({
  PianoKeyboard: () => <div data-testid="mock-piano-keyboard">PianoKeyboard</div>,
}));

vi.mock('./components/Toolbar', () => ({
  Toolbar: () => <div data-testid="mock-toolbar">Toolbar</div>,
}));

describe('App', () => {
  it('renders correctly with layout components', () => {
    render(<App />);

    expect(screen.getByTestId('mock-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-score-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-piano-keyboard')).toBeInTheDocument();
  });
});
