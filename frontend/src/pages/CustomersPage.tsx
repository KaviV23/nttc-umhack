import { useSearchParams } from 'react-router-dom';
import {
    Table,
    Title,
    Button,
    SegmentedControl,
    Stack,
    Group,
    Text,
    ScrollArea, // Use ScrollArea for better table handling if needed
} from '@mantine/core';
import { useMemo } from 'react';

// --- Constants and Data (Paste the date/customer definitions from above here) ---

// Define the "current" date as per the requirement
const CURRENT_DATE = new Date('2025-12-04T00:00:00Z');

// Calculate the cutoff date (one month before)
const CUTOFF_DATE = new Date(CURRENT_DATE);
CUTOFF_DATE.setMonth(CURRENT_DATE.getMonth() - 1);

// Helper to format dates nicely
const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

interface Customer {
    id: number;
    name: string;
    lastOrderDate: Date;
    favoriteFood: string;
}

const dummyCustomers: Customer[] = [
    // Customers with orders MORE than a month ago (inactive)
    { id: 1, name: 'Alice Smith', lastOrderDate: new Date('2025-10-15T10:00:00Z'), favoriteFood: 'Pizza' },
    { id: 2, name: 'Bob Johnson', lastOrderDate: new Date('2025-09-01T14:30:00Z'), favoriteFood: 'Tacos' },
    { id: 3, name: 'Charlie Brown', lastOrderDate: new Date('2025-10-30T08:15:00Z'), favoriteFood: 'Sushi' },
    { id: 7, name: 'Grace Hall', lastOrderDate: new Date('2025-06-20T11:00:00Z'), favoriteFood: 'Salad' },
    // Customers with orders WITHIN the last month (active)
    { id: 4, name: 'Diana Prince', lastOrderDate: new Date('2025-11-10T12:00:00Z'), favoriteFood: 'Burgers' },
    { id: 5, name: 'Ethan Hunt', lastOrderDate: new Date('2025-11-28T18:00:00Z'), favoriteFood: 'Pasta' },
    { id: 6, name: 'Fiona Glenanne', lastOrderDate: new Date('2025-12-01T09:45:00Z'), favoriteFood: 'Curry' },
    { id: 8, name: 'Henry Jones', lastOrderDate: new Date('2025-11-05T16:20:00Z'), favoriteFood: 'Steak' },
    { id: 9, name: 'Ivy Green', lastOrderDate: new Date('2025-11-18T13:00:00Z'), favoriteFood: 'Ramen' },
    { id: 10, name: 'Jack Ryan', lastOrderDate: new Date('2025-12-03T20:00:00Z'), favoriteFood: 'Fish & Chips' },
];

// --- Component ---

function CustomersPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Get the current filter value from URL, default to 'all'
    const currentFilter = searchParams.get('filter') || 'all'; // 'all' or 'inactive'

    // Filter the customers based on the URL parameter
    // useMemo prevents recalculating on every render unless dependencies change
    const filteredCustomers = useMemo(() => {
        if (currentFilter === 'inactive') {
            // Keep customers whose last order date is BEFORE the cutoff date
            return dummyCustomers.filter(customer => customer.lastOrderDate < CUTOFF_DATE);
        }
        // Otherwise (filter is 'all' or unrecognized), show all customers
        return dummyCustomers;
    }, [currentFilter]); // Dependency: recalculate when filter changes

    // Handler for filter change
    const handleFilterChange = (value: string) => {
        if (value === 'all') {
            // Remove the filter param for 'all' to keep URL cleaner
            setSearchParams({});
        } else {
            setSearchParams({ filter: value });
        }
    };

    // Function for the dummy button action
    const handleGenerateEmail = (customerName: string) => {
        console.log(`Generating email for: ${customerName}`);
        // In a real app, this would trigger an API call or modal, etc.
        alert(`Placeholder: Generate email for ${customerName}`);
    };

    // Map filtered data to Table Rows
    const rows = filteredCustomers.map((customer) => (
        <Table.Tr key={customer.id}>
            <Table.Td>{customer.name}</Table.Td>
            <Table.Td>{formatDate(customer.lastOrderDate)}</Table.Td>
            <Table.Td>{customer.favoriteFood}</Table.Td>
            <Table.Td>
                <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleGenerateEmail(customer.name)}
                >
                    Generate email
                </Button>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <Stack gap="lg"> {/* Use Stack for vertical layout */}
            <Title order={1}>Customers</Title>

            {/* // comment out filter control for now
            <Group> 
                <SegmentedControl
                    value={currentFilter}
                    onChange={handleFilterChange}
                    data={[
                        { label: 'All Customers', value: 'all' },
                        { label: 'Inactive (No Order in 1 Month+)', value: 'inactive' },
                    ]}
                />
            </Group>
            */}

            {/* Wrap table in ScrollArea if it might get wide or very long */}
            {/* <ScrollArea> */}
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                        {/* Optional: Add stickyHeader for long tables */}
                        {/* <Table.Thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}> */}
                        <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Last Order Date</Table.Th>
                            <Table.Th>Favorite Food</Table.Th>
                            <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.length > 0 ? (
                            rows
                        ) : (
                            <Table.Tr>
                                <Table.Td colSpan={4}>
                                    <Text ta="center" c="dimmed" py="md">
                                        No customers match the current filter.
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>
            {/* </ScrollArea> */}
        </Stack>
    );
}

export default CustomersPage;