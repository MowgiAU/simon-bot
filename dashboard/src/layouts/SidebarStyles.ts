import { colors, spacing, typography, borderRadius } from '../theme/theme';

export const SidebarStyles = `
  .sidebar {
    width: 260px;
    height: 100vh;
    background: ${colors.sidebarBg};
    border-right: 1px solid ${colors.glassBorder};
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    overflow: visible;
    z-index: 1000;
    transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @media (max-width: 1024px) {
    .sidebar {
      transform: translateX(-100%);
    }
    .sidebar-open .sidebar {
      transform: translateX(0);
    }
  }

  .sidebar.collapsed {
    width: 72px;
    overflow: visible;
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    overflow-x: visible;
    padding: 4px 0;
  }

  .sidebar.collapsed .sidebar-header {
    padding: 20px 0;
    display: flex;
    justify-content: center;
  }

  .sidebar.collapsed .logo {
     justify-content: center;
     gap: 0;
  }

  .sidebar.collapsed .logo-text,
  .sidebar.collapsed .nav-group-title,
  .sidebar.collapsed .nav-label {
    display: none;
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 10px 0;
    margin: 2px 10px;
    width: calc(100% - 20px);
    position: relative;
    border-radius: 10px;
  }

  .sidebar.collapsed .nav-item:hover::after {
    content: attr(title);
    position: fixed;
    left: 80px;
    top: auto;
    transform: translateY(-50%);
    background: ${colors.surface};
    color: ${colors.textPrimary};
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    z-index: 1000000;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    border: 1px solid ${colors.glassBorder};
    pointer-events: none;
  }

  .sidebar.collapsed .nav-item:hover::before {
    content: '';
    position: fixed;
    left: 74px;
    top: auto;
    transform: translateY(-50%);
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-right: 5px solid ${colors.surface};
    z-index: 1000000;
    pointer-events: none;
  }

  .sidebar-header {
    padding: 20px 16px;
    border-bottom: 1px solid ${colors.glassBorder};
    position: relative;
    margin-bottom: 8px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .logo:hover { opacity: 0.85; }

  .logo img { margin: 0; }
  .logo h1 { display: block; }

  .sidebar.collapsed .logo h1, 
  .sidebar.collapsed .logo span,
  .sidebar.collapsed .logo-text,
  .sidebar.collapsed .server-info {
    display: none;
  }

  .nav-group-title {
    font-size: 10px;
    font-weight: 600;
    color: ${colors.textTertiary};
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 20px 0 6px 0;
    padding-left: 20px;
    opacity: 0.5;
  }

  .nav-item {
    width: calc(100% - 24px);
    margin: 2px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    background: transparent;
    border: none;
    color: ${colors.textSecondary};
    cursor: pointer;
    border-radius: 10px;
    transition: all 0.15s ease;
    font-family: ${typography.fontFamily};
    font-size: 13px;
    font-weight: 500;
    position: relative;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.04);
    color: ${colors.textPrimary};
  }

  .nav-item.active {
    background: rgba(16, 185, 129, 0.1);
    color: ${colors.primary};
    font-weight: 600;
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: ${colors.primary};
    box-shadow: 0 0 8px ${colors.primary}80;
  }

  .nav-item.active .nav-icon {
    color: ${colors.primary};
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    color: ${colors.textTertiary};
    transition: color 0.15s;
  }

  .nav-item:hover .nav-icon {
    color: ${colors.textSecondary};
  }

  .nav-label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
  }
  
  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid ${colors.glassBorder};
    margin-top: auto;
  }

  .collapse-sidebar-btn {
    width: 100%;
    padding: 8px;
    background: transparent;
    border: 1px solid ${colors.glassBorder};
    border-radius: 8px;
    color: ${colors.textTertiary};
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.15s;
  }

  .collapse-sidebar-btn:hover {
    background: rgba(255, 255, 255, 0.03);
    color: ${colors.textSecondary};
    border-color: rgba(255, 255, 255, 0.1);
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: ${spacing.md};
    padding: ${spacing.md};
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid ${colors.glassBorder};
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .user-profile:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  
  .sidebar.collapsed .user-profile {
    justify-content: center;
    padding: ${spacing.sm};
  }

  .user-profile img {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .logout-btn {
    background: rgba(239, 68, 68, 0.08);
    color: ${colors.error};
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logout-btn:hover {
     background: rgba(239, 68, 68, 0.15);
  }

  .user-name {
    color: ${colors.textPrimary};
    font-size: 13px;
    font-weight: 600;
    margin: 0;
  }

  .user-status {
    color: ${colors.textTertiary};
    font-size: 11px;
    margin: 0;
  }

  /* Scrollbar */
  .sidebar-nav::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-nav::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .sidebar-nav::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  /* Mobile */
  @media (max-width: 768px) {
    .sidebar {
      width: 280px;
      transform: translateX(-100%);
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(20px);
    }

    .app.sidebar-open .sidebar {
      transform: translateX(0);
    }

    .logo h1 {
      font-size: 18px;
    }

    .nav-item {
      font-size: 14px;
      padding: 10px 14px;
    }
    
    .sidebar.collapsed ~ .main-content,
    .main-content {
        margin-left: 0 !important;
    }
    
    .collapse-btn {
        display: none !important;
    }
  }

  /* Desktop */
  @media (min-width: 769px) {
    .sidebar.collapsed ~ .main-content {
      margin-left: 72px;
    }
  }
`;

