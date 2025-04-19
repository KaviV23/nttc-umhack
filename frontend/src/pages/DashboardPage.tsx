import { Text, Paper, Title, SimpleGrid, useMantineTheme, Box, Group } from '@mantine/core';
import dayjs from 'dayjs';
// Import customParseFormat plugin for dayjs if parsing 'YYYY-MM'
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat); // Extend dayjs with the plugin

import { useEffect, useState } from 'react'; // Ensure useState and useEffect are imported
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer // Important for responsiveness!
} from 'recharts';

// --- Interfaces ---

// Interface for the data points coming from /api/monthly_sales
interface ApiMonthlySalePoint {
  month: string; // Format: YYYY-MM
  total_sales: number;
}

// Interface for the whole response from /api/monthly_sales
interface MonthlySalesApiResponse {
  merchant_id: string;
  monthly_sales: ApiMonthlySalePoint[];
}

// Interface for the data structure needed by the Monthly Sales LineChart
interface ChartMonthlySalePoint {
    month: string; // Format: 'MMM' (e.g., 'Jan') for display
    sales: number;
}

// Interface for the Item Sales Bar Chart data
interface ChartItemSalePoint {
    name: string;
    sales: number;
}


// Other existing interfaces (ForecastRevenueDataList, etc.)
interface ForecastRevenueDataList {
  forecast_date: string;
  forecasted_revenue: number;
}
interface ForecastRevenueData {
  future_forecast: ForecastRevenueDataList[]
}
interface ForecastQuantityDataList {
  forecast_date: Date; // Note: API might return string, adjust if needed
  forecasted_revenue: number; // Should this be forecasted_quantity?
}
interface ForecastQuantityHistoryList {
  order_date: string;
  [itemName: `${string}_pred` | `${string}_actual`]: number;
}
interface ForecastQuantityGraphList {
  order_date: string;
  [itemKey: `item_${number}_${'pred' | 'actual'}`]: number;
}
interface ForecastQuantityData {
  historical_evaluation: ForecastQuantityHistoryList[]
  future_forecast: ForecastQuantityDataList[] // Check type of forecast_date if API returns string
  graph_forecast_ids: ForecastQuantityGraphList[]
}

// Colors for Pie Chart Slices (using Mantine theme colors) - Keep if used elsewhere
const PIE_COLORS = [ /* ... */ ];

// --- Dashboard Component ---

