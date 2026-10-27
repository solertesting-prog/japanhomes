'use client';

import { cn, IconHeart } from '@jpt/ui';
import { useI18n } from '@/i18n/provider';
import { useFavorites } from '@/lib/use-favorites';

export function FavoriteButton({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const { t } = useI18n();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(slug);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      aria-pressed={active}
      aria-label={`${active ? t.card.saved : t.card.save}: ${name}`}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-full bg-paper/90 backdrop-blur transition-colors hover:bg-paper',
        active ? 'text-shu' : 'text-ink-2 hover:text-ink',
        className,
      )}
    >
      <IconHeart filled={active} size={17} />
    </button>
  );
}
