import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { Popover } from './Popover';

// TASK-074: 汎用ポップオーバー（REQ-012-003）。
// 外側mousedown / Escape / アンカー再クリックで閉じ、内側クリックでは閉じない。
// documentへのリスナー登録・解除はuseEffect内で行い、StrictModeの
// マウント→アンマウント→再マウントに耐える必要がある（プロジェクトの
// Reactリソース管理原則）。

describe('Popover', () => {
  afterEach(() => {
    cleanup();
  });

  it('closes when a mousedown occurs outside the popover content', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">outside area</div>
        <Popover isOpen onClose={onClose}>
          <div data-testid="popover-content">content</div>
        </Popover>
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Popover isOpen onClose={onClose}>
        <div data-testid="popover-content">content</div>
      </Popover>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when a mousedown occurs inside the popover content', () => {
    const onClose = vi.fn();
    render(
      <Popover isOpen onClose={onClose}>
        <div data-testid="popover-content">content</div>
      </Popover>
    );

    fireEvent.mouseDown(screen.getByTestId('popover-content'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when a mousedown occurs on the excluded anchor element', () => {
    const onClose = vi.fn();
    const AnchorAndPopover: React.FC = () => {
      const anchorRef = React.useRef<HTMLButtonElement>(null);
      return (
        <div>
          <button ref={anchorRef} data-testid="anchor">
            toggle
          </button>
          <Popover isOpen onClose={onClose} anchorRef={anchorRef}>
            <div data-testid="popover-content">content</div>
          </Popover>
        </div>
      );
    };

    render(<AnchorAndPopover />);
    fireEvent.mouseDown(screen.getByTestId('anchor'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <Popover isOpen={false} onClose={vi.fn()}>
        <div data-testid="popover-content">content</div>
      </Popover>
    );

    expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
  });

  it('removes the document event listeners on unmount (no listener leak)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(
      <Popover isOpen onClose={vi.fn()}>
        <div data-testid="popover-content">content</div>
      </Popover>
    );

    const addedTypes = addSpy.mock.calls.map((call) => call[0]);
    expect(addedTypes).toContain('mousedown');
    expect(addedTypes).toContain('keydown');

    unmount();

    const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
    expect(removedTypes).toContain('mousedown');
    expect(removedTypes).toContain('keydown');
    expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(addSpy.mock.calls.length);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('does not leak listeners across StrictMode-style double mount/unmount cycles', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount: unmount1 } = render(
      <Popover isOpen onClose={vi.fn()}>
        <div>content</div>
      </Popover>
    );
    unmount1();

    const { unmount: unmount2 } = render(
      <Popover isOpen onClose={vi.fn()}>
        <div>content</div>
      </Popover>
    );
    unmount2();

    expect(removeSpy.mock.calls.length).toBe(addSpy.mock.calls.length);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
