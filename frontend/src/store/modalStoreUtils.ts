import { SortingState } from "@tanstack/react-table";

// --- Filter Function ---
export function filter(data: any[], query: string): any[] {
  if (!query) {
    return data; // No query, return original data
  }
  const lowercaseQuery = query.toLowerCase();
  return data.filter((row) =>
    Object.values(row).some((value) =>
      String(value).toLowerCase().includes(lowercaseQuery)
    )
  );
}

// --- Sort Function ---
export function sort(data: any[], sortingState: SortingState): any[] {
  if (!sortingState || sortingState.length === 0) {
    return data; // No sorting, return original data
  }

  // Create a mutable copy for sorting
  const sortedData = [...data];

  sortedData.sort((rowA, rowB) => {
    for (const sortItem of sortingState) {
      const { id, desc } = sortItem;
      const valueA = rowA[id];
      const valueB = rowB[id];

      // Basic comparison logic (can be enhanced for different types)
      let comparison = 0;
      if (valueA === null || valueA === undefined) comparison = -1;
      else if (valueB === null || valueB === undefined) comparison = 1;
      else if (typeof valueA === "number" && typeof valueB === "number") {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }

      if (comparison !== 0) {
        return desc ? -comparison : comparison;
      }
    }
    return 0; // Rows are equal according to all sort criteria
  });

  return sortedData;
}

// --- Paginate Function ---
export function paginate(
  data: any[],
  pageIndex: number,
  pageSize: number
): any[] {
  const startIndex = pageIndex * pageSize;
  const endIndex = startIndex + pageSize;
  return data.slice(startIndex, endIndex);
}
