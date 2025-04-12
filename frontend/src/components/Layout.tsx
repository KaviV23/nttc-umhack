import { Outlet, NavLink as RouterNavLink } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink, Text, Button, Title, Box, useMantineTheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks'; // Hook for toggle state
import ChatbotInterface from './ChatbotInterface';

// Define navigation links data
const navLinks = [
  { path: '/', label: 'Dashboard', exact: true },
  { path: '/customers', label: 'Customers' },
  // Add more links here
];

function Layout() {
  // State for mobile navigation burger menu
  const [mobileNavOpened, { toggle: toggleMobileNav }] = useDisclosure();
  // State for the right collapsible sidebar (Aside)
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(false); // Default to closed
  const theme = useMantineTheme();

  // Generate NavLink components for the left sidebar
  const mainLinks = navLinks.map((link) => (
    <NavLink
      key={link.label}
      component={RouterNavLink} // Use React Router's NavLink for routing
      to={link.path}
      end={link.exact} // Match exact path for Home
      label={link.label}
      onClick={() => mobileNavOpened && toggleMobileNav()} // Close mobile nav on click
      // React Router NavLink adds 'active' class, Mantine NavLink uses 'data-active'
      // We might need custom styling or rely on Mantine's active variant if needed
      // Or check active state manually if required:
      // active={location.pathname === link.path} // Requires useLocation hook
    />
  ));

  return (
    <AppShell
      padding="md"
      w="1400px"
      header={{ height: 60 }}
      navbar={{
        width: 250, // Width of the left sidebar
        breakpoint: "sm", // Hide below 'sm' viewport width
        collapsed: { mobile: !mobileNavOpened }, // Control visibility on mobile
      }}
      aside={{
        width: 500, // Width of the right sidebar
        breakpoint: "md", // Hide below 'md' viewport width (optional, can always show)
        collapsed: { desktop: !asideOpened, mobile: true }, // Control visibility based on state
      }}
    >
      {/* Header (Optional but good for mobile nav toggle) */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Box>
            <Burger
              opened={mobileNavOpened}
              onClick={toggleMobileNav}
              hiddenFrom="sm" // Hide burger on larger screens
              size="sm"
            />
            <Title order={3}>Grab Merchant</Title>
          </Box>
          <Box>
            <Button onClick={toggleAside} variant="light">
              {asideOpened ? "Close" : "Open"} Sidebar
            </Button>
          </Box>
          {/* You can add more header content here */}
        </Group>
      </AppShell.Header>

      {/* Left Sidebar (Navbar) */}
      <AppShell.Navbar p="md">
        <Text fw={500} mb="sm">
          Navigation
        </Text>
        {mainLinks}
      </AppShell.Navbar>

      {/* Right Sidebar (Aside) */}
      <AppShell.Aside >
        {/* Content only shows when aside is open */}
        {asideOpened && (
          <Box h="93%">
            <Group
              justify="space-between"
              p="md"
              style={{ borderBottom: `1px solid ${theme.colors.gray[3]}` }}
            >
              <Title order={2}>AI Assistant</Title>
            </Group>
            <ChatbotInterface />
          </Box>
        )}
      </AppShell.Aside>

      {/* Main Content Area */}
      <AppShell.Main >
        {/* React Router outlet renders the current page here */}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

export default Layout;