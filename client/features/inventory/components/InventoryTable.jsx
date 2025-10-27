import { useTable } from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import {
  Clock,
  Search,
  Filter,
  X,
  Trash2,
  Pencil,
  Undo2
} from 'lucide-react'
import { useMoneyColumns } from '../../../hooks'
import { listTableFeatures } from '../../../utils'
import { StatusTag, BranchTag, SortableHeader } from '../../../components'

const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock']

const INVENTORY_SORTS = {
  'name-asc': { label: 'Name (A–Z)', sorting: [{ id: 'name', desc: false }] },
  'name-desc': { label: 'Name (Z–A)', sorting: [{ id: 'name', desc: true }] },
  'stock-asc': { label: 'Stock (low to high)', sorting: [{ id: 'stock', desc: false }] },
  'stock-desc': { label: 'Stock (high to low)', sorting: [{ id: 'stock', desc: true }] },
  'expiry-asc': { label: 'Expiry (soonest first)', sorting: [{ id: 'expiry', desc: false }] },
  'price-desc': { label: 'Selling price (high to low)', sorting: [{ id: 'sellingPrice', desc: true }] }
}


const INVENTORY_DEFAULT_SORTING = INVENTORY_SORTS['name-asc'].sorting

// Search matches the medicine name, SKU code, or batch number
const inventorySearchFn = (row, _columnId, value) => {
  const query = String(value).trim().toLowerCase()
  const { name, id, batch } = row.original
  return [name, id, batch].some((field) => field.toLowerCase().includes(query))
}

