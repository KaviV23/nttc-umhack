import { Outlet, NavLink as RouterNavLink } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink, Text, Button, Title, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks'; // Hook for toggle state

// Define navigation links data
const navLinks = [
  { path: '/', label: 'Home', exact: true },
  { path: '/about', label: 'About' },
  { path: '/settings', label: 'Settings' },
  // Add more links here
];

function Layout() {
  // State for mobile navigation burger menu
  const [mobileNavOpened, { toggle: toggleMobileNav }] = useDisclosure();
  // State for the right collapsible sidebar (Aside)
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(true); // Default to open

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
      header={{ height: 60 }}
      navbar={{
        width: 250, // Width of the left sidebar
        breakpoint: "sm", // Hide below 'sm' viewport width
        collapsed: { mobile: !mobileNavOpened }, // Control visibility on mobile
      }}
      aside={{
        width: 280, // Width of the right sidebar
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
            <Title order={3}>My App</Title>
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
      <AppShell.Aside p="md">
        <Group justify="space-between" mb="md">
          <Text fw={500}>Details</Text>
        </Group>

        {/* Content only shows when aside is open */}
        {asideOpened && (
          <Box>
            <Text size="sm" c="dimmed">
              This is the collapsible right sidebar.
            </Text>
            <Text mt="sm">Add extra information, context, or tools here.</Text>
            {/* Example content */}
            <Button mt="lg" fullWidth variant="outline">
              Some Action
            </Button>
          </Box>
        )}
        {/* Show a small button/icon even when collapsed to reopen */}
        {!asideOpened && (
          <Button
            onClick={toggleAside}
            size="xs"
            variant="light"
            style={{
              writingMode: "vertical-rl",
              position: "absolute",
              top: "50%",
              left: "5px",
              transform: "translateY(-50%)",
            }} // Vertical button
          >
            Expand
          </Button>
        )}
      </AppShell.Aside>

      {/* Main Content Area */}
      <AppShell.Main>
        {/* React Router outlet renders the current page here */}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

export default Layout;