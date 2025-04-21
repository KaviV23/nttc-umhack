import { useState, useEffect } from 'react';
import {
    Text,
    Paper,
    Title,
    SimpleGrid,
    useMantineTheme,
    Box,
    Group,
    ActionIcon, // Added
    Tooltip,    // Added
    Modal,      // Added
    LoadingOverlay, // Added
    Alert,      // Added
    Loader,      // Added
    Button
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks'; // Added
import { IconInfoCircle, IconAlertCircle } from '@tabler/icons-react'; // Added
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip, // Renamed to avoid conflict
    Legend,
    ResponsiveContainer
} from 'recharts';

// --- Interfaces (Existing) ---

// Monthly Sales
interface ApiMonthlySalePoint {
  month: string;
  total_sales: number;
}
interface MonthlySalesApiResponse {
  merchant_id: string;
  monthly_sales: ApiMonthlySalePoint[];
}
interface ChartMonthlySalePoint {
    month: string;
    sales: number;
}

// Item Sales Bar Chart
interface ChartItemSalePoint {
    name: string;
    sales: number;
}
// API response for Item Sales
interface ItemSalesApiResponse {
    items: { item_name: string; total_sales: number; }[];
    // Add other properties if the API returns more
}

// Revenue Forecast
interface ForecastRevenueDataList {
  forecast_date: string;
  forecasted_revenue: number;
}
interface ForecastRevenueData {
  future_forecast: ForecastRevenueDataList[]
}

// Quantity Forecast
interface ForecastQuantityDataPoint {
  order_date: string;
  [itemNameKey: `${string}_pred`]: number;
}
interface ForecastQuantityApiResponse {
  merchant_id: string;
  forecast_period: string;
  future_forecast_by_name: ForecastQuantityDataPoint[];
}

// --- NEW: Interfaces for AI Insights ---
interface InsightsRequest {
    chart_title: string;
    chart_data: any[]; // Keep flexible
}
interface InsightsResponse {
    insight: string;
}
// --- END NEW ---


// Colors (Keep if used, removed PIE_COLORS as it wasn't used in the provided code)
// const PIE_COLORS = [ ... ];

// --- Dashboard Component ---

