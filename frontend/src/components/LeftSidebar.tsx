import { NavLink } from 'react-router-dom';
import '../styles/Layout.css'; // We'll create this CSS file soon

function LeftSidebar() {
  return (
    <nav className="left-sidebar">
      <h2>Navigation</h2>
      <ul>
        <li>
          {/* NavLink adds an 'active' class automatically */}
          <NavLink to="/" end> {/* 'end' prevents matching parent routes */}
             Home
          </NavLink>
        </li>
        <li>
          <NavLink to="/about">
            About
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings">
            Settings
          </NavLink>
        </li>
        {/* Add more links as needed */}
      </ul>
    </nav>
  );
}

export default LeftSidebar;