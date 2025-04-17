import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'
import LoginPage from './pages/LoginPage'
import PrivateRoute from './components/PrivateRoute'

function App() {
  return (
    <Routes>
      {/* The Layout component wraps all pages */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        {/* Child routes rendered inside Layout's <Outlet /> */}
        <Route index element={<DashboardPage />} /> {/* index route for '/' */}
        <Route path="Customers" element={<CustomersPage />} />
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
