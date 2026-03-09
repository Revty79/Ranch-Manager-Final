import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

interface DataTableShellProps {
  columns: string[];
  rows?: string[][];
  emptyLabel?: string;
}

export function DataTableShell({
  columns,
  rows = [],
  emptyLabel = "No records yet",
}: DataTableShellProps) {
  if (!rows.length) {
    return (
      <TableContainer>
        <div className="flex min-h-44 items-center justify-center bg-surface px-4 text-sm text-foreground-muted">
          {emptyLabel}
        </div>
      </TableContainer>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHeaderCell key={column}>{column}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell key={`${rowIndex}-${cellIndex}`}>
                  {cellIndex === row.length - 1 && cell.toLowerCase().includes("status") ? (
                    <Badge>{cell.replace("status:", "").trim()}</Badge>
                  ) : (
                    cell
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