// heldQty(item): units held out of stock by pending return requests, shown under Current Stock.
// onRequestReturn: the Inventory Officer's "send back to supplier" button, on rows at returnBranchId (left out for other roles)
export default function InventoryTable({ data, branches, categories, showBranch, heldQty, onEdit, onDelete, onRequestReturn, returnBranchId }) {
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [sorting, setSorting] = useState(INVENTORY_DEFAULT_SORTING)

  const columns = useMemo(() => {
    const branchName = (id) => branches.find((b) => b.id === id)?.name || ''
    return [
      { accessorKey: 'name', header: 'Product Name', sortFn: 'text', cell: (info) => <span className="fw-600">{info.getValue()}</span> },
      ...(showBranch
        ? [{
            accessorKey: 'branchId',
            header: 'Branch',
            filterFn: 'equalsString',
            sortFn: (a, b) => branchName(a.original.branchId).localeCompare(branchName(b.original.branchId)),
            cell: (info) => <BranchTag branch={branches.find((b) => b.id === info.getValue())} />
          }]
        : []),
      { accessorKey: 'category', header: 'Category', filterFn: 'equalsString', sortFn: 'text' },
      {
        accessorKey: 'stock',
        header: 'Current Stock',
        sortFn: 'basic',
        cell: (info) => {
          const held = heldQty?.(info.row.original) || 0
          return (
            <>
              {info.getValue()} units
              {held > 0 && <div className="page-desc" style={{ margin: 0 }}>{held} on hold for return</div>}
            </>
          )
        }
      },
      { accessorKey: 'purchasePrice', header: moneyHeader('Unit Purchase Price'), sortFn: 'basic', cell: (info) => formatAmount(info.getValue()) },
      // The whole quantity's purchase cost: Current Stock × unit purchase price
      { id: 'totalCost', accessorFn: (row) => row.stock * (row.purchasePrice || 0), header: moneyHeader('Total Cost'), sortFn: 'basic', cell: (info) => formatAmount(info.getValue()) },
      { accessorKey: 'sellingPrice', header: moneyHeader('Unit Selling Price'), sortFn: 'basic', sortUndefined: 'last', cell: (info) => (info.getValue() == null ? <span className="not-set">Not set</span> : formatAmount(info.getValue())) },
      // What the row's whole stock would sell for: Current Stock × Unit Selling Price (Not set until it has a price)
      { id: 'totalSellingPrice', accessorFn: (row) => (row.sellingPrice == null ? undefined : row.stock * row.sellingPrice), header: moneyHeader('Total Selling Price'), sortFn: 'basic', sortUndefined: 'last', cell: (info) => (info.getValue() == null ? <span className="not-set">Not set</span> : formatAmount(info.getValue())) },
      { accessorKey: 'batch', header: 'Batch Number', sortFn: 'text', cell: (info) => <span className="batch-badge">{info.getValue()}</span> },
      {
        accessorKey: 'expiry',
        header: 'Expiration Date',
        sortFn: 'text',
        cell: (info) =>
          info.row.original.expiringSoon ? (
            <span className="expiry-warning" title="Expiring soon">
              <Clock size={13} /> {info.getValue()}
            </span>
          ) : (
            info.getValue()
          )
      },
      { accessorKey: 'status', header: 'Status', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <StatusTag status={info.getValue()} /> },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: (info) => {
          const item = info.row.original
          return (
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="icon-btn" onClick={() => onEdit(item)} aria-label={`Edit ${item.name} at ${branches.find((b) => b.id === item.branchId)?.name}`} title="Edit">
                <Pencil size={15} />
              </button>
              {onRequestReturn && item.stock > 0 && item.branchId === returnBranchId && (
                <button type="button" className="icon-btn" onClick={() => onRequestReturn(item)} aria-label={`Request a supplier return of ${item.name} at ${branches.find((b) => b.id === item.branchId)?.name}`} title="Request supplier return">
                  <Undo2 size={15} />
                </button>
              )}
              <button type="button" className="icon-danger-btn" onClick={() => onDelete(item)} aria-label={`Delete ${item.name} at ${branches.find((b) => b.id === item.branchId)?.name}`} title="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          )
        }
      }
    ]
  }, [branches, showBranch, moneyHeader, formatAmount, heldQty, onEdit, onDelete, onRequestReturn, returnBranchId])

  // The branch filter only applies while the Branch column is shown
  const activeColumnFilters = showBranch ? columnFilters : columnFilters.filter((f) => f.id !== 'branchId')

  const table = useTable({
    features: listTableFeatures,
    columns,
    data,
    state: { globalFilter, columnFilters: activeColumnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: inventorySearchFn,
    getColumnCanGlobalFilter: (column) => column.id === 'name'
  })

  const filterValue = (id) => activeColumnFilters.find((f) => f.id === id)?.value ?? 'all'
  const setFilter = (id, value) => {
    table.getColumn(id)?.setFilterValue(value === 'all' ? undefined : value)
  }

  const sortKey = Object.keys(INVENTORY_SORTS).find((key) => JSON.stringify(INVENTORY_SORTS[key].sorting) === JSON.stringify(sorting)) ?? (sorting.length ? 'custom' : 'none')
  const filtersActive = Boolean(globalFilter) || activeColumnFilters.length > 0 || sortKey !== 'name-asc'

  const clearFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting(INVENTORY_DEFAULT_SORTING)
  }

  const matchingCount = table.getFilteredRowModel().rows.length
  const visibleColumnCount = columns.length + 1

  return (
    <>
      {/* Search & Filters */}
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search by name, SKU, or batch..."
            aria-label="Search inventory"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
            }}
          />
        </div>

        <select className="input-field filter-select" aria-label="Filter by category" value={filterValue('category')} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select className="input-field filter-select" aria-label="Filter by status" value={filterValue('status')} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="all">All Statuses</option>
          {INVENTORY_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        {showBranch && (
          <select className="input-field filter-select" aria-label="Filter by branch" value={filterValue('branchId')} onChange={(e) => setFilter('branchId', e.target.value)}>
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{matchingCount}</strong> of {data.length} items match
        </span>
        {filtersActive && (
          <button type="button" className="link-btn" onClick={clearFilters}>
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                <th>No</th>
                {group.headers.map((header) => (
                  <SortableHeader key={header.id} header={header} table={table} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {matchingCount === 0 && (
              <tr>
                <td colSpan={visibleColumnCount} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No medicines match your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </>
  )
}
