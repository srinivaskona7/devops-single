import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKey?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({ columns, data, searchKey, onRowClick }: DataTableProps<T>) {
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Memoize filter+sort — only recompute when data, filter, or sort state changes
  const sorted = useMemo(() => {
    const filterLower = filter.toLowerCase();
    const filtered = filter && searchKey
      ? data.filter(row => String(row[searchKey] ?? '').toLowerCase().includes(filterLower))
      : data;

    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String(a[sortCol] ?? '');
      const bv = String(b[sortCol] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [data, filter, searchKey, sortCol, sortDir]);

  const handleSort = (key: string) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  };

  return (
    <div className="rounded-lg border border-white/[0.06] bg-card flex flex-col flex-1 min-h-0 overflow-hidden">
      {searchKey && (
        <div className="p-3 border-b border-white/[0.05] flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-kyma-muted" />
          <Input
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 text-xs max-w-xs"
          />
          <span className="text-[11px] text-kyma-muted ml-auto">{sorted.length} items</span>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.sortable !== false ? 'cursor-pointer select-none hover:text-kyma-muted' : ''}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  {col.header}
                  {sortCol === col.key && (sortDir === 'asc' ? ' ^' : ' v')}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-10 text-kyma-subtle">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, i) => (
                <TableRow
                  key={i}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
