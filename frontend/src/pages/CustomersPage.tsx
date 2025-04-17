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
  rem, // For Mantine v7 specific styling like rem
  Loader,
  Alert
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSelector, IconChevronDown, IconChevronUp, IconSearch, IconAlertCircle } from '@tabler/icons-react';
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
} from '@tanstack/react-table';
import dayjs from 'dayjs';

// Define the structure of your data rows
interface CustomerData {
  customer_id: number;
  last_order_date: string;
  favorite_food: string;
}

interface ApiResponse {
  results: CustomerData[];
}

// Helper component for Table Headers with Sorting
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
      <UnstyledButton onClick={canSort ? onSort : undefined} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
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


const CustomersPage: React.FC = () => {
  // Modal State
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedRowData, setSelectedRowData] = useState<CustomerData | null>(null);

  // TanStack Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0, // Initial page index
    pageSize: 10, // Initial page size
  });

  // State for fetched data, loading, and errors
  const [data, setData] = useState<CustomerData[]>([]); // Initialize with empty array
  const [isLoading, setIsLoading] = useState(true); // Start in loading state
  const [error, setError] = useState<string | null>(null); // To store potential fetch errors

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
        setError("Failed to load customer data. Please try again later."); // Set user-friendly error message
        setData([]); // Clear data on error
      } finally {
        setIsLoading(false); // Set loading false after fetch attempt (success or failure)
      }
    };

    fetchData();
  }, []);

  // Define columns using TanStack's ColumnDef
  const columns = useMemo<ColumnDef<CustomerData>[]>(
    () => [
      {
        accessorKey: 'customer_id',
        header: 'User ID',
        enableSorting: true,
        enableGlobalFilter: true, // Explicitly needed for global filter function
      },
      {
        accessorKey: 'last_order_date',
        header: 'Last Order Date',
        cell: info => {
            const dateValue = info.getValue<string>();
            return dateValue ? dayjs(dateValue).format('YYYY-MM-DD HH:mm') : 'N/A';
        },
        enableSorting: true,
        enableGlobalFilter: false, // Usually don't globally filter formatted dates
      },
      {
        accessorKey: 'favorite_food',
        header: 'Favourite Food',
        enableSorting: true,
        enableGlobalFilter: true,
      },
      {
        id: 'actions',
        header: 'Action',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => ( // Use info.row in TanStack v8
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setSelectedRowData(row.original);
              openModal();
            }}
          >
            Generate Email
          </Button>
        ),
      },
    ],
    [openModal] // Dependency for the action cell
  );

  // Create TanStack Table instance
  const table = useReactTable({
    data,
    columns,
    state: { // Pass state variables
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting, // Wire up state update functions
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(), // Enable basic row model
    getSortedRowModel: getSortedRowModel(), // Enable sorting
    getFilteredRowModel: getFilteredRowModel(), // Enable filtering (needed for global)
    getPaginationRowModel: getPaginationRowModel(), // Enable pagination
    // debugTable: true, // Uncomment for debugging
  });

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <Box>
      <Title order={2} mb="md">Customer Data</Title>

      {/* Filter Input */}
      <TextInput
        placeholder="Search all columns..."
        leftSection={<IconSearch style={{ width: rem(16), height: rem(16) }} stroke={1.5} />}
        value={globalFilter ?? ''}
        onChange={(event) => setGlobalFilter(event.currentTarget.value)}
        mb="md"
        style={{ maxWidth: rem(400) }}
        disabled={isLoading || !!error} // Disable search if loading or error
      />

      {/* Display Error Alert if fetch failed */}
      {error && (
        <Alert title="Error" color="red" icon={<IconAlertCircle />} mb="md">
          {error}
        </Alert>
      )}

      {/* Table Area */}
      <ScrollArea>
        <Table miw={700} striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="sm">
          <Table.Thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Th
                    key={header.id}
                    sorted={header.column.getIsSorted() === 'asc'}
                    reversed={header.column.getIsSorted() === 'desc'}
                    onSort={header.column.getToggleSortingHandler()}
                    canSort={header.column.getCanSort() && !isLoading && !error} // Can only sort if not loading/error
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
            {/* Show Loading State */}
            {isLoading && (
              <Table.Tr>
                <Table.Td colSpan={columns.length} style={{ textAlign: 'center' }}>
                  <Loader size="md" />
                  <Text mt="sm">Loading data...</Text>
                </Table.Td>
              </Table.Tr>
            )}

            {/* Show No Data / Filtered Out Message */}
            {!isLoading && !error && table.getRowModel().rows.length === 0 && (
               <Table.Tr>
                 <Table.Td colSpan={columns.length} style={{ textAlign: 'center' }}>
                   {data.length === 0
                     ? "No customer data available." // API returned empty list
                     : "No customers found matching your search." // Data exists, but filter yields no results
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
            <Text size="sm">
                Showing{' '}
                {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}
                {' '}-{' '}
                {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length // Base count on filtered rows
                )}
                {' '}of {table.getFilteredRowModel().rows.length} customers
            </Text>
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
                    disabled={pageCount <= 1 && table.getFilteredRowModel().rows.length <= table.getState().pagination.pageSize} // Disable if only one page worth of data
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


      {/* Email Preview Modal (same as before) */}
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