import {
  Text,
  Paper,
  Title,
  SimpleGrid,
  useMantineTheme,
  Box,
  Group,
  Modal,
  ActionIcon,
  Loader,
} from "@mantine/core"; // Loader is already imported
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

import { useEffect, useState } from "react";
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
  ResponsiveContainer,
} from "recharts";
import { IconInfoCircle } from "@tabler/icons-react";

// --- Interfaces (Keep as they are) ---
// ... (all existing interfaces remain unchanged) ...
interface ApiMonthlySalePoint {
  month: string; // Format: YYYY-MM
  total_sales: number;
}
interface MonthlySalesApiResponse {
  merchant_id: string;
  monthly_sales: ApiMonthlySalePoint[];
}
interface ChartMonthlySalePoint {
  month: string; // Format: 'MMM' (e.g., 'Jan') for display
  sales: number;
}
interface ChartItemSalePoint {
  name: string;
  sales: number;
}
interface ForecastRevenueDataList {
  forecast_date: string;
  forecasted_revenue: number;
}
interface ForecastRevenueData {
  future_forecast: ForecastRevenueDataList[];
}
interface ForecastQuantityDataList {
  forecast_date: Date;
  forecasted_revenue: number;
}
interface ForecastQuantityHistoryList {
  order_date: string;
  [itemName: `${string}_pred` | `${string}_actual`]: number;
}
interface ForecastQuantityGraphList {
  order_date: string;
  [itemKey: `item_${number}_${"pred" | "actual"}`]: number;
}
interface ForecastQuantityData {
  historical_evaluation: ForecastQuantityHistoryList[];
  future_forecast: ForecastQuantityDataList[];
  graph_forecast_ids: ForecastQuantityGraphList[];
}

// --- Dashboard Component ---

