'use client';

import { useTranslations } from 'next-intl';
import { type LucideIcon, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input, Button, Skeleton } from '@foodwaste/ui';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface AdminDataTableProps<T> {
  columns: readonly ColumnDef<T>[];
  /**
   * `readonly` because the table only ever reads: it maps rows and reads
   * `length`. Accepting a mutable array would force every call site that holds
   * a frozen "empty" constant - the allocation-in-render fix from
   * `.claude/rules/performance.md` rule 1 - to cast it away.
   */
  data: readonly T[];
  isLoading?: boolean;
  // Pagination
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /**
   * Search is optional: some admin tables are a bounded list rather than a
   * corpus (locked accounts, for instance) and a search box over five rows is
   * noise. Omit `onSearchChange` and the toolbar drops the field entirely
   * rather than rendering a dead input.
   */
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  // Row click
  onRowClick?: (item: T) => void;
  // Filters (optional slot rendered between search and table)
  filterSlot?: React.ReactNode;
  // Empty state
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  /**
   * Adds a leading checkbox column for bulk actions.
   *
   * The admin offers page kept its own `<table>` purely because it needed this,
   * which meant it also kept its own skeleton, empty state and pagination - and
   * drifted from all three. Selection belongs in the primitive for the same
   * reason pagination does.
   *
   * `selectedIds` is the full selection, which may include rows on other pages;
   * the header checkbox reflects only the rows currently rendered.
   */
  selection?: {
    selectedIds: readonly string[];
    onToggle: (id: string) => void;
    /** Receives the ids on the current page, already computed by the table. */
    onToggleAll: (idsOnPage: string[]) => void;
  };
}

/** The table addresses rows by id, so a row without one cannot be selected. */
function rowId<T extends { _id?: string; id?: string }>(item: T): string | undefined {
  return item._id ?? item.id;
}

export function AdminDataTable<T extends { _id?: string; id?: string }>({
  columns,
  data,
  isLoading,
  page,
  totalPages,
  total,
  onPageChange,
  searchValue = '',
  searchPlaceholder,
  onSearchChange,
  onRowClick,
  filterSlot,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  selection,
}: AdminDataTableProps<T>) {
  const t = useTranslations('common.table');

  const idsOnPage = selection ? data.map(rowId).filter((id): id is string => id !== undefined) : [];
  /*
   * "All selected" must be false on an empty page. Without the length guard
   * `every` returns true for `[]`, so an empty result set renders a ticked
   * header checkbox claiming everything is selected.
   */
  const allOnPageSelected =
    idsOnPage.length > 0 && idsOnPage.every(id => selection?.selectedIds.includes(id));
  const someOnPageSelected =
    !allOnPageSelected && idsOnPage.some(id => selection?.selectedIds.includes(id));

  /** Header + body must agree, or the columns misalign by one. */
  const columnCount = columns.length + (selection ? 1 : 0);

  return (
    <div className='flex flex-col gap-lg'>
      {/* Toolbar - omitted entirely when there is neither search nor filters. */}
      {(onSearchChange || filterSlot) && (
        <div className='flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between'>
          {onSearchChange && (
            <div className='relative max-w-sm flex-1'>
              <Search className='absolute start-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className='h-7 ps-4xl text-xs'
              />
            </div>
          )}
          {filterSlot && <div className='flex flex-wrap items-center gap-sm'>{filterSlot}</div>}
        </div>
      )}

      {/* Table */}
      <div className='overflow-hidden rounded-lg border border-border/60 bg-card'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border/60 bg-muted/30'>
                {selection && (
                  <th className='w-8 px-lg py-md'>
                    <input
                      type='checkbox'
                      className='rounded'
                      checked={allOnPageSelected}
                      // Partial selection is a third state. Without it the box
                      // reads as "nothing selected" while rows plainly are.
                      ref={el => {
                        if (el) el.indeterminate = someOnPageSelected;
                      }}
                      onChange={() => selection.onToggleAll(idsOnPage)}
                      aria-label={t('selectAll')}
                    />
                  </th>
                )}
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-lg py-md text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-border/40'>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {selection && (
                      <td className='w-8 px-lg py-md'>
                        <Skeleton className='size-4 rounded' />
                      </td>
                    )}
                    {columns.map(col => (
                      // `col.className` carries responsive visibility such as
                      // `hidden md:table-cell`. Omitting it here, as this did,
                      // made the skeleton render more columns than the real
                      // rows on small screens - so the table visibly reflowed
                      // the moment data landed.
                      <td key={col.key} className={cn('px-lg py-md', col.className)}>
                        <Skeleton className='h-4 w-full max-w-[120px]' />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columnCount}>
                    <div className='flex flex-col items-center justify-center gap-md py-3xl text-center'>
                      {EmptyIcon && <EmptyIcon className='size-10 text-muted-foreground/40' />}
                      <p className='text-sm font-medium text-muted-foreground'>{emptyTitle}</p>
                      {emptyDescription && (
                        <p className='max-w-xs text-xs text-muted-foreground/70'>
                          {emptyDescription}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => {
                  const id = rowId(item);
                  const isSelected = id !== undefined && selection?.selectedIds.includes(id);

                  return (
                    <tr
                      key={id ?? idx}
                      className={cn(
                        'transition-colors hover:bg-muted/20',
                        onRowClick && 'cursor-pointer',
                        isSelected && 'bg-primary-500/[0.04]',
                      )}
                      onClick={() => onRowClick?.(item)}
                    >
                      {selection && (
                        <td className='w-8 px-lg py-md'>
                          <input
                            type='checkbox'
                            className='rounded'
                            checked={!!isSelected}
                            disabled={id === undefined}
                            // The row may open a detail view; ticking the box
                            // must not also navigate.
                            onClick={e => e.stopPropagation()}
                            onChange={() => id !== undefined && selection.onToggle(id)}
                            aria-label={t('selectRow')}
                          />
                        </td>
                      )}
                      {columns.map(col => (
                        <td key={col.key} className={cn('px-lg py-md align-middle', col.className)}>
                          {col.render(item)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!isLoading && total > 0 && (
          <div className='flex items-center justify-between border-t border-border/60 px-lg py-md'>
            {/*
              This was `{total} result{total !== 1 ? 's' : ''}` - English
              pluralisation hardcoded inside a primitive that ten admin pages
              render, so French and Arabic admins read "5 results". ICU plurals
              also get Arabic's six forms right, which an `s` never can.
            */}
            <p className='text-xs text-muted-foreground'>{t('results', { count: total })}</p>
            <div className='flex items-center gap-xs'>
              <Button
                variant='outline'
                size='sm'
                className='h-9 w-9 p-0'
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label={t('previousPage')}
              >
                <ChevronLeft className='size-3.5' />
              </Button>
              <span className='min-w-[60px] text-center text-xs text-muted-foreground'>
                {page} / {totalPages || 1}
              </span>
              <Button
                variant='outline'
                size='sm'
                className='h-9 w-9 p-0'
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label={t('nextPage')}
              >
                <ChevronRight className='size-3.5' />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
