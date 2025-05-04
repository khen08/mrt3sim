"use client";

import * as React from "react";
import {
  ColumnDef,
  SortingState, // Import SortingState
  flexRender,
  getCoreRowModel,
  getSortedRowModel, // Import sorting model
  useReactTable,
  RowSelectionState, // Import RowSelectionState
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"; // Use ScrollArea for consistency

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  sorting: SortingState; // Add sorting state props
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>; // Add sorting setter
  rowSelection: RowSelectionState; // Receive state
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>; // Receive setter
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting, // Use sorting state
  setSorting, // Use sorting setter
  rowSelection, // Use received state
  setRowSelection, // Use received setter
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting, // Pass sorting state
      rowSelection, // Control selection state
    },
    onSortingChange: setSorting, // Set sorting handler
    getSortedRowModel: getSortedRowModel(), // Enable sorting model
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection, // Set selection handler
    enableRowSelection: true, // Enable row selection
  });

  return (
    <ScrollArea className="h-[400px] w-full rounded-md border">
      {" "}
      {/* Added border */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
