import { Paper, Title, SimpleGrid, useMantineTheme, Box } from '@mantine/core';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer // Important for responsiveness!
} from 'recharts';

// --- Dummy Data ---

// 1. Sales Over Time (e.g., last 6 months)
const monthlySalesData = [
    { month: 'Jan', sales: 4000 },
    { month: 'Feb', sales: 3000 },
    { month: 'Mar', sales: 5000 },
    { month: 'Apr', sales: 4500 },
    { month: 'May', sales: 6000 },
    { month: 'Jun', sales: 5800 },
];

// 2. Sales by Product Category
const categorySalesData = [
    { name: 'Food 1', sales: 12500 },
    { name: 'Food 2', sales: 8800 },
    { name: 'Food 3', sales: 7200 },
    { name: 'Food 4', sales: 5500 },
    { name: 'Food 5', sales: 3100 },
];

// 3. Top Performing Merchants
const merchantSalesData = [
    { merchant: 'Cuisine A', sales: 9800 },
    { merchant: 'Cuisine B', sales: 7500 },
    { merchant: 'Cuisine C', sales: 6900 },
    { merchant: 'Cuisine D', sales: 5200 },
    { merchant: 'Cuisine E', sales: 4100 },
];

interface ForecastRevenueDataList {
  forecast_date: string;
  forecasted_revenue: number;
}

interface ForecastRevenueData {
  future_forecast: ForecastRevenueDataList[]
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
  [itemKey: `item_${number}_${'pred' | 'actual'}`]: number;
}

interface ForecastQuantityData {
  historical_evaluation: ForecastQuantityHistoryList[]
  future_forecast: ForecastQuantityDataList[]
  graph_forecast_ids: ForecastQuantityGraphList[]
}




// Colors for Pie Chart Slices (using Mantine theme colors)
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
    const [forecastSalesRevenue, setForecastSalesData] = useState<ForecastRevenueData | null>(null)
    const [forecastSalesQuantity, setForecastSalesQuantity] = useState<ForecastQuantityData | null>(null)
    const [forecastSalesQuantityKeys, setForecastSalesQuantityKeys] = useState<string[]>()

    // Get Mantine theme colors for charts
    const getThemeColor = (colorName: string) => theme.colors[colorName]?.[6] || theme.primaryColor;

    // Generate colors array for Pie chart using Mantine theme
    const pieChartColors = PIE_COLORS.map(colorName => getThemeColor(colorName));

    useEffect(() => {
      async function fetchForecastSales() {
        const myHeaders = new Headers();
        myHeaders.append(
          "Authorization",
          `bearer ${localStorage.getItem("access_token")}`
        );

        const requestOptions = {
          method: "GET",
          headers: myHeaders,
        };

        await fetch("http://localhost:9000/api/forecast_sales", requestOptions)
          .then(async (response) => {
            const data = await response.json();
            setForecastSalesData(data);
          })
      } 
      fetchForecastSales();
      
      async function fetchForecastQuantity() {
        const myHeaders = new Headers();
        myHeaders.append(
          "Authorization",
          `bearer ${localStorage.getItem("access_token")}`
        );

        const requestOptions = {
          method: "GET",
          headers: myHeaders,
        };

        await fetch("http://localhost:9000/api/forecast_quantity", requestOptions)
          .then(async (response) => {
            response.json().then((result) => {
              setForecastSalesQuantity(result);
              setForecastSalesQuantityKeys(
                Object.keys(result.graph_forecast_ids[0]).filter((key) => key !== "order_date" && !key.includes("actual"))
              );
            });
          })
      }
      fetchForecastQuantity();
    }, [])

    return (
      <div>
        <Title order={1} mb="xl">
          Dashboard
        </Title>

        <SimpleGrid
          cols={{ base: 1, md: 1 }} // 1 column on small screens, 2 on medium and up
          spacing="xl"
          mb="xl"
        >
          {/* Chart 1: Sales Over Time (Line Chart) */}
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={4} mb="md">
              Monthly Sales Trend
            </Title>
            {/* ResponsiveContainer makes the chart adapt to parent size */}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={monthlySalesData}
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
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke={getThemeColor(theme.primaryColor)} // Use theme's primary color
                  strokeWidth={2}
                  activeDot={{ r: 8 }}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </SimpleGrid>

        <SimpleGrid
          cols={{ base: 1, md: 2 }} // 1 column on small screens, 2 on medium and up
          spacing="xl"
          mb="xl"
        >
          {/* Chart 2: Sales by Category (Bar Chart) */}
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={4} mb="md">
              Sales by Category
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={categorySalesData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                layout="vertical" // Makes bars horizontal
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke={theme.colors.gray[4]}
                />
                {/* Swapped X/Y Axes for vertical layout */}
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
                  ]} // Format tooltip value
                />
                <Legend />
                <Bar
                  dataKey="sales"
                  fill={getThemeColor("teal")}
                  radius={[0, 4, 4, 0]}
                />{" "}
                {/* Rounded corners */}
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          {/* Chart 3: Top Performing Merchants (Pie Chart) */}
          <Paper shadow="sm" p="md" radius="md" withBorder>
            <Title order={4} mb="md">
              Top Cuisine Categories
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={merchantSalesData}
                  cx="50%" // Center X
                  cy="50%" // Center Y
                  labelLine={false}
                  // label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} // Example label inside slice
                  outerRadius={100} // Size of the pie
                  fill="#8884d8"
                  dataKey="sales"
                  nameKey="merchant"
                >
                  {merchantSalesData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={pieChartColors[index % pieChartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.white,
                    borderColor: theme.colors.gray[4],
                    borderRadius: theme.radius.sm,
                  }}
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString()}`,
                    name,
                  ]}
                />
                <Legend align="center" verticalAlign="bottom" />{" "}
                {/* Position legend */}
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </SimpleGrid>
        <Title mb="md" order={2}>Forecasting</Title>
        <SimpleGrid
          cols={{ base: 1, md: 2 }} // 1 column on small screens, 2 on medium and up
          spacing="xl"
          mb="xl"
        >
          <Box>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Title order={4} mb="md">
                Sales Forecast (Revenue)
              </Title>
              {/* ResponsiveContainer makes the chart adapt to parent size */}
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
                  <XAxis dataKey="forecast_date" tickFormatter={(dateStr) => dayjs(dateStr).format('YYYY-MM')} stroke={theme.colors.gray[7]} />
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
                    stroke={getThemeColor(theme.primaryColor)} // Use theme's primary color
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Box>
          <Box>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Title order={4} mb="md">
                Sales Forecast (Quantity)
              </Title>
              {/* ResponsiveContainer makes the chart adapt to parent size */}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={forecastSalesQuantity?.graph_forecast_ids}>
                  <XAxis
                    dataKey="order_date"
                    tickFormatter={(date) => dayjs(date).format("YYYY-MM-DD")}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) => dayjs(date).format("YYYY-MM-DD")}
                  />
                  <Legend />

                  {forecastSalesQuantityKeys ? forecastSalesQuantityKeys.map((key, index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={["#8884d8", "#82ca9d", "#ffc658", "#ff7300"][index % 4]}
                      dot={false}
                    />
                  )): null}
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Box>
        </SimpleGrid>
      </div>
    );
}

export default DashboardPage;