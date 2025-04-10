import { Paper, Text, Space, Title } from '@mantine/core';

function HomePage() {
  return (
    <Paper shadow="xs" p="xl" radius="md">
      <Title order={1}>Home Page</Title>
      <Space h="md" /> {/* Add vertical space */}
      <Text>Welcome to the application!</Text>
      <Text c="dimmed" size="sm">This is the main content area, now using Mantine components.</Text>
    </Paper>
  );
}

export default HomePage;