function DashboardPage() {
  const theme = useMantineTheme();
  // Existing state variables
  const [forecastSalesRevenue, setForecastSalesData] =
    useState<ForecastRevenueData | null>(null);
  const [forecastSalesQuantity, setForecastSalesQuantity] =
    useState<ForecastQuantityData | null>(null);
  const [forecastSalesQuantityKeys, setForecastSalesQuantityKeys] =
    useState<string[]>();
  const [itemSales, setItemSales] = useState<ChartItemSalePoint[]>([]);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [chartMonthlySalesData, setChartMonthlySalesData] = useState<
    ChartMonthlySalePoint[]
  >([]);

  // *** STATE FOR INSIGHTS MODAL ***
  const [isInsightModalOpen, setInsightModalOpen] = useState(false);
  const [insightModalData, setInsightModalData] = useState<any[] | null>(null); // Keep for potential debug display
  const [insightModalTitle, setInsightModalTitle] = useState<string>("");
  // *** STATE FOR LLM INSIGHTS ***
  const [insightText, setInsightText] = useState<string>("");
  const [isInsightLoading, setIsInsightLoading] = useState<boolean>(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const getThemeColor = (colorName: string) =>
    theme.colors[colorName]?.[6] || theme.primaryColor;

  // --- *** MODIFIED: API Call Function to Backend *** ---
  async function generateAndSetInsights(data: any[], chartTitle: string) {
    setIsInsightLoading(true);
    setInsightText(""); // Clear previous insights
    setInsightError(null); // Clear previous errors

    // 1. Get Authentication Token
    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error(
        "Authentication token not found. Cannot generate insights."
      );
      setInsightError("Authentication required. Please log in again.");
      setIsInsightLoading(false);
      return; // Stop if not authenticated
    }

    // 2. Define Backend Endpoint URL
    const BACKEND_INSIGHTS_ENDPOINT =
      "http://localhost:9000/api/generate_insights"; // Adjust if your backend URL/port is different

    // 3. Prepare Request Body (Matches backend InsightsRequest schema)
    const requestBody = {
      chart_title: chartTitle,
      chart_data: data,
    };

    try {
      // 4. Make the fetch call to YOUR backend
      const response = await fetch(BACKEND_INSIGHTS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Include the JWT token for backend authentication
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody), // Send the data in the format the backend expects
      });

      // 5. Handle Response
      if (!response.ok) {
        // Try to parse error details from backend response
        let errorDetail = `Backend Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail; // Use detail from backend if available
        } catch (parseError) {
          // Could not parse JSON, stick with status text
          console.warn("Could not parse error response JSON from backend.");
        }
        throw new Error(errorDetail);
      }

      // 6. Process Successful Response (Matches backend response format)
      const result = await response.json();
      const generatedInsight = result.insight; // Extract the 'insight' field

      if (generatedInsight) {
        setInsightText(generatedInsight);
      } else {
        console.error("Backend response missing 'insight' field:", result);
        setInsightText(
          "Received an unexpected response structure from the backend."
        );
        setInsightError("Could not extract insight from the backend response.");
      }
    } catch (error: any) {
      console.error("Error fetching insights from backend:", error);
      setInsightError(
        error.message || "An unknown error occurred while fetching insights."
      );
      setInsightText(""); // Clear any potentially stale text
    } finally {
      setIsInsightLoading(false); // Ensure loading indicator stops
    }
  }

  // --- Modal Handler Functions ---
  // (openInsightModal and closeInsightModal remain unchanged from the previous version)
  const openInsightModal = (title: string, data: any[] | null | undefined) => {
    const dataToShow = Array.isArray(data) ? data : null;
    console.log(`Opening insights for: ${title}`);
    console.log("Data passed to modal:", dataToShow);

    setInsightModalTitle(title);
    setInsightModalData(dataToShow);
    setInsightModalOpen(true);

    // --- Trigger AI Insight Generation via Backend ---
    if (dataToShow && dataToShow.length > 0) {
      setInsightText("");
      setIsInsightLoading(true);
      setInsightError(null);
      generateAndSetInsights(dataToShow, title); // Calls the updated function
    } else {
      console.log("No data available to generate insights.");
      setInsightText("No data available for insights.");
      setIsInsightLoading(false);
      setInsightError(null);
    }
  };

  const closeInsightModal = () => {
    setInsightModalOpen(false);
    setInsightModalData(null);
    setInsightModalTitle("");
    setInsightText("");
    setIsInsightLoading(false);
    setInsightError(null);
  };

  useEffect(() => {
    // ... (Keep all existing fetch functions for chart data as they are) ...
    // Function to create headers (avoids repetition)
    const createAuthHeaders = () => {
      const myHeaders = new Headers();
      const token = localStorage.getItem("access_token");
      if (token) {
        myHeaders.append("Authorization", `Bearer ${token}`); // Use Bearer prefix
      } else {
        console.warn("Access token not found in localStorage.");
      }
      return myHeaders;
    };

    // Fetch Forecast Sales (Revenue)
    async function fetchForecastSales() {
      const requestOptions = { method: "GET", headers: createAuthHeaders() };
      try {
        const response = await fetch(
          "http://localhost:9000/api/forecast_sales",
          requestOptions
        );
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setForecastSalesData(data);
      } catch (error) {
        console.error("Failed to fetch forecast sales:", error);
      }
    }

    // Fetch Forecast Sales (Quantity)
    async function fetchForecastQuantity() {
      const requestOptions = { method: "GET", headers: createAuthHeaders() };
      try {
        const response = await fetch(
          "http://localhost:9000/api/forecast_quantity",
          requestOptions
        );
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        setForecastSalesQuantity(result);
        if (result.graph_forecast_ids && result.graph_forecast_ids.length > 0) {
          setForecastSalesQuantityKeys(
            Object.keys(result.graph_forecast_ids[0]).filter(
              (key) => key !== "order_date" && !key.includes("actual")
            )
          );
        } else {
          setForecastSalesQuantityKeys([]);
        }
      } catch (error) {
        console.error("Failed to fetch forecast quantity:", error);
      }
    }

    // Fetch Item Sales (for Bar Chart)
    async function fetchItemSales() {
      const requestOptions = { method: "GET", headers: createAuthHeaders() };
      try {
        const response = await fetch(
          "http://localhost:9000/api/actual_quantities?days=30",
          requestOptions
        );
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const res: ChartItemSalePoint[] = [];
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(
            (entry: { item_name: string; total_sales: number }) => {
              if (typeof entry.total_sales === "number") {
                res.push({
                  name: entry.item_name,
                  sales: entry.total_sales,
                });
              } else {
                console.warn(
                  `Invalid sales data for item ${entry.item_name}:`,
                  entry.total_sales
                );
              }
            }
          );
        }
        setItemSales(res);
        let sumSales = 0;
        res.forEach((item) => {
          sumSales += item.sales;
        });
        setTotalSales(sumSales);
      } catch (error) {
        console.error("Failed to fetch item sales:", error);
      }
    }

    // Fetch Monthly Sales Trend
    async function fetchMonthlySalesTrend() {
      const requestOptions = { method: "GET", headers: createAuthHeaders() };
      try {
        const response = await fetch(
          "http://localhost:9000/api/monthly_sales",
          requestOptions
        );
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data: MonthlySalesApiResponse = await response.json();
        const transformedData: ChartMonthlySalePoint[] = data.monthly_sales.map(
          (apiPoint) => ({
            month: dayjs(apiPoint.month, "YYYY-MM").format("MMM"),
            sales: apiPoint.total_sales,
          })
        );
        setChartMonthlySalesData(transformedData);
      } catch (error) {
        console.error("Failed to fetch or process monthly sales trend:", error);
        setChartMonthlySalesData([]);
      }
    }

    fetchForecastSales();
    fetchForecastQuantity();
    fetchItemSales();
    fetchMonthlySalesTrend();
  }, []); // Empty dependency array

  // --- RENDER ---
  // (The JSX structure below remains unchanged from the previous version)
  return (
    <div>
      <Title order={1} mb="xl">
        Dashboard
      </Title>

      {/* Section 1: Monthly Sales Trend */}
      <SimpleGrid cols={{ base: 1 }} spacing="xl" mb="xl">
        <Paper
          shadow="sm"
          p="md"
          radius="md"
          withBorder
          style={{ position: "relative" }}
        >
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            onClick={() =>
              openInsightModal("Monthly Sales Trend", chartMonthlySalesData)
            }
            style={{
              position: "absolute",
              top: theme.spacing.sm,
              right: theme.spacing.sm,
              zIndex: 1,
            }}
            title="Get AI Insights"
          >
            <IconInfoCircle size={18} />
          </ActionIcon>
          <Title order={4} mb="md" pr="lg">
            Monthly Sales Trend
          </Title>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartMonthlySalesData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={theme.colors.gray[4]}
              />
              <XAxis dataKey="month" stroke={theme.colors.gray[7]} />
              <YAxis stroke={theme.colors.gray[7]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.white,
                  borderColor: theme.colors.gray[4],
                  borderRadius: theme.radius.sm,
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString()}`,
                  "Sales",
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sales"
                stroke={getThemeColor(theme.primaryColor)}
                strokeWidth={2}
                activeDot={{ r: 8 }}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </SimpleGrid>

      {/* Section 2: Item Sales and This Month */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
        {/* Bar Chart - Uses 'itemSales' state */}
        <Paper
          shadow="sm"
          p="md"
          radius="md"
          withBorder
          style={{ position: "relative" }}
        >
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            onClick={() =>
              openInsightModal("Top Item Sales (Last 30 Days)", itemSales)
            }
            style={{
              position: "absolute",
              top: theme.spacing.sm,
              right: theme.spacing.sm,
              zIndex: 1,
            }}
            title="Get AI Insights"
          >
            <IconInfoCircle size={18} />
          </ActionIcon>
          <Title order={4} mb="md" pr="lg">
            Top Item Sales (Last 30 Days)
          </Title>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={itemSales}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke={theme.colors.gray[4]}
              />
              <XAxis type="number" stroke={theme.colors.gray[7]} />
              <YAxis
                dataKey="name"
                type="category"
                width={80}
                stroke={theme.colors.gray[7]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.white,
                  borderColor: theme.colors.gray[4],
                  borderRadius: theme.radius.sm,
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString()}`,
                  "Sales",
                ]}
              />
              <Legend />
              <Bar
                dataKey="sales"
                fill={getThemeColor("green")}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Paper>

        {/* This Month's Sales */}
        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={4} mb="md">
            This Month's Sales
          </Title>
          <Group justify="center" h="80%">
            <Text size="48px" ta="center" fw="bold" c="dark">
              <span
                style={{ color: totalSales > 60000 ? "#40c057" : "orange" }}
              >
                RM {totalSales.toLocaleString()}
              </span>
              /<br />
              60000.00
            </Text>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Section 3: Forecasting */}
      <Title mb="md" order={2}>
        Forecasting
      </Title>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
        {/* Sales Forecast (Revenue) */}
        <Box>
          <Paper
            shadow="sm"
            p="md"
            radius="md"
            withBorder
            style={{ position: "relative" }}
          >
            <ActionIcon
              variant="subtle"
              color="blue"
              size="sm"
              onClick={() =>
                openInsightModal(
                  "Sales Forecast (Revenue)",
                  forecastSalesRevenue?.future_forecast ?? null
                )
              }
              style={{
                position: "absolute",
                top: theme.spacing.sm,
                right: theme.spacing.sm,
                zIndex: 1,
              }}
              title="Get AI Insights"
            >
              <IconInfoCircle size={18} />
            </ActionIcon>
            <Title order={4} mb="md" pr="lg">
              Sales Forecast (Revenue)
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={forecastSalesRevenue?.future_forecast}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={theme.colors.gray[4]}
                />
                <XAxis
                  dataKey="forecast_date"
                  tickFormatter={(dateStr) =>
                    dayjs(dateStr).isValid()
                      ? dayjs(dateStr).format("YYYY-MM")
                      : ""
                  }
                  stroke={theme.colors.gray[7]}
                />
                <YAxis stroke={theme.colors.gray[7]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.white,
                    borderColor: theme.colors.gray[4],
                    borderRadius: theme.radius.sm,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="forecasted_revenue"
                  stroke={getThemeColor(theme.primaryColor)}
                  strokeWidth={2}
                  activeDot={{ r: 8 }}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Box>
        {/* Sales Forecast (Quantity) */}
        <Box>
          <Paper
            shadow="sm"
            p="md"
            radius="md"
            withBorder
            style={{ position: "relative" }}
          >
            <ActionIcon
              variant="subtle"
              color="blue"
              size="sm"
              onClick={() =>
                openInsightModal(
                  "Sales Forecast (Quantity)",
                  forecastSalesQuantity?.graph_forecast_ids ?? null
                )
              }
              style={{
                position: "absolute",
                top: theme.spacing.sm,
                right: theme.spacing.sm,
                zIndex: 1,
              }}
              title="Get AI Insights"
            >
              <IconInfoCircle size={18} />
            </ActionIcon>
            <Title order={4} mb="md" pr="lg">
              Sales Forecast (Quantity)
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={forecastSalesQuantity?.graph_forecast_ids}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={theme.colors.gray[4]}
                />
                <XAxis
                  dataKey="order_date"
                  tickFormatter={(date) =>
                    dayjs(date).isValid()
                      ? dayjs(date).format("YYYY-MM-DD")
                      : ""
                  }
                  stroke={theme.colors.gray[7]}
                />
                <YAxis stroke={theme.colors.gray[7]} />
                <Tooltip
                  labelFormatter={(date) =>
                    dayjs(date).isValid()
                      ? dayjs(date).format("YYYY-MM-DD")
                      : ""
                  }
                />
                <Legend />
                {forecastSalesQuantityKeys?.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={
                      ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"][index % 4]
                    }
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Box>
      </SimpleGrid>

      {/* --- Insights Modal --- */}
      {/* (The Modal JSX remains unchanged - it correctly displays loading/error/text state) */}
      <Modal
        opened={isInsightModalOpen}
        onClose={closeInsightModal}
        title={<Title order={4}>{insightModalTitle}</Title>}
        size="lg"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        closeOnClickOutside={!isInsightLoading}
        closeOnEscape={!isInsightLoading}
      >
        <Text fw={500} mb="sm">
          AI Insights:
        </Text>
        <Paper
          withBorder
          p="sm"
          mb="md"
          bg={
            theme.colorScheme === "dark"
              ? theme.colors.dark[6]
              : theme.colors.gray[0]
          }
          style={{
            minHeight: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isInsightLoading ? (
            <Group>
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Generating insights...
              </Text>
            </Group>
          ) : insightError ? (
            <Text size="sm" c="red" style={{ whiteSpace: "pre-wrap" }}>
              {/* Display the error message from the state */}
              {insightError}
            </Text>
          ) : (
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {insightText || "No insights generated yet."}
            </Text>
          )}
        </Paper>
      </Modal>
    </div>
  );
}

export default DashboardPage;
