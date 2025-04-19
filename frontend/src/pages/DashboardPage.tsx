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


// Revenue Forecast Interfaces
interface ForecastRevenueDataList {
  forecast_date: string;
  forecasted_revenue: number;
}
interface ForecastRevenueData {
  future_forecast: ForecastRevenueDataList[]
}


// --- UPDATED Quantity Forecast Interfaces ---

// Represents one day's forecast data point in the array returned by the backend
interface ForecastQuantityDataPoint {
  order_date: string; // Expecting 'YYYY-MM-DD' string
  [itemNameKey: `${string}_pred`]: number; // Dynamic keys like "Pancit_Malabon_pred": 10
}

// Represents the entire API response for quantity forecast
interface ForecastQuantityApiResponse {
  merchant_id: string;
  forecast_period: string; // Added based on new API output
  // The key containing the forecast data array
  future_forecast_by_name: ForecastQuantityDataPoint[];
  // Add other keys if your backend sends them (e.g., historical data)
  // historical_evaluation?: any[];
}


// Colors for Pie Chart Slices (using Mantine theme colors) - Keep if used elsewhere
const PIE_COLORS = [
    'blue', // theme.colors.blue[6]
    'teal', // theme.colors.teal[6]
    'grape', // theme.colors.grape[6]
    'orange', // theme.colors.orange[6]
    'indigo', // theme.colors.indigo[6]
    'red', // theme.colors.red[6]
    'lime', // theme.colors.lime[6]
];

// --- Dashboard Component ---

