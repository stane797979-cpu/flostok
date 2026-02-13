'use client';

import { type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  example?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export function OptionCard({
  icon: Icon,
  title,
  description,
  example,
  selected,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'cursor-pointer p-4 transition-all hover:shadow-md',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-slate-200 hover:border-slate-300',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            selected ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium', selected && 'text-primary')}>{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          {example && (
            <p className="mt-1 text-xs text-slate-400">예시: {example}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
