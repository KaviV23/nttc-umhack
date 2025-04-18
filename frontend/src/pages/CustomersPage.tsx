import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  ScrollArea,
  Group,
  Text,
  Pagination,
  TextInput,
  Button,
  Modal,
  Stack,
  Title,
  UnstyledButton,
  Center,
  Select,
  Box,
  rem,
  Loader,
  Alert,
  NumberInput, 
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSelector, IconChevronDown, IconChevronUp, IconSearch, IconAlertCircle, IconX } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type ColumnFiltersState,
  type FilterFn,
  type Row,
} from '@tanstack/react-table';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);
// Simulated "current" date for demo purposes
const SIMULATED_TODAY = dayjs('2023-12-31'); // Pick your demo date here
const getToday = () => SIMULATED_TODAY

// Define the structure of data rows
interface CustomerData {
  customer_id: number;
  last_order_date: string;
  favorite_food: string;
}

// Define the expected structure of API response
interface ApiResponse {
    results: CustomerData[];
}

// Helper component for Table Headers
interface ThProps {
  children: React.ReactNode;
  reversed?: boolean;
  sorted?: boolean;
  onSort(): void;
  canSort: boolean;
}

function Th({ children, reversed, sorted, onSort, canSort }: ThProps) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <Table.Th>
      <UnstyledButton onClick={canSort ? onSort : undefined} style={{ display: 'flex', alignItems: 'center', width: '100%' }} disabled={!canSort}>
        <Group justify="space-between" style={{ flexGrow: 1 }}>
          <Text fw={500} fz="sm">
            {children}
          </Text>
          {canSort && (
            <Center>
              <Icon style={{ width: rem(16), height: rem(16) }} stroke={1.5} />
            </Center>
          )}
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}


// --- Filter Function for Date Range ---
// This filter function checks if the row's date is within the last 'X' days
const filterByDaysAgo: FilterFn<CustomerData> = (
  row: Row<CustomerData>,
  columnId: string,
  filterValue: number // Expecting the number of days
) => {
  if (typeof filterValue !== 'number' || filterValue <= 0) {
    return true; // If filter value is invalid or not set, don't filter out the row
  }

  const rowValue = row.getValue(columnId);
  if (!rowValue) {
    return false; // If the row doesn't have a date, filter it out
  }

  const date = dayjs(rowValue as string);
  if (!date.isValid()) {
    return false; // If the date is invalid, filter it out
  }

  // -- REAL DATE --
  //const today = dayjs();
  // -- FAKE DATE FOR DEMO PURPOSES
  const today = getToday();
  const thresholdDate = today.subtract(filterValue, 'day').startOf('day'); // Go back X days, compare from start of that day

  // Check if the row's date is between the threshold date and today (inclusive of today)
  return date.isAfter(thresholdDate) && date.isBefore(today.endOf('day'));
};
// --- End Custom Filter Function ---


