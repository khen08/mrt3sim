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
  ColumnMeta,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Add this to extend the ColumnMeta type with our custom properties
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends unknown, TValue> {
    alignment?: "left" | "center" | "right";
  }
}

// Empty array constant to avoid creating new empty array references
const EMPTY_ARRAY: any[] = [];

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data?: TData[];
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPaginationChange: (updater: React.SetStateAction<PaginationState>) => void;
  hideRowsPerPage?: boolean;
  hideRowSelectionCount?: boolean;
  tableHeight?: string | number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sorting,
  setSorting,
  rowSelection,
  setRowSelection,
  pageIndex,
  pageSize,
  pageCount,
  onPaginationChange,
  hideRowsPerPage = false,
  hideRowSelectionCount = false,
  tableHeight = "400px",
}: DataTableProps<TData, TValue>) {
  const tableData = React.useMemo(() => {
    return (data || EMPTY_ARRAY) as TData[];
  }, [data]);

  const pagination = React.useMemo<PaginationState>(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize]
  );

  const selectedRows = React.useMemo(
    () => Object.keys(rowSelection || {}),
    [rowSelection]
  );

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
    getRowId: (row: any) =>
      row.__uniquePageRowId || row.id || String(tableData.indexOf(row)),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnDef = header.column.columnDef;
                  const width = columnDef.size ?? "auto";
                  const minWidth = columnDef.minSize ?? 80;
                  const alignment =
                    (columnDef.meta?.alignment as string) || "center";

                  // Special styling for checkbox column
                  const isCheckboxColumn = columnDef.id === "select";

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "p-0 relative select-none",
                        isCheckboxColumn && "p-0"
                      )}
                      style={{
                        width: width === "auto" ? undefined : width,
                        minWidth,
                        maxWidth: columnDef.maxSize,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center px-2 py-1 h-10 ${
                            alignment === "right"
                              ? "justify-end"
                              : alignment === "center"
                              ? "justify-center"
                              : "justify-start"
                          }`}
                        >
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </div>
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
        </Table>
      </div>

      <ScrollArea
        className="w-full relative overflow-auto"
        style={{ height: tableHeight === "auto" ? undefined : tableHeight }}
      >
        <Table>
          <TableBody>
            {data && data.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={
                      selectedRows?.includes(row.id) ? "bg-muted/50" : undefined
                    }
                    onClick={() => {
                      row.toggleSelected(!row.getIsSelected());
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const columnDef = cell.column.columnDef;
                      const width = columnDef.size ?? "auto";
                      const minWidth = columnDef.minSize ?? 80;
                      const alignment =
                        (columnDef.meta?.alignment as string) || "center";

                      // Special styling for checkbox column
                      const isCheckboxColumn = columnDef.id === "select";

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "whitespace-nowrap py-2 px-3",
                            isCheckboxColumn && "p-0",
                            alignment === "right"
                              ? "text-right"
                              : alignment === "center"
                              ? "text-center"
                              : "text-left"
                          )}
                          style={{
                            width: width === "auto" ? undefined : width,
                            minWidth,
                            maxWidth: columnDef.maxSize,
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
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
      </ScrollArea>

      <div className="flex items-center justify-end p-4">
        {!hideRowSelectionCount && (
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getSelectedRowModel().rows.length > 0 && (
              <div>
                {table.getSelectedRowModel().rows.length} of {data?.length || 0}{" "}
                row(s) selected.
              </div>
            )}
          </div>
        )}
        <div className="flex items-center space-x-6 lg:space-x-8">
          {!hideRowsPerPage && (
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  onPaginationChange({
                    pageIndex: 0,
                    pageSize: Number(value),
                  });
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {pageIndex + 1} of {Math.max(1, pageCount)}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => {
                onPaginationChange({
                  pageIndex: 0,
                  pageSize,
                });
              }}
              disabled={pageIndex === 0}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                onPaginationChange({
                  pageIndex: pageIndex - 1,
                  pageSize,
                });
              }}
              disabled={pageIndex === 0}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                onPaginationChange({
                  pageIndex: pageIndex + 1,
                  pageSize,
                });
              }}
              disabled={pageIndex === pageCount - 1}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => {
                onPaginationChange({
                  pageIndex: pageCount - 1,
                  pageSize,
                });
              }}
              disabled={pageIndex === pageCount - 1}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
