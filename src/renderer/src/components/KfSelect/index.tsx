import React, { useEffect, useRef, useState } from 'react';

interface KfSelectOption {
  value: string;
  label: string;
}

export interface KfSelectProps {
  id?: string;
  value: string;
  options: ReadonlyArray<KfSelectOption>;
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/**
 * 设计系统统一下拉选择器。
 * 原生 <select> 的展开列表由操作系统渲染，无法统一为极简设计系统
 * （会出现直角边框与蓝色悬停），因此用 button + popover 重新实现。
 */
export const KfSelect: React.FC<KfSelectProps> = ({
  id,
  value,
  options,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  title,
  style,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      style={style}
      className={`kf-dropdown${className ? ` ${className}` : ''}`}
    >
      <button
        id={id}
        type="button"
        title={title}
        className="kf-dropdown__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {selectedLabel}
      </button>
      {open && (
        <div className="kf-dropdown__menu" role="listbox" aria-labelledby={id}>
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`kf-dropdown__item${selected ? ' kf-dropdown__item--selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                <span className="kf-dropdown__check" aria-hidden="true">
                  <CheckIcon />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
