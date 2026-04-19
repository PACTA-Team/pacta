import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
  showFirstLast?: boolean
}

function getPageNumbers(current: number, total: number, sibling: number): (number | "ellipsis")[] {
  const items: (number | "ellipsis")[] = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      items.push(i)
    }
    return items
  }

  items.push(1)

  const start = Math.max(2, current - sibling)
  const end = Math.min(total - 1, current + sibling)

  if (start > 2) {
    items.push("ellipsis")
  }

  for (let i = start; i <= end; i++) {
    items.push(i)
  }

  if (end < total - 1) {
    items.push("ellipsis")
  }

  items.push(total)

  return items
}

export function Pagination({
  className,
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  ...props
}: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages, siblingCount)

  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      aria-label="pagination"
      className={cn("flex items-center justify-center gap-1", className)}
      {...props}
    >
      {showFirstLast && (
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          className="hidden sm:flex"
        >
          <ChevronLeft className="h-4 w-4" />
          <ChevronLeft className="h-4 w-4 -ml-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((page, index) => {
        if (page === "ellipsis") {
          return (
            <span
              key={`ellipsis-${index}`}
              className="flex h-8 w-8 items-center justify-center"
              aria-hidden="true"
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          )
        }

        const isActive = page === currentPage
        const isCurrentNear = Math.abs(page - currentPage) <= siblingCount

        return (
          <Button
            key={page}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "min-w-[2rem] justify-center",
              isActive && "pointer-events-none"
            )}
          >
            {page}
          </Button>
        )
      })}

      <Button
        variant="ghost"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {showFirstLast && (
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          className="hidden sm:flex"
        >
          <ChevronRight className="h-4 w-4 -mr-4" />
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </nav>
  )
}

export interface PaginationInfoProps {
  className?: string
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
}

export function PaginationInfo({
  className,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
}: PaginationInfoProps) {
  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div
      className={cn("text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      Showing <span className="font-medium">{start}</span> to{" "}
      <span className="font-medium">{end}</span> of{" "}
      <span className="font-medium">{totalItems}</span> results (page{" "}
      <span className="font-medium">{currentPage}</span> of{" "}
      <span className="font-medium">{totalPages}</span>)
    </div>
  )
}