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
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  // Pagination
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  // Search
  searchValue?: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  // Row click
  onRowClick?: (item: T) => void;
  // Filters (optional slot rendered between search and table)
  filterSlot?: React.ReactNode;
  // Empty state
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
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
}: AdminDataTableProps<T>) {
  return (
    <div className='flex flex-col gap-lg'>
      {/* Toolbar */}
      <div className='flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between'>
        <div className='relative max-w-sm flex-1'>
          <Search className='absolute start-2.5 top-xs/2 size-3 -translate-y-xs/2 text-muted-foreground' />
          <Input
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className='h-7 ps-4xl text-xs'
          />
        </div>
        {filterSlot && <div className='flex flex-wrap items-center gap-sm'>{filterSlot}</div>}
      </div>

      {/* Table */}
      <div className='overflow-hidden rounded-lg border border-border/60 bg-card'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border/60 bg-muted/30'>
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
                    {columns.map(col => (
                      <td key={col.key} className='px-lg py-md'>
                        <Skeleton className='h-4 w-full max-w-[120px]' />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
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
                data.map((item, idx) => (
                  <tr
                    key={item._id ?? item.id ?? idx}
                    className={cn(
                      'transition-colors hover:bg-muted/20',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map(col => (
                      <td key={col.key} className={cn('px-lg py-md align-middle', col.className)}>
                        {col.render(item)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!isLoading && total > 0 && (
          <div className='flex items-center justify-between border-t border-border/60 px-lg py-md'>
            <p className='text-xs text-muted-foreground'>
              {total} result{total !== 1 ? 's' : ''}
            </p>
            <div className='flex items-center gap-xs'>
              <Button
                variant='outline'
                size='sm'
                className='h-7 w-7 p-0'
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label='Previous page'
              >
                <ChevronLeft className='size-3.5' />
              </Button>
              <span className='min-w-[60px] text-center text-xs text-muted-foreground'>
                {page} / {totalPages || 1}
              </span>
              <Button
                variant='outline'
                size='sm'
                className='h-7 w-7 p-0'
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label='Next page'
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