function DashboardPage() {
    const theme = useMantineTheme();
    // State variables for other charts (keep as they are)
    const [forecastSalesRevenue, setForecastSalesData] = useState<ForecastRevenueData | null>(null);
    const [forecastSalesQuantity, setForecastSalesQuantity] = useState<ForecastQuantityData | null>(null);
    const [forecastSalesQuantityKeys, setForecastSalesQuantityKeys] = useState<string[]>();
    // Correct type for itemSales state based on how it's populated
    const [itemSales, setItemSales] = useState<ChartItemSalePoint[]>([]); // Use ChartItemSalePoint[]
    const [totalSales, setTotalSales] = useState<number>(0)

    // *** ADD STATE FOR MONTHLY SALES CHART ***
    const [chartMonthlySalesData, setChartMonthlySalesData] = useState<ChartMonthlySalePoint[]>([]); // Initialize as empty array


    const getThemeColor = (colorName: string) => theme.colors[colorName]?.[6] || theme.primaryColor;

    useEffect(() => {

        // Function to create headers (avoids repetition)
        const createAuthHeaders = () => {
            const myHeaders = new Headers();
            const token = localStorage.getItem("access_token");
            if (token) {
                myHeaders.append("Authorization", `Bearer ${token}`); // Use Bearer prefix
            } else {
                console.warn("Access token not found in localStorage.");
                // Potentially handle redirect to login or show error
            }
            return myHeaders;
        };

        // Fetch Forecast Sales (Revenue) - unchanged logic
        async function fetchForecastSales() {
            const requestOptions = { method: "GET", headers: createAuthHeaders() };
            try {
                const response = await fetch("http://localhost:9000/api/forecast_sales", requestOptions);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setForecastSalesData(data);
            } catch (error) {
                console.error("Failed to fetch forecast sales:", error);
            }
        }

        // Fetch Forecast Sales (Quantity) - unchanged logic
        async function fetchForecastQuantity() {
            const requestOptions = { method: "GET", headers: createAuthHeaders() };
             try {
                const response = await fetch("http://localhost:9000/api/forecast_quantity", requestOptions);
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                setForecastSalesQuantity(result);
                // Safely access keys, check if graph_forecast_ids exists and has items
                if (result.graph_forecast_ids && result.graph_forecast_ids.length > 0) {
                    setForecastSalesQuantityKeys(
                        Object.keys(result.graph_forecast_ids[0]).filter((key) => key !== "order_date" && !key.includes("actual"))
                    );
                } else {
                    setForecastSalesQuantityKeys([]); // Set empty if no data
                }
            } catch (error) {
                console.error("Failed to fetch forecast quantity:", error);
            }
        }

        // Fetch Item Sales (for Bar Chart) - unchanged logic
        async function fetchItemSales() {
             const requestOptions = { method: "GET", headers: createAuthHeaders() };
             try {
                const response = await fetch("http://localhost:9000/api/actual_quantities?days=30", requestOptions);
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const res: ChartItemSalePoint[] = []; // Use correct type
                if (data.items && Array.isArray(data.items)) {
                     data.items.forEach((entry: { item_name: string; total_sales: number; }) => {
                         // Ensure total_sales is a number
                         if (typeof entry.total_sales === 'number') {
                             res.push({
                                 name: entry.item_name,
                                 sales: entry.total_sales,
                             });
                         } else {
                             console.warn(`Invalid sales data for item ${entry.item_name}:`, entry.total_sales);
                         }
                     });
                }
                setItemSales(res); // Update state with correctly typed array
                let sumSales = 0;
                res.forEach((item) => {
                  sumSales += item.sales
                })
                console.log(res);
                setTotalSales(sumSales);
            } catch (error) {
                console.error("Failed to fetch item sales:", error);
            }
        }

        // *** NEW FUNCTION TO FETCH MONTHLY SALES TREND ***
        async function fetchMonthlySalesTrend() {
            const requestOptions = { method: "GET", headers: createAuthHeaders() };
            try {
                const response = await fetch("http://localhost:9000/api/monthly_sales", requestOptions);
                if (!response.ok) {
                    // Handle HTTP errors more explicitly if needed
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: MonthlySalesApiResponse = await response.json();

                // --- Transform API data for the chart ---
                const transformedData: ChartMonthlySalePoint[] = data.monthly_sales.map(apiPoint => ({
                    month: dayjs(apiPoint.month, 'YYYY-MM').format('MMM'), // Parse YYYY-MM -> format MMM
                    sales: apiPoint.total_sales // Map total_sales to sales
                }));

                console.log("Fetched and transformed monthly sales:", transformedData);
                setChartMonthlySalesData(transformedData); // Update the specific state

            } catch (error) {
                console.error("Failed to fetch or process monthly sales trend:", error);
                setChartMonthlySalesData([]); // Set empty array on error to avoid chart issues
            }
          }

        // Call all fetch functions
        fetchForecastSales();
        fetchForecastQuantity();
        fetchItemSales();
        fetchMonthlySalesTrend(); // Call the new function

    }, []); // Empty dependency array ensures runs once on mount

    // --- RENDER ---
    return (
      <div>
        <Title order={1} mb="xl">
          Dashboard
        </Title>

        {/* Section 1: Monthly Sales Trend */}
        <SimpleGrid cols={{ base: 1 }} spacing="xl" mb="xl">
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={4} mb="md">
              Monthly Sales Trend
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              {/* Use the 'chartMonthlySalesData' state here */}
              <LineChart
                data={chartMonthlySalesData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                {/* Ensure dataKey matches the transformed data ('month') */}
                <XAxis dataKey="month" stroke={theme.colors.gray[7]} />
                <YAxis stroke={theme.colors.gray[7]} />
                <Tooltip
                  contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Sales"]}
                />
                <Legend />
                 {/* Ensure dataKey matches the transformed data ('sales') */}
                <Line type="monotone" dataKey="sales" stroke={getThemeColor(theme.primaryColor)} strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </SimpleGrid>

        {/* Section 2: Item Sales and This Month */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
          {/* Bar Chart - Uses 'itemSales' state */}
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={4} mb="md">
              Top Item Sales (Last 30 Days)
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={itemSales} layout="vertical" /* ... other props ... */ >
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.colors.gray[4]} />
                 <XAxis type="number" stroke={theme.colors.gray[7]} />
                 <YAxis dataKey="name" type="category" width={80} stroke={theme.colors.gray[7]} />
                 <Tooltip
                     contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                     formatter={(value: number) => [`$${value.toLocaleString()}`, "Sales"]}
                 />
                 <Legend />
                 <Bar dataKey="sales" fill={getThemeColor("green")} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          {/* This Month's Sales - Placeholder logic updated */}
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={4} mb="md">
              This Month's Sales
            </Title>
            <Group justify="center" h="80%">
              <Text size='48px' ta="center" fw="bold" c="dark"><span style={{color: totalSales > 60000 ? "#40c057" : "orange"}}>RM {totalSales}</span>/<br/>60000.00</Text>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Section 3: Forecasting */}
        <Title mb="md" order={2}>Forecasting</Title>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
          {/* Sales Forecast (Revenue) - Uses 'forecastSalesRevenue' state */}
          <Box>
             <Paper shadow="sm" p="md" radius="md" withBorder>
               <Title order={4} mb="md">Sales Forecast (Revenue)</Title>
               <ResponsiveContainer width="100%" height={300}>
                 <LineChart data={forecastSalesRevenue?.future_forecast} /* ... */ >
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                     <XAxis dataKey="forecast_date" tickFormatter={(dateStr) => dayjs(dateStr).isValid() ? dayjs(dateStr).format('YYYY-MM') : ''} stroke={theme.colors.gray[7]} />
                     <YAxis stroke={theme.colors.gray[7]} />
                     <Tooltip contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }} />
                     <Legend />
                     <Line type="monotone" dataKey="forecasted_revenue" stroke={getThemeColor(theme.primaryColor)} strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4 }} />
                 </LineChart>
               </ResponsiveContainer>
             </Paper>
          </Box>
          {/* Sales Forecast (Quantity) - Uses 'forecastSalesQuantity' state */}
          <Box>
             <Paper shadow="sm" p="md" radius="md" withBorder>
               <Title order={4} mb="md">Sales Forecast (Quantity)</Title>
               <ResponsiveContainer width="100%" height={300}>
                 <LineChart data={forecastSalesQuantity?.graph_forecast_ids} /* ... */ >
                     <XAxis dataKey="order_date" tickFormatter={(date) => dayjs(date).isValid() ? dayjs(date).format("YYYY-MM-DD") : ''} />
                     <YAxis />
                     <Tooltip labelFormatter={(date) => dayjs(date).isValid() ? dayjs(date).format("YYYY-MM-DD") : ''} />
                     <Legend />
                     {forecastSalesQuantityKeys?.map((key, index) => (
                         <Line key={key} type="monotone" dataKey={key} stroke={["#8884d8", "#82ca9d", "#ffc658", "#ff7300"][index % 4]} dot={false} />
                     ))}
                 </LineChart>
               </ResponsiveContainer>
             </Paper>
          </Box>
        </SimpleGrid>
      </div>
    );
}

export default DashboardPage;