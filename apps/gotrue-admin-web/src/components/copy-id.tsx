import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

function useCopy(value: string) {
  const [status, setStatus] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copied');
      toast.success('Identifier copied');
    } catch {
      setStatus('Copy unavailable. Select the identifier to copy it manually.');
    }
  };
  return { status, copy };
}
export function CopyId({
  value,
  label = 'identifier',
}: {
  value: string;
  label?: string;
}) {
  const model = useCopy(value);
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <span className="select-text break-all font-mono text-xs">{value}</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Copy ${label}`}
              onClick={model.copy}
            />
          }
        >
          <Copy />
        </TooltipTrigger>
        <TooltipContent>Copy {label}</TooltipContent>
      </Tooltip>
      <span role="status" className="text-xs text-muted-foreground">
        {model.status}
      </span>
    </span>
  );
}
