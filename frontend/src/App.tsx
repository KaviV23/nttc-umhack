import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      {/* The Layout component wraps all pages */}
      <Route path="/" element={<Layout />}>
        {/* Child routes rendered inside Layout's <Outlet /> */}
        <Route index element={<HomePage />} /> {/* index route for '/' */}
        <Route path="about" element={<AboutPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Add more routes here as needed */}
        {/* Example: <Route path="users" element={<UsersPage />} /> */}

        {/* Optional: Add a 404 Not Found route */}
        <Route path="*" element={<div><h2>404 Not Found</h2></div>} />
      </Route>
    </Routes>
  )
}

export default App
