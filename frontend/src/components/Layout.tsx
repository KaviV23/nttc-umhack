import { Outlet } from 'react-router-dom';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import '../styles/Layout.css';
import { useState } from 'react';

function Layout() {
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true); // Default to open

  const toggleRightSidebar = () => {
    setIsRightSidebarOpen(!isRightSidebarOpen);
  };

  return (
    <div className="app-layout">
      <LeftSidebar />
      <main className="main-content">
        {/* Content for the current route will be rendered here */}
        <Outlet />
      </main>
      <RightSidebar isOpen={isRightSidebarOpen} toggleSidebar={toggleRightSidebar} />
    </div>
  );
}

export default Layout;