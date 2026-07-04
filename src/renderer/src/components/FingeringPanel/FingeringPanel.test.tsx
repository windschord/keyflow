import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FingeringPanel } from './index';

// FingeringEngineService instantiates a Web Worker, which jsdom does not provide.
// This test only exercises label rendering, so the engine is mocked out.
vi.mock('../../lib/fingering-engine', () => ({
  FingeringEngineService: vi.fn().mockImplementation(() => ({
    computeFingering: vi.fn(),
    dispose: vi.fn(),
  })),
  DEFAULT_HAND_SETTINGS: { maxSpanSemitones: 14, scaleFactorLeft: 1.0 },
}));

describe('FingeringPanel label', () => {
  it('labels the hand dropdown as the fingering target, distinct from practice mode selection', () => {
    render(<FingeringPanel score={null} onSuggested={() => {}} />);

    // "運指対象" makes clear this selects the hand for fingering computation,
    // distinguishing it from PracticeModeSelector's practice target (左手/右手/両手).
    expect(screen.getByText('運指対象:')).toBeInTheDocument();
  });
});
