import '../styles/Layout.css';

interface RightSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

function RightSidebar({ isOpen, toggleSidebar}: RightSidebarProps) {
  // Apply 'collapsed' class based on the isOpen prop
  const sidebarClass = isOpen ? 'right-sidebar' : 'right-sidebar collapsed';

  return (
    <aside className={sidebarClass}>
      <button onClick={toggleSidebar} className="toggle-button">
        {isOpen ? 'Collapse <<' : '>>'}
      </button>
      {isOpen && ( // Only render content if open for clean collapse
        <div className="right-sidebar-content">
          <h3>Right Sidebar</h3>
          <p>This sidebar can be collapsed.</p>
          <p>Add widgets, tools, or extra info here.</p>
        </div>
      )}
    </aside>
  );
}

export default RightSidebar;