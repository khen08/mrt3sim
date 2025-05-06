"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  RowSelectionState,
  PaginationState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Empty array constant to avoid creating new empty array references
const EMPTY_ARRAY: any[] = [];

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data?: TData[];
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  stickyHeader?: boolean;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPaginationChange: (updater: React.SetStateAction<PaginationState>) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting,
  setSorting,
  rowSelection,
  setRowSelection,
  stickyHeader = false,
  pageIndex,
  pageSize,
  pageCount,
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  // Use provided data directly
  const tableData = React.useMemo(() => {
    return (data || EMPTY_ARRAY) as TData[];
  }, [data]);

  // Define pagination state for the table
  const pagination = React.useMemo<PaginationState>(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize]
  );

  // Call useReactTable at the top level
  const table = useReactTable({
    data: tableData,
    columns,
    pageCount: pageCount,
    state: {
      sorting,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    enableMultiSort: true,
    isMultiSortEvent: (e: unknown) => {
      if (typeof e === "object" && e !== null && "shiftKey" in e) {
        return !!(e as { shiftKey?: boolean }).shiftKey;
      }
      return false;
    },
    manualPagination: true,
  });

  return (
    <ScrollArea className="border rounded-md w-full flex-1">
      <style jsx global>{`
        .sticky-header {
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      <div className="max-h-[400px] relative overflow-x-hidden">
        <Table>
          <TableHeader
            className={
              stickyHeader ? "sticky-header bg-white dark:bg-black" : ""
            }
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
