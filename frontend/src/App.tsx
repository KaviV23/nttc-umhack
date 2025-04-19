import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'
import LoginPage from './pages/LoginPage'
import PrivateRoute from './components/PrivateRoute'
import { useDisclosure } from '@mantine/hooks'

function App() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  return (
    <Routes>
      {/* The Layout component wraps all pages */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout 
              openModal={openModal}
            />
          </PrivateRoute>
        }
      >
        {/* Child routes rendered inside Layout's <Outlet /> */}
        <Route index element={<DashboardPage />} /> {/* index route for '/' */}
        <Route
          path="Customers"
          element={
            <CustomersPage
              modalOpened={modalOpened}
              openModal={openModal}
              closeModal={closeModal}
            />
          }
        />
        {/* Add more routes here as needed */}
        {/* Example: <Route path="users" element={<UsersPage />} /> */}
        {/* Optional: Add a 404 Not Found route */}
        <Route
          path="*"
          element={
            <div>
              <h2>404 Not Found</h2>
            </div>
          }
        />
      </Route>
      <Route path="/auth">
        <Route path="Login" element={<LoginPage />} />
      </Route>
    </Routes>
  );
}

export default App