function DashboardPage() {
    const theme = useMantineTheme();
    // State for Revenue Forecast (Unchanged)
    const [forecastSalesRevenue, setForecastSalesData] = useState<ForecastRevenueData | null>(null);

    // *** UPDATE State Type for Quantity Forecast ***
    const [forecastSalesQuantity, setForecastSalesQuantity] = useState<ForecastQuantityApiResponse | null>(null);
    // State to hold the dynamic item name keys (e.g., "Pancit_Malabon_pred")
    const [forecastQuantityItemKeys, setForecastQuantityItemKeys] = useState<string[]>([]); // Renamed for clarity

    // State for Item Sales Bar Chart (Unchanged)
    const [itemSales, setItemSales] = useState<ChartItemSalePoint[]>([]);
    // State for Monthly Sales Trend Chart (Unchanged)
    const [chartMonthlySalesData, setChartMonthlySalesData] = useState<ChartMonthlySalePoint[]>([]);
    // State for Total Sales calculation (Unchanged)
    const [totalSales, setTotalSales] = useState<number>(0);


    const getThemeColor = (colorName: string) => theme.colors[colorName]?.[6] || theme.primaryColor;
    // const pieChartColors = PIE_COLORS.map(colorName => getThemeColor(colorName)); // Generate if/when pie chart is used


    // --- useEffect Hook ---
    useEffect(() => {

        // Function to create headers (avoids repetition)
        const createAuthHeaders = () => {
            const myHeaders = new Headers();
            const token = localStorage.getItem("access_token");
            if (token) {
                myHeaders.append("Authorization", `Bearer ${token}`);
            } else {
                console.warn("Access token not found in localStorage.");
            }
            return myHeaders;
        };

        // Fetch Forecast Sales (Revenue)
        async function fetchForecastSales() {
            const requestOptions = { method: "GET", headers: createAuthHeaders() };
            try {
                const response = await fetch("http://localhost:9000/api/forecast_sales", requestOptions);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data: ForecastRevenueData = await response.json(); // Add type
                setForecastSalesData(data);
            } catch (error) {
                console.error("Failed to fetch forecast sales:", error);
                setForecastSalesData(null); // Reset on error
            }
        }

        // Fetch Forecast Sales (Quantity) - Uses Updated Logic
        async function fetchForecastQuantity() {
            const requestOptions = { method: "GET", headers: createAuthHeaders() };
             try {
                const response = await fetch("http://localhost:9000/api/forecast_quantity", requestOptions);
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                // Use the updated API Response interface
                const result: ForecastQuantityApiResponse = await response.json();
                console.log("Fetched Forecast Quantity Data:", result);
                setForecastSalesQuantity(result); // Store the whole response

                // --- Extract keys from the NEW data structure ---
                if (result.future_forecast_by_name && result.future_forecast_by_name.length > 0) {
                    // Get keys from the first data point, exclude 'order_date', ensure they end with '_pred'
                    const itemKeys = Object.keys(result.future_forecast_by_name[0])
                        .filter((key) => key !== 'order_date' && key.endsWith('_pred'));
                    console.log("Extracted Item Keys for Quantity Forecast:", itemKeys);
                    setForecastQuantityItemKeys(itemKeys);
                } else {
                    console.log("No future forecast data found for quantity.");
                    setForecastQuantityItemKeys([]);
                }
            } catch (error) {
                console.error("Failed to fetch forecast quantity:", error);
                setForecastSalesQuantity(null);
                setForecastQuantityItemKeys([]);
            }
        }

        // Fetch Item Sales (for Bar Chart)
        async function fetchItemSales() {
             const requestOptions = { method: "GET", headers: createAuthHeaders() };
             try {
                const response = await fetch("http://localhost:9000/api/actual_quantities?days=30", requestOptions);
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json(); // Define type if known, e.g., { items: ChartItemSalePoint[] }
                const res: ChartItemSalePoint[] = [];
                let sumSales = 0;
                if (data.items && Array.isArray(data.items)) {
                     data.items.forEach((entry: { item_name: string; total_sales: number; }) => {
                         if (typeof entry.total_sales === 'number') {
                             res.push({ name: entry.item_name, sales: entry.total_sales });
                             sumSales += entry.total_sales;
                         } else {
                             console.warn(`Invalid sales data for item ${entry.item_name}:`, entry.total_sales);
                         }
                     });
                }
                setItemSales(res);
                setTotalSales(sumSales);
            } catch (error) {
                console.error("Failed to fetch item sales:", error);
                 setItemSales([]);
                 setTotalSales(0);
            }
        }

        // Fetch Monthly Sales Trend
        async function fetchMonthlySalesTrend() {
            const requestOptions = { method: "GET", headers: createAuthHeaders() };
            try {
                const response = await fetch("http://localhost:9000/api/monthly_sales", requestOptions);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: MonthlySalesApiResponse = await response.json();

                // Transform API data for the chart
                const transformedData: ChartMonthlySalePoint[] = data.monthly_sales.map(apiPoint => ({
                    month: dayjs(apiPoint.month, 'YYYY-MM').format('MMM'), // Parse YYYY-MM -> format MMM
                    sales: apiPoint.total_sales
                }));

                console.log("Fetched and transformed monthly sales:", transformedData);
                setChartMonthlySalesData(transformedData);

            } catch (error) {
                console.error("Failed to fetch or process monthly sales trend:", error);
                setChartMonthlySalesData([]);
            }
          }

        // Call all fetch functions
        fetchForecastSales();
        fetchForecastQuantity();
        fetchItemSales();
        fetchMonthlySalesTrend();

    }, []); // Empty dependency array ensures runs once on mount

    // --- RENDER ---
    return (
      <div>
        <Title order={1} mb="xl">
          Dashboard
        </Title>

        {/* Section 1: Monthly Sales Trend (Unchanged) */}
        <SimpleGrid cols={{ base: 1 }} spacing="xl" mb="xl">
            <Paper shadow="sm" p="md" radius="md" withBorder>
                <Title order={4} mb="md">Monthly Sales Trend</Title>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartMonthlySalesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                         <XAxis dataKey="month" stroke={theme.colors.gray[7]} />
                         <YAxis stroke={theme.colors.gray[7]} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                         <Tooltip
                           contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                           formatter={(value: number) => [`$${value.toLocaleString()}`, "Sales"]}
                         />
                         <Legend />
                         <Line type="monotone" dataKey="sales" name="Monthly Sales" stroke={getThemeColor(theme.primaryColor)} strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </Paper>
        </SimpleGrid>

        {/* Section 2: Item Sales and Recent Sales */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
             <Paper shadow="sm" p="md" radius="md" withBorder>
               <Title order={4} mb="md">Top Item Sales (Last 30 Days)</Title>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={itemSales} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.colors.gray[4]} />
                        <XAxis type="number" stroke={theme.colors.gray[7]} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <YAxis dataKey="name" type="category" width={100} interval={0} stroke={theme.colors.gray[7]} />
                        <Tooltip
                            contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, "Sales"]}
                         />
                        {/* <Legend /> */}
                        <Bar dataKey="sales" name="Total Sales" fill={getThemeColor("green")} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
             </Paper>
             {/* --- RESTORED THIS PART --- */}
             <Paper shadow="sm" p="md" radius="md" withBorder>
                {/* Title might need adjusting if 'totalSales' isn't strictly "This Month" */}
                <Title order={4} mb="md">Last 30 Days' Sales</Title>
                 <Group justify="center" h="80%">
                     {/* Using the structure with the slash and target */}
                     <Text size='40px' ta="center" fw="bold" c="dark">
                         <span style={{ color: totalSales > 60000 ? "#40c057" : "orange" }}> {/* Original color logic */}
                             RM {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </span>/ {/* The slash */}
                         <br />60000.00 {/* The target value */}
                     </Text>
                 </Group>
             </Paper>
             {/* --- END OF RESTORED PART --- */}
        </SimpleGrid>

        {/* Section 3: Forecasting */}
        <Title mb="md" order={2}>Forecasting</Title>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
          {/* Sales Forecast (Revenue) - Unchanged */}
          <Box>
             <Paper shadow="sm" p="md" radius="md" withBorder>
                 <Title order={4} mb="md">Sales Forecast (Revenue)</Title>
                  <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={forecastSalesRevenue?.future_forecast} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                         <XAxis dataKey="forecast_date" tickFormatter={(dateStr) => dayjs(dateStr).isValid() ? dayjs(dateStr).format('YYYY-MM-DD') : ''} stroke={theme.colors.gray[7]} />
                         <YAxis stroke={theme.colors.gray[7]} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                         <Tooltip
                             contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                             formatter={(value: number) => [`$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, "Forecasted Revenue"]}
                             labelFormatter={(label) => dayjs(label).isValid() ? dayjs(label).format("YYYY-MM-DD") : ''}
                         />
                         <Legend />
                         <Line type="monotone" dataKey="forecasted_revenue" name="Revenue" stroke={getThemeColor(theme.primaryColor)} strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4 }} />
                      </LineChart>
                 </ResponsiveContainer>
             </Paper>
          </Box>

          {/* Sales Forecast (Quantity) - Updated */}
          <Box>
             <Paper shadow="sm" p="md" radius="md" withBorder>
               <Title order={4} mb="md">Sales Forecast (Quantity)</Title>
               <ResponsiveContainer width="100%" height={300}>
                 {/* Use the NEW data key from the state */}
                 <LineChart data={forecastSalesQuantity?.future_forecast_by_name} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                     {/* XAxis uses 'order_date' */}
                     <XAxis
                        dataKey="order_date"
                        tickFormatter={(date) => dayjs(date).isValid() ? dayjs(date).format("MM-DD") : ''} // Shorter date format
                        stroke={theme.colors.gray[7]}
                     />
                     <YAxis allowDecimals={false} stroke={theme.colors.gray[7]} /> {/* No decimals for quantity */}
                     <Tooltip
                        labelFormatter={(date) => dayjs(date).isValid() ? dayjs(date).format("YYYY-MM-DD") : ''} // Full date
                        contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                        // Format tooltip payload names and values
                        formatter={(value: number, name: string) => [`${value} units`, name.replace('_pred', '')]} // Cleaned name + units
                     />
                     <Legend />
                     {/* Map over the extracted item name keys */}
                     {forecastQuantityItemKeys?.map((itemKey, index) => (
                         <Line
                             key={itemKey} // Use the unique item key (e.g., "Pancit_Malabon_pred")
                             type="monotone"
                             dataKey={itemKey} // This MUST match the key in the data objects
                             // Set the 'name' prop for a cleaner Legend display
                             name={itemKey.replace('_pred', '')} // Remove '_pred' for Legend
                             stroke={["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#ff00ff", "#00ff00", "#00e0ff"][index % 7]} // Cycle colors
                             dot={false} // Simpler look for forecasts
                             activeDot={{ r: 6 }}
                             strokeWidth={2}
                         />
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