'use client';

export interface RevealProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
  width?: 'fit-content' | '100%';
  delay?: number;
  slideDirection?: 'top' | 'bottom' | 'left' | 'right';
}

export const Reveal = ({
  children,
  width = 'fit-content',
  delay = 0.25,
  slideDirection = 'bottom',
  className,
  ...props
}: RevealProps) => {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        overflow: 'hidden',
      }}
      {...props}
    >
      <div
        className={`animate-reveal animate-reveal-${slideDirection}`}
        style={{
          animationDelay: `${delay}s`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
