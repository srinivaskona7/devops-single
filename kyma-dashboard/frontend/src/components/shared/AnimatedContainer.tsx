import { useRef, useEffect, type ReactNode } from 'react';

interface AnimatedContainerProps {
  children: ReactNode;
  /** Unique key for this data set — triggers animation on change */
  dataKey?: string | number;
  className?: string;
}

/**
 * AnimatedContainer — wraps content and applies a subtle fade-in animation
 * whenever the dataKey changes (i.e., new data arrives).
 * Uses CSS-only animation, no extra deps.
 */
export function AnimatedContainer({ children, dataKey, className = '' }: AnimatedContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prevKey = useRef(dataKey);

  useEffect(() => {
    if (prevKey.current !== dataKey && ref.current) {
      ref.current.style.opacity = '0';
      ref.current.style.transform = 'translateY(4px)';
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          ref.current.style.opacity = '1';
          ref.current.style.transform = 'translateY(0)';
        }
      });
      prevKey.current = dataKey;
    }
  }, [dataKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * AnimatedRow — for individual table rows that appear progressively.
 * Staggers animation based on index.
 */
export function AnimatedRow({ children, index = 0, className = '' }: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <div
      className={`fade-in ${className}`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {children}
    </div>
  );
}
