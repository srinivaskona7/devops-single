import { X, Minus, Plus, RotateCcw } from 'lucide-react';
import { THEMES, useTheme, type ThemeName, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_DEFAULT } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in panel from right */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-80 flex flex-col"
        style={{
          background: 'var(--bg-sidebar)',
          borderLeft: '1px solid var(--border-strong)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Settings
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Customize your dashboard
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-secondary)', background: 'transparent' }}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* ── Font Size section ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Font Size
              </h3>
              <button
                onClick={() => setFontSize(FONT_SIZE_DEFAULT)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                title="Reset to default (14px)"
              >
                <RotateCcw size={9} /> Reset
              </button>
            </div>

            {/* Size controls */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
            >
              <button
                onClick={() => setFontSize(fontSize - 1)}
                disabled={fontSize <= FONT_SIZE_MIN}
                className="w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card-hover)' }}
                title="Decrease font size"
              >
                <Minus size={13} />
              </button>

              {/* Size presets */}
              <div className="flex-1 flex items-center justify-center gap-1">
                {[12, 13, 14, 15, 16, 17, 18].map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className="w-7 h-7 rounded text-[10px] font-medium transition-all"
                    style={{
                      background: fontSize === size ? 'var(--accent)' : 'transparent',
                      color: fontSize === size ? '#fff' : 'var(--text-muted)',
                      border: fontSize === size ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setFontSize(fontSize + 1)}
                disabled={fontSize >= FONT_SIZE_MAX}
                className="w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card-hover)' }}
                title="Increase font size"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Font size dropdown for 20-30 range */}
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full mt-2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              {Array.from({ length: 11 }, (_, i) => 20 + i).map((size) => (
                <option key={size} value={size}>
                  {size}px{size === 22 ? ' (Default)' : ''}
                </option>
              ))}
            </select>

            {/* Preview text */}
            <div
              className="mt-2 px-3 py-2 rounded text-center"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                fontSize: `${fontSize}px`,
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-family, inherit)' }}>
                The quick brown fox — {fontSize}px
              </span>
            </div>
          </div>

          {/* ── Appearance section ── */}
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Appearance
            </h3>
            <div className="space-y-2">
              {THEMES.map(t => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name as ThemeName)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-all text-left',
                    theme === t.name
                      ? 'border-[var(--accent)]'
                      : 'hover:border-[var(--border-strong)]'
                  )}
                  style={{
                    borderColor: theme === t.name ? 'var(--accent)' : 'var(--border)',
                    background: theme === t.name ? `color-mix(in srgb, var(--accent) 10%, transparent)` : 'transparent',
                  }}
                >
                  {/* Color swatch */}
                  <div
                    className="shrink-0 w-10 h-10 rounded-md overflow-hidden flex flex-col"
                    style={{ border: '1px solid rgba(0,0,0,0.15)' }}
                  >
                    {/* Top = base bg, bottom strip = accent */}
                    <div className="flex-1" style={{ background: t.preview }} />
                    <div className="h-2" style={{ background: t.vars['--accent'] }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-semibold flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t.label}
                      {theme === t.name && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[11px] truncate mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
              Srinivas-kyma Dashboard v1.0.0
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
