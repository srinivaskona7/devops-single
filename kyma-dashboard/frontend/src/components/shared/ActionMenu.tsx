import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  label?: string;
}

export function ActionMenu({ items, label = 'Actions' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        className="p-1.5 rounded-lg transition-colors duration-150 hover:bg-[var(--bg-card-hover)]"
        style={{ color: 'var(--text-secondary, #556b82)' }}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl overflow-hidden py-1"
          style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #d9d9d9)',
            boxShadow: '0 0 0.125rem rgba(34,53,72,0.10), 0 0.5rem 1rem rgba(34,53,72,0.15)',
          }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: item.variant === 'danger' ? 'var(--status-err, #bb0000)' : 'var(--text-primary, #32363a)',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = item.variant === 'danger'
                  ? 'rgba(187,0,0,0.06)'
                  : 'var(--nav-active-bg, #e7f0f7)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'transparent';
              }}
            >
              {item.icon && <span className="flex-shrink-0 w-4 h-4">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}