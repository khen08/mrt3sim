"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
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
import { useActiveTabId, useCurrentTabData } from "@/store/modalStore";

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
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting,
  setSorting,
  rowSelection,
  setRowSelection,
  stickyHeader = false,
}: DataTableProps<TData, TValue>) {
  // If data is provided via props, use it, otherwise use data from Zustand store
  const storeData = useCurrentTabData();
  const activeTabId = useActiveTabId();

  // Use provided data or fall back to store data
  const tableData = React.useMemo(() => {
    if (data) return data as TData[];
    return (storeData || EMPTY_ARRAY) as TData[];
  }, [data, storeData]);

  // Call useReactTable at the top level
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
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
