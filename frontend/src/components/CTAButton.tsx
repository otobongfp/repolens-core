'use client';

import { cn } from '@/lib/utils';

interface CTAButtonProps extends React.ComponentProps<'button'> {}

export const CTAButton = ({ className, children, ...props }: CTAButtonProps) => {
  return (
    <button
      className={cn(
        'radial-gradient rounded-xs relative cursor-pointer px-8 py-4 transition-transform active:scale-95',
        className,
      )}
      {...props}
    >
      <span className='linear-mask relative block h-full w-full font-normal tracking-wide text-white'>
        {children}
      </span>
      <span className='linear-overlay rounded-xs absolute inset-0 block p-[2px]' />
    </button>
  );
};
