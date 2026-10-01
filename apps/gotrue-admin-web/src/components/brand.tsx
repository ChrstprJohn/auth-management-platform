import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/gotrue-operator-mark.png"
      alt=""
      width={32}
      height={32}
      className={cn('size-8 shrink-0 object-contain dark:invert', className)}
    />
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 font-semibold tracking-tight',
        className,
      )}
    >
      <BrandMark />
      <span>GoTrue Operator</span>
    </span>
  );
}
