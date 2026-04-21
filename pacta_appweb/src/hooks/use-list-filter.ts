import * as React from "react"

export interface ListFilterConfig<T> {
  searchKeys: (keyof T)[]
  filters: Partial<Record<keyof T, T[keyof T]>>
  searchTerm: string
}

export interface UseListFilterResult<T> {
  filteredItems: T[]
  setSearchTerm: (term: string) => void
  setFilter: (key: keyof T, value: T[keyof T]) => void
  clearFilters: () => void
}

export function useListFilter<T>(
  items: T[],
  config: ListFilterConfig<T>
): UseListFilterResult<T> {
  const [searchTerm, setSearchTerm] = React.useState(config.searchTerm)
  const [filters, setFilters] = React.useState(config.filters)

  const filteredItems = React.useMemo(() => {
    let result = [...items]

    // Filter by search term
    if (searchTerm && config.searchKeys.length > 0) {
      const term = searchTerm.toLowerCase()
      result = result.filter((item) =>
        config.searchKeys.some((key) => {
          const value = item[key]
          if (typeof value === "string") {
            return value.toLowerCase().includes(term)
          }
          if (typeof value === "number") {
            return value.toString().includes(term)
          }
          return false
        })
      )
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "all" && value !== "") {
        result = result.filter((item) => {
          const itemValue = item[key as keyof T]
          return itemValue === value
        })
      }
    })

    return result
  }, [items, searchTerm, config.searchKeys, filters])

  const setFilter = (key: keyof T, value: T[keyof T]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilters({})
  }

  return {
    filteredItems,
    setSearchTerm,
    setFilter,
    clearFilters,
  }
}

export function useListFilterWithDeps<T>(
  items: T[],
  searchKeys: (keyof T)[],
  initialFilters?: Partial<Record<keyof T, T[keyof T]>>
): UseListFilterResult<T> {
  const [filters, setFilters] = React.useState<Partial<Record<keyof T, T[keyof T]>>>(
    initialFilters || {}
  )
  const [searchTerm, setSearchTerm] = React.useState("")

  const filteredItems = React.useMemo(() => {
    let result = [...items]

    // Filter by search term
    if (searchTerm && searchKeys.length > 0) {
      const term = searchTerm.toLowerCase()
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = item[key]
          if (typeof value === "string") {
            return value.toLowerCase().includes(term)
          }
          if (typeof value === "number") {
            return value.toString().includes(term)
          }
          return false
        })
      )
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "all" && value !== "") {
        result = result.filter((item) => {
          const itemValue = item[key as keyof T]
          return itemValue === value
        })
      }
    })

    return result
  }, [items, searchTerm, searchKeys, filters])

  const setFilter = (key: keyof T, value: T[keyof T]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilters({})
  }

  return {
    filteredItems,
    setSearchTerm,
    setFilter,
    clearFilters,
  }
}