function DashboardPage() {
    const theme = useMantineTheme();

    // --- Existing State ---
    const [chartMonthlySalesData, setChartMonthlySalesData] = useState<ChartMonthlySalePoint[]>([]);
    const [itemSales, setItemSales] = useState<ChartItemSalePoint[]>([]);
    const [totalSales, setTotalSales] = useState<number>(0); // For the summary card
    const [forecastSalesRevenue, setForecastSalesData] = useState<ForecastRevenueData | null>(null);
    const [forecastSalesQuantity, setForecastSalesQuantity] = useState<ForecastQuantityApiResponse | null>(null);
    const [forecastQuantityItemKeys, setForecastQuantityItemKeys] = useState<string[]>([]);

    // --- NEW: State for AI Insights Modal ---
    const [
        insightModalOpened,
        { open: openInsightModal, close: closeInsightModal }
    ] = useDisclosure(false);
    const [isInsightLoading, setIsInsightLoading] = useState(false);
    const [insightError, setInsightError] = useState<string | null>(null);
    const [insightContent, setInsightContent] = useState<string | null>(null);
    const [insightChartTitle, setInsightChartTitle] = useState<string>(''); // To show correct title in modal
    // --- END NEW ---

    // --- Loading and Error States for Initial Data Fetch ---
    const [isLoading, setIsLoading] = useState(true); // Combined loading state
    const [fetchError, setFetchError] = useState<string | null>(null); // Combined error state

    const getThemeColor = (colorName: string) => theme.colors[colorName]?.[6] || theme.primaryColor;


    // --- useEffect Hook ---
    useEffect(() => {
        const createAuthHeaders = () => {
            const myHeaders = new Headers();
            const token = localStorage.getItem("access_token");
            myHeaders.append("Content-Type", "application/json"); // Good practice
            if (token) {
                myHeaders.append("Authorization", `Bearer ${token}`);
            } else {
                console.warn("Access token not found.");
                // Potentially set an error state or redirect here
            }
            return myHeaders;
        };

        const fetchAllData = async () => {
            setIsLoading(true);
            setFetchError(null);
            const headers = createAuthHeaders();
            // Check if token exists before proceeding
            if (!headers.has("Authorization")) {
                setFetchError("Authentication token not found. Please log in.");
                setIsLoading(false);
                return;
            }

            const requestOptions = { method: "GET", headers: headers };

            try {
                // Use Promise.allSettled for better error handling if one fetch fails
                const results = await Promise.allSettled([
                    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/monthly_sales`, requestOptions),
                    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/actual_quantities?days=30`, requestOptions),
                    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/forecast_sales`, requestOptions),
                    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/forecast_quantity`, requestOptions)
                ]);

                let encounteredError = false;
                const errors: string[] = [];

                // Process Monthly Sales
                if (results[0].status === 'fulfilled' && results[0].value.ok) {
                    const data: MonthlySalesApiResponse = await results[0].value.json();
                    const transformedData = data.monthly_sales.map(apiPoint => ({
                        month: dayjs(apiPoint.month, 'YYYY-MM').format('MMM'),
                        sales: apiPoint.total_sales
                    }));
                    setChartMonthlySalesData(transformedData);
                } else {
                    encounteredError = true;
                    errors.push(`Monthly Sales: ${results[0].status === 'rejected' ? results[0].reason.message : `HTTP ${results[0].value.status}`}`);
                    setChartMonthlySalesData([]);
                }

                // Process Item Sales
                if (results[1].status === 'fulfilled' && results[1].value.ok) {
                    const data: ItemSalesApiResponse = await results[1].value.json();
                    const res: ChartItemSalePoint[] = [];
                    let sumSales = 0;
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach(entry => {
                            if (typeof entry.total_sales === 'number') {
                                res.push({ name: entry.item_name, sales: entry.total_sales });
                                sumSales += entry.total_sales;
                            }
                        });
                    }
                    setItemSales(res);
                    setTotalSales(sumSales);
                } else {
                    encounteredError = true;
                    errors.push(`Item Sales: ${results[1].status === 'rejected' ? results[1].reason.message : `HTTP ${results[1].value.status}`}`);
                    setItemSales([]);
                    setTotalSales(0);
                }

                // Process Forecast Revenue
                if (results[2].status === 'fulfilled' && results[2].value.ok) {
                    const data: ForecastRevenueData = await results[2].value.json();
                    setForecastSalesData(data);
                } else {
                    encounteredError = true;
                    errors.push(`Forecast Revenue: ${results[2].status === 'rejected' ? results[2].reason.message : `HTTP ${results[2].value.status}`}`);
                    setForecastSalesData(null);
                }

                // Process Forecast Quantity
                if (results[3].status === 'fulfilled' && results[3].value.ok) {
                    const result: ForecastQuantityApiResponse = await results[3].value.json();
                    setForecastSalesQuantity(result);
                    if (result.future_forecast_by_name?.length > 0) {
                        const itemKeys = Object.keys(result.future_forecast_by_name[0])
                            .filter((key) => key !== 'order_date' && key.endsWith('_pred'));
                        setForecastQuantityItemKeys(itemKeys);
                    } else {
                        setForecastQuantityItemKeys([]);
                    }
                } else {
                    encounteredError = true;
                    errors.push(`Forecast Quantity: ${results[3].status === 'rejected' ? results[3].reason.message : `HTTP ${results[3].value.status}`}`);
                    setForecastSalesQuantity(null);
                    setForecastQuantityItemKeys([]);
                }

                if (encounteredError) {
                    setFetchError(`Failed to load some dashboard data: ${errors.join(', ')}`);
                }

            } catch (error: any) {
                console.error("Generic error fetching dashboard data:", error);
                setFetchError(error.message || "An unexpected error occurred while loading dashboard data.");
                // Reset all data states on a major failure
                setChartMonthlySalesData([]);
                setItemSales([]);
                setTotalSales(0);
                setForecastSalesData(null);
                setForecastSalesQuantity(null);
                setForecastQuantityItemKeys([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, []); // Empty dependency array


    // --- NEW: Handler for Generating Insights ---
    const handleGenerateInsights = async (chartTitle: string, chartData: any) => {
        // Basic validation: Check if data exists and is an array with items
        if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) {
            setInsightChartTitle(chartTitle);
            setInsightError(`No data available for "${chartTitle}" to generate insights.`);
            setInsightContent(null);
            setIsInsightLoading(false); // Ensure loading is false even if we don't proceed
            openInsightModal();
            return;
        }

        // Reset state and open modal
        setInsightChartTitle(chartTitle);
        setInsightError(null);
        setInsightContent(null);
        setIsInsightLoading(true);
        openInsightModal();

        // Prepare request body
        const requestBody: InsightsRequest = {
            chart_title: chartTitle,
            // Ensure chartData is an array, handle non-array cases if needed (though charts usually use arrays)
            chart_data: Array.isArray(chartData) ? chartData : [chartData]
        };

        // Make API call
        try {
            const token = localStorage.getItem("access_token");
            if (!token) {
                throw new Error("Authentication token not found.");
            }

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/generate_insights`,
                {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `bearer ${token}`,
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            if (!response.ok) {
                let errorDetail = `Request failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch { /* Ignore if response body isn't JSON */ }
                throw new Error(`Failed to generate insights: ${errorDetail}`);
            }

            const result: InsightsResponse = await response.json();
            setInsightContent(result.insight);

        } catch (e: any) {
            console.error(`Failed to generate insights for ${chartTitle}:`, e);
            setInsightError(e.message || "An unexpected error occurred.");
        } finally {
            setIsInsightLoading(false);
        }
    };
    // --- END NEW ---


    // --- RENDER ---
    return (
      <div>
        <Title order={1} mb="xl">
          Dashboard
        </Title>

        {/* Display global loading or error */}
        {isLoading && (
            <Group justify="center" my="xl">
                <Loader />
                <Text>Loading dashboard data...</Text>
            </Group>
        )}
        {fetchError && !isLoading && (
            <Alert title="Data Loading Error" color="red" icon={<IconAlertCircle />} mb="xl" withCloseButton onClose={() => setFetchError(null)}>
                {fetchError}
            </Alert>
        )}

        {!isLoading && !fetchError && (
            <>
                {/* Section 1: Monthly Sales Trend */}
                <SimpleGrid cols={{ base: 1 }} spacing="xl" mb="xl">
                    <Paper shadow="sm" p="md" radius="md" withBorder>
                        <Group justify="space-between" align="center" mb="md">
                            <Title order={4}>Monthly Sales Trend</Title>
                            <Tooltip label="Get AI Insights" withArrow position="left">
                                <ActionIcon
                                    variant="subtle"
                                    onClick={() => handleGenerateInsights("Monthly Sales Trend", chartMonthlySalesData)}
                                    disabled={isInsightLoading || !chartMonthlySalesData || chartMonthlySalesData.length === 0}
                                    loading={isInsightLoading}
                                    aria-label="Generate insights for Monthly Sales Trend"
                                >
                                    <IconInfoCircle size={20} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                        {chartMonthlySalesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={chartMonthlySalesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                                    <XAxis dataKey="month" stroke={theme.colors.gray[7]} />
                                    <YAxis stroke={theme.colors.gray[7]} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Sales"]}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="sales" name="Monthly Sales" stroke={getThemeColor(theme.primaryColor)} strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                         ) : (
                            <Text c="dimmed" ta="center" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No monthly sales data available.</Text>
                         )}
                    </Paper>
                </SimpleGrid>

                {/* Section 2: Item Sales and Total Sales Summary */}
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
                    <Paper shadow="sm" p="md" radius="md" withBorder>
                        <Group justify="space-between" align="center" mb="md">
                             <Title order={4}>Top Item Sales (Last 30 Days)</Title>
                             <Tooltip label="Get AI Insights" withArrow position="left">
                                 <ActionIcon
                                     variant="subtle"
                                     onClick={() => handleGenerateInsights("Top Item Sales (Last 30 Days)", itemSales)}
                                     disabled={isInsightLoading || !itemSales || itemSales.length === 0}
                                     loading={isInsightLoading}
                                     aria-label="Generate insights for Top Item Sales"
                                 >
                                     <IconInfoCircle size={20} />
                                 </ActionIcon>
                             </Tooltip>
                         </Group>
                         {itemSales.length > 0 ? (
                             <ResponsiveContainer width="100%" height={300}>
                                 <BarChart data={itemSales} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.colors.gray[4]} />
                                     <XAxis type="number" stroke={theme.colors.gray[7]} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                     <YAxis dataKey="name" type="category" width={100} interval={0} stroke={theme.colors.gray[7]} />
                                     <RechartsTooltip
                                         contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                                         formatter={(value: number) => [`$${value.toLocaleString()}`, "Sales"]}
                                     />
                                     <Bar dataKey="sales" name="Total Sales" fill={getThemeColor("green")} radius={[0, 4, 4, 0]} />
                                 </BarChart>
                             </ResponsiveContainer>
                         ) : (
                            <Text c="dimmed" ta="center" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No item sales data available for the last 30 days.</Text>
                         )}
                    </Paper>
                    {/* Total Sales Card - Generally no insight button here as it's a single number */}
                    <Paper shadow="sm" p="md" radius="md" withBorder>
                        <Title order={4} mb="md">Last 30 Days' Sales Summary</Title>
                        <Group justify="center" h="80%" align="center">
                            <Text size='40px' ta="center" fw="bold" c="dark">
                                <span style={{ color: totalSales > 60000 ? getThemeColor('green') : getThemeColor('orange') }}>
                                    RM {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {/* You might want the target to be dynamic or configurable */}
                                <Text size="sm" c="dimmed">/ RM 60,000.00 target</Text>
                            </Text>
                        </Group>
                    </Paper>
                </SimpleGrid>

                {/* Section 3: Forecasting */}
                <Title mb="md" order={2}>Forecasting</Title>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
                    {/* Sales Forecast (Revenue) */}
                    <Paper shadow="sm" p="md" radius="md" withBorder>
                         <Group justify="space-between" align="center" mb="md">
                              <Title order={4}>Sales Forecast (Revenue)</Title>
                              <Tooltip label="Get AI Insights" withArrow position="left">
                                  <ActionIcon
                                      variant="subtle"
                                      onClick={() => handleGenerateInsights("Sales Forecast (Revenue)", forecastSalesRevenue?.future_forecast)}
                                      // Disable if loading, no data object, or empty forecast array
                                      disabled={isInsightLoading || !forecastSalesRevenue?.future_forecast || forecastSalesRevenue.future_forecast.length === 0}
                                      loading={isInsightLoading}
                                      aria-label="Generate insights for Sales Forecast (Revenue)"
                                  >
                                      <IconInfoCircle size={20} />
                                  </ActionIcon>
                              </Tooltip>
                          </Group>
                          {forecastSalesRevenue?.future_forecast && forecastSalesRevenue.future_forecast.length > 0 ? (
                             <ResponsiveContainer width="100%" height={300}>
                                 <LineChart data={forecastSalesRevenue.future_forecast} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                                     <XAxis dataKey="forecast_date" tickFormatter={(dateStr) => dayjs(dateStr).isValid() ? dayjs(dateStr).format('MM-DD') : ''} stroke={theme.colors.gray[7]} />
                                     <YAxis stroke={theme.colors.gray[7]} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                     <RechartsTooltip
                                         contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                                         formatter={(value: number) => [`$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, "Forecasted Revenue"]}
                                         labelFormatter={(label) => dayjs(label).isValid() ? dayjs(label).format("YYYY-MM-DD") : ''}
                                     />
                                     <Legend />
                                     <Line type="monotone" dataKey="forecasted_revenue" name="Revenue" stroke={getThemeColor(theme.primaryColor)} strokeWidth={2} activeDot={{ r: 8 }} dot={{ r: 4 }} />
                                 </LineChart>
                             </ResponsiveContainer>
                          ) : (
                             <Text c="dimmed" ta="center" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No revenue forecast data available.</Text>
                          )}
                    </Paper>

                    {/* Sales Forecast (Quantity) */}
                    <Paper shadow="sm" p="md" radius="md" withBorder>
                        <Group justify="space-between" align="center" mb="md">
                             <Title order={4}>Sales Forecast (Quantity)</Title>
                             <Tooltip label="Get AI Insights" withArrow position="left">
                                 <ActionIcon
                                     variant="subtle"
                                     onClick={() => handleGenerateInsights("Sales Forecast (Quantity)", forecastSalesQuantity?.future_forecast_by_name)}
                                     // Disable if loading, no data object, or empty forecast array
                                     disabled={isInsightLoading || !forecastSalesQuantity?.future_forecast_by_name || forecastSalesQuantity.future_forecast_by_name.length === 0}
                                     loading={isInsightLoading}
                                     aria-label="Generate insights for Sales Forecast (Quantity)"
                                 >
                                     <IconInfoCircle size={20} />
                                 </ActionIcon>
                             </Tooltip>
                         </Group>
                         {forecastSalesQuantity?.future_forecast_by_name && forecastSalesQuantity.future_forecast_by_name.length > 0 && forecastQuantityItemKeys.length > 0 ? (
                             <ResponsiveContainer width="100%" height={300}>
                                 <LineChart data={forecastSalesQuantity.future_forecast_by_name} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.colors.gray[4]} />
                                     <XAxis dataKey="order_date" tickFormatter={(date) => dayjs(date).isValid() ? dayjs(date).format("MM-DD") : ''} stroke={theme.colors.gray[7]} />
                                     <YAxis allowDecimals={false} stroke={theme.colors.gray[7]} />
                                     <RechartsTooltip
                                         labelFormatter={(date) => dayjs(date).isValid() ? dayjs(date).format("YYYY-MM-DD") : ''}
                                         contentStyle={{ backgroundColor: theme.white, borderColor: theme.colors.gray[4], borderRadius: theme.radius.sm }}
                                         formatter={(value: number, name: string) => [`${Math.round(value)} units`, name.replace('_pred', '')]} // Round units
                                     />
                                     <Legend />
                                     {forecastQuantityItemKeys.map((itemKey, index) => (
                                         <Line
                                             key={itemKey}
                                             type="monotone"
                                             dataKey={itemKey}
                                             name={itemKey.replace('_pred', '')}
                                             stroke={["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#ff00ff", "#00ff00", "#00e0ff"][index % 7]}
                                             dot={false}
                                             activeDot={{ r: 6 }}
                                             strokeWidth={2}
                                         />
                                     ))}
                                 </LineChart>
                             </ResponsiveContainer>
                         ) : (
                             <Text c="dimmed" ta="center" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No quantity forecast data available.</Text>
                         )}
                    </Paper>
                </SimpleGrid>
            </>
        )}

        {/* --- NEW: AI Insights Modal --- */}
        <Modal
            opened={insightModalOpened}
            onClose={closeInsightModal}
            title={`AI Insights: ${insightChartTitle}`} // Dynamic title
            centered
            size="lg"
        >
            <Box pos="relative" mih={150}>
                <LoadingOverlay
                    visible={isInsightLoading}
                    zIndex={1000}
                    overlayProps={{ radius: "sm", blur: 2 }}
                    loaderProps={{ children: <Loader /> }}
                />
                {insightError && (
                    <Alert title="Insight Error" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setInsightError(null)}>
                        {insightError}
                    </Alert>
                )}
                {!isInsightLoading && !insightError && insightContent && (
                    // Use pre-wrap to respect newlines from the backend
                    <Text style={{ whiteSpace: 'pre-wrap' }}>
                        {insightContent}
                    </Text>
                )}
                {/* Optional: Message if loaded successfully but no content */}
                {!isInsightLoading && !insightError && !insightContent && (
                    <Text c="dimmed" ta="center">No insights were generated for this data.</Text>
                )}
                {/* Message when the modal is opened due to no data */}
                 {!isInsightLoading && insightError?.startsWith('No data available') && !insightContent && (
                     <Text c="dimmed" ta="center">{insightError}</Text>
                 )}
            </Box>
            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeInsightModal}>
                    Close
                </Button>
            </Group>
        </Modal>
        {/* --- END NEW --- */}

      </div>
    );
}

export default DashboardPage;
