import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NoteContextMenu } from './index';
import type { Annotation } from '../../types';

describe('NoteContextMenu', () => {
  const noop = (): void => {};

  it('renders finger options 1-5 and calls onSelectFinger when one is chosen (REQ-008-001)', () => {
    const onSelectFinger = vi.fn();

    render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={100}
        y={200}
        onSelectFinger={onSelectFinger}
        onRemoveFinger={noop}
        onSaveComment={noop}
        onApprove={noop}
        onClose={noop}
      />
    );

    for (const finger of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`finger-option-${finger}`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId('finger-option-3'));
    expect(onSelectFinger).toHaveBeenCalledWith(3);
  });

  it('disables the remove-finger button when no finger is assigned and enables it otherwise (REQ-008-006)', () => {
    const onRemoveFinger = vi.fn();
    const { rerender } = render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={noop}
        onRemoveFinger={onRemoveFinger}
        onSaveComment={noop}
        onApprove={noop}
        onClose={noop}
      />
    );

    expect(screen.getByTestId('remove-finger-button')).toBeDisabled();

    const annotation: Annotation = {
      noteId: 'P1-M1-N0',
      fingerNumber: 4,
      isAISuggested: false,
      isApproved: false,
    };

    rerender(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        annotation={annotation}
        onSelectFinger={noop}
        onRemoveFinger={onRemoveFinger}
        onSaveComment={noop}
        onApprove={noop}
        onClose={noop}
      />
    );

    const removeButton = screen.getByTestId('remove-finger-button');
    expect(removeButton).not.toBeDisabled();
    fireEvent.click(removeButton);
    expect(onRemoveFinger).toHaveBeenCalled();
  });

  it('prefills the comment textarea with the existing comment and calls onSaveComment with the edited value (REQ-008-003)', () => {
    const onSaveComment = vi.fn();
    const annotation: Annotation = {
      noteId: 'P1-M1-N0',
      comment: '親指から始める',
      isAISuggested: false,
      isApproved: false,
    };

    render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        annotation={annotation}
        onSelectFinger={noop}
        onRemoveFinger={noop}
        onSaveComment={onSaveComment}
        onApprove={noop}
        onClose={noop}
      />
    );

    const textarea = screen.getByTestId('comment-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('親指から始める');

    fireEvent.change(textarea, { target: { value: '更新後のコメント' } });
    fireEvent.click(screen.getByTestId('save-comment-button'));

    expect(onSaveComment).toHaveBeenCalledWith('更新後のコメント');
  });

  it('shows the approve button only for unapproved AI-suggested annotations and calls onApprove (REQ-009-005)', () => {
    const onApprove = vi.fn();
    const aiSuggested: Annotation = {
      noteId: 'P1-M1-N0',
      fingerNumber: 2,
      isAISuggested: true,
      isApproved: false,
    };

    const { rerender } = render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        annotation={aiSuggested}
        onSelectFinger={noop}
        onRemoveFinger={noop}
        onSaveComment={noop}
        onApprove={onApprove}
        onClose={noop}
      />
    );

    fireEvent.click(screen.getByTestId('approve-annotation-button'));
    expect(onApprove).toHaveBeenCalled();

    rerender(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        annotation={{ ...aiSuggested, isApproved: true, isAISuggested: false }}
        onSelectFinger={noop}
        onRemoveFinger={noop}
        onSaveComment={noop}
        onApprove={onApprove}
        onClose={noop}
      />
    );

    expect(screen.queryByTestId('approve-annotation-button')).not.toBeInTheDocument();
  });

  it('does not show the approve button for manually entered (non-AI) annotations', () => {
    const manual: Annotation = {
      noteId: 'P1-M1-N0',
      fingerNumber: 3,
      isAISuggested: false,
      isApproved: false,
    };

    render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        annotation={manual}
        onSelectFinger={noop}
        onRemoveFinger={noop}
        onSaveComment={noop}
        onApprove={noop}
        onClose={noop}
      />
    );

    expect(screen.queryByTestId('approve-annotation-button')).not.toBeInTheDocument();
  });

  it('closes when the Escape key is pressed', () => {
    const onClose = vi.fn();

    render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={noop}
        onRemoveFinger={noop}
        onSaveComment={noop}
        onApprove={noop}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when clicking outside the menu', () => {
    const onClose = vi.fn();

    render(
      <div>
        <div data-testid="outside">outside</div>
        <NoteContextMenu
          noteId="P1-M1-N0"
          x={0}
          y={0}
          onSelectFinger={noop}
          onRemoveFinger={noop}
          onSaveComment={noop}
          onApprove={noop}
          onClose={onClose}
        />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the menu', () => {
    const onClose = vi.fn();

    render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={noop}
        onRemoveFinger={noop}
        onSaveComment={noop}
        onApprove={noop}
        onClose={onClose}
      />
    );

    fireEvent.mouseDown(screen.getByTestId('note-context-menu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('positions the menu at the given screen coordinates', () => {
    render(
      <NoteContextMenu
        noteId="P1-M1-N0"
        x={123}
        y={456}
        onSelectFinger={noop}
        onRemoveFinger={noop}
        onSaveComment={noop}
        onApprove={noop}
        onClose={noop}
      />
    );

    const menu = screen.getByTestId('note-context-menu');
    expect(menu.style.left).toBe('123px');
    expect(menu.style.top).toBe('456px');
  });
});
