import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FingeringPanel } from './index';

describe('FingeringPanel label', () => {
  it('labels the hand dropdown as the fingering target, distinct from practice mode selection', () => {
    render(<FingeringPanel score={null} onSuggested={() => {}} />);

    // "運指対象" makes clear this selects the hand for fingering computation,
    // distinguishing it from PracticeModeSelector's practice target (左手/右手/両手).
    expect(screen.getByText('運指対象:')).toBeInTheDocument();
  });
});