const CustomersPage: React.FC = () => {
  // Modal State
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedRowData, setSelectedRowData] = useState<CustomerData | null>(null);

  // Data Fetching State
  const [data, setData] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TanStack Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]); // State for column filters
  // URL Query Filtering
  const [searchParams, setSearchParams] = useSearchParams();
  const daysAgoQuery = searchParams.get('daysAgo');
  const [filterDaysAgo, setFilterDaysAgoState] = useState<number | ''>(() => {
    const num = daysAgoQuery ? parseInt(daysAgoQuery, 10) : NaN;
    return !isNaN(num) && num > 0 ? num : '';
  });

  const setFilterDaysAgo = (value: number | '') => {
    setFilterDaysAgoState(value);
  
    if (typeof value === 'number' && value > 0) {
      searchParams.set('daysAgo', value.toString());
    } else {
      searchParams.delete('daysAgo');
    }
  
    setSearchParams(searchParams);
  };
  
  

  // --- Data Fetching Logic
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/getCustomersByMerchant`,
          {
            method: "GET",
            headers: {
              Authorization: `bearer ${localStorage.getItem("access_token")}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result: ApiResponse = await response.json();
        setData(result.results || []);
      } catch (e) {
        console.error("Failed to fetch customer data:", e);
        setError("Failed to load customer data. Please try again later.");
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Effect to Update Column Filters based on filterDaysAgo ---
  useEffect(() => {
    // Update the columnFilters state when filterDaysAgo changes
    setColumnFilters(prevFilters => {
        // Remove any existing filter for 'last_order_date'
        const otherFilters = prevFilters.filter(f => f.id !== 'last_order_date');

        // If filterDaysAgo has a valid number, add the new filter
        if (typeof filterDaysAgo === 'number' && filterDaysAgo > 0) {
            return [...otherFilters, { id: 'last_order_date', value: filterDaysAgo }];
        }

        // Otherwise, just return the filters for other columns
        return otherFilters;
    });

  }, [filterDaysAgo]); // Re-run this effect when filterDaysAgo changes

  // --- Column Definitions ---
  const columns = useMemo<ColumnDef<CustomerData>[]>(
    () => [
      {
        accessorKey: 'customer_id',
        header: 'User ID',
        enableSorting: true,
        enableColumnFilter: false, // Disable default column filter UI for this
      },
      {
        accessorKey: 'last_order_date',
        header: 'Last Order Date',
        cell: info => {
            const dateValue = info.getValue<string>();
            return dateValue ? dayjs(dateValue).format('YYYY-MM-DD HH:mm') : 'N/A';
        },
        enableSorting: true,
        filterFn: filterByDaysAgo, // Assign the custom filter function
        enableColumnFilter: true, // Enable column filtering logic for this column
        // Disable the default UI filter input provided by some table libs if needed
        // enableGlobalFilter: false // Already set
      },
      {
        accessorKey: 'favorite_food',
        header: 'Favourite Food',
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        id: 'actions',
        header: 'Action',
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setSelectedRowData(row.original);
              openModal();
            }}
            disabled={isLoading}
          >
            Generate Email
          </Button>
        ),
      },
    ],
    [openModal, isLoading]
  );

  // --- TanStack Table Instance ---
  const table = useReactTable({
    data,
    columns,
    filterFns: {
      // You *could* register the filterFn here globally if used in many places
      // filterByDaysAgo: filterByDaysAgo, // But defining it directly on the column is fine too
    },
    state: {
      sorting,
      globalFilter,
      pagination,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  // Handler to clear the date filter
  const clearDateFilter = () => {
      setFilterDaysAgo('');
  };

  // --- Render Logic ---
  return (
    <Box>
      <Title order={2}>Customer Data</Title>
      <Text mb="md">As of {getToday().toString()}</Text>

      {/* Filter Controls */}
      <Group mb="md" align="flex-end">
        {/* Global Text Filter */}
        <TextInput
            label="Search All"
            placeholder="Search ID, food..."
            leftSection={<IconSearch style={{ width: rem(16), height: rem(16) }} stroke={1.5} />}
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.currentTarget.value)}
            style={{ flexGrow: 1, minWidth: rem(200) }}
            disabled={isLoading || !!error}
        />
        {/* Programmatic Date Filter Input */}
        <NumberInput
            label="Last Order Within (Days)"
            placeholder="e.g., 30"
            value={filterDaysAgo}
            onChange={setFilterDaysAgo} // Directly set the state
            min={1} // Optional: minimum days
            step={1}
            allowDecimal={false}
            disabled={isLoading || !!error}
            style={{ width: rem(200) }}
            rightSection={
                filterDaysAgo ? (
                    <UnstyledButton onClick={clearDateFilter} aria-label="Clear date filter">
                         <IconX style={{ width: rem(16), height: rem(16) }} stroke={1.5} />
                    </UnstyledButton>
                ) : null
            }
            rightSectionPointerEvents="all"
        />
      </Group>


      {/* Display Error Alert */}
      {error && (
        <Alert title="Error" color="red" icon={<IconAlertCircle />} mb="md">
          {error}
        </Alert>
      )}

      {/* Table Area */}
      <ScrollArea>
        <Table miw={700} striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="sm">
           <Table.Thead>
              {/* Header rendering remains the same */}
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Th
                      key={header.id}
                      sorted={header.column.getIsSorted() === 'asc'}
                      reversed={header.column.getIsSorted() === 'desc'}
                      onSort={header.column.getToggleSortingHandler()}
                      canSort={header.column.getCanSort() && !isLoading && !error}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </Th>
                  ))}
                </Table.Tr>
              ))}
            </Table.Thead>
            <Table.Tbody>
              {/* Loading State */}
              {isLoading && (
                <Table.Tr>
                  <Table.Td colSpan={columns.length} style={{ textAlign: 'center' }}>
                    <Loader size="md" />
                    <Text mt="sm">Loading data...</Text>
                  </Table.Td>
                </Table.Tr>
              )}

              {/* No Data / Filtered Out Message */}
              {!isLoading && !error && table.getRowModel().rows.length === 0 && (
                 <Table.Tr>
                   <Table.Td colSpan={columns.length} style={{ textAlign: 'center' }}>
                     {data.length === 0
                       ? "No customer data available."
                       : "No customers found matching your filter criteria." // Generic message for any filter
                     }
                   </Table.Td>
                 </Table.Tr>
              )}

              {/* Render Table Rows */}
              {!isLoading && !error && table.getRowModel().rows.length > 0 && (
                table.getRowModel().rows.map((row) => (
                  <Table.Tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Pagination Controls */}
      {/* Only show pagination if not loading, no error, and there's data */}
      {!isLoading && !error && data.length > 0 && (
          <Group justify="space-between" align="center" mt="md">
             {/* Row count display */}
             <Text size="sm">
                Showing{' '}
                {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}
                {' '}-{' '}
                {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length // Count based on filtered rows
                )}
                {' '}of {table.getFilteredRowModel().rows.length} customers
            </Text>
            {/* Rows per page + Pagination */}
             <Group>
                <Text size="sm">Rows per page:</Text>
                 <Select
                     style={{width: rem(80)}}
                     value={String(table.getState().pagination.pageSize)}
                     onChange={(value) => {
                        if (value) {
                            table.setPageSize(Number(value));
                        }
                     }}
                     data={['5', '10', '20', '50', '100']}
                     allowDeselect={false}
                     disabled={table.getFilteredRowModel().rows.length <= 5} // Example: disable if not enough rows
                 />
                 <Pagination
                    total={pageCount}
                    value={currentPage}
                    onChange={(page) => table.setPageIndex(page - 1)}
                    disabled={pageCount <= 1}
                    />
             </Group>
          </Group>
      )}

      {/* Email Preview Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={<Title order={3}>Email Preview for User ID: {selectedRowData?.customer_id}</Title>}
        centered
        size="lg"
      >
         {/* Modal content remains the same */}
         <Stack gap="md">
            <Text>
                This is a preview of the AI-generated email for User ID{' '}
                <Text span fw={700}>{selectedRowData?.customer_id}</Text>.
            </Text>
            <Text>
                Based on their last order on{' '}
                <Text span fw={700}>
                    {selectedRowData?.last_order_date ? dayjs(selectedRowData.last_order_date).format('YYYY-MM-DD HH:mm') : 'N/A'}
                </Text>
                {' '}and their favourite food,{' '}
                 <Text span fw={700}>{selectedRowData?.favorite_food}</Text>,
                 the AI would generate a personalized message here.
            </Text>
            <Text fs="italic" c="dimmed">
                [Dummy AI Generated Email Content Placeholder]
                <br /><br />
                Subject: We miss your {selectedRowData?.favorite_food}!
                <br /><br />
                Hi Customer {selectedRowData?.customer_id},
                <br /><br />
                We noticed you haven't ordered since {selectedRowData?.last_order_date ? dayjs(selectedRowData.last_order_date).format('YYYY-MM-DD') : 'a while'}. We miss seeing you!
                <br /><br />
                We know you love our {selectedRowData?.favorite_food}. How about coming back to enjoy it again soon?
                <br /><br />
                [Include a potential offer or new item related to {selectedRowData?.favorite_food} here.]
                <br /><br />
                Looking forward to serving you again!
                <br /><br />
                Best regards,
                <br />
                [Your Company Name]
            </Text>
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeModal}>
            Cancel
          </Button>
          <Button onClick={() => {
             console.log("Simulating sending email for:", selectedRowData);
             alert(`Simulating email sent to User ID: ${selectedRowData?.customer_id}`);
             closeModal();
          }}>
            Send Email
          </Button>
        </Group>
      </Modal>
    </Box>
  );
};

export default CustomersPage;