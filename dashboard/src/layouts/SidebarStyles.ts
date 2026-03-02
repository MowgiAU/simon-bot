import { colors, spacing, typography, borderRadius } from '../theme/theme';

export const SidebarStyles = `
  .sidebar {
    width: 260px;
    height: 100vh;
    background-color: ${colors.sidebarBg || colors.surface};
    border-right: 1px solid ${colors.border}33;
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    overflow: visible;
    z-index: 1000;
    transition: width 0.3s ease, transform 0.3s ease;
  }

  .sidebar.collapsed {
    width: 80px;
  }

  .sidebar-header {
    padding: ${spacing.xl} ${spacing.lg};
    border-bottom: 1px solid ${colors.border}20;
    position: relative;
    margin-bottom: ${spacing.lg};
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .logo img {
    margin: 0;
  }

  .logo h1 {
    display: block;
  }

  .sidebar.collapsed .logo h1, 
  .sidebar.collapsed .logo span,
  .sidebar.collapsed .server-info {
    display: none;
  }

  .nav-group-title {
    font-size: 10px;
    font-weight: 700;
    color: ${colors.textTertiary};
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin: ${spacing.xl} 0 ${spacing.sm} 0;
    padding-left: ${spacing.lg};
    opacity: 0.6;
  }

  .nav-item {
    width: calc(100% - ${spacing.lg} * 2);
    margin: 0 ${spacing.lg} ${spacing.xs} ${spacing.lg};
    display: flex;
    align-items: center;
    gap: ${spacing.md};
    padding: ${spacing.md} ${spacing.lg};
    background: transparent;
    border: none;
    color: #B9C3CE;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: ${typography.fontFamily};
    font-size: 14px;
    font-weight: 500;
  }

  .nav-item:hover {
    background-color: ${colors.surfaceLight}40;
    color: ${colors.textPrimary};
    transform: translateX(4px);
  }

  .nav-item.active {
    background: linear-gradient(118deg, ${colors.primary}, ${colors.primary}CC);
    color: #FFFFFF;
    box-shadow: 0 4px 12px 0 ${colors.primary}4D;
    padding-left: ${spacing.lg};
  }

  .nav-item.active .nav-icon {
    color: #FFFFFF;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    color: ${colors.textSecondary};
  }

  .nav-label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
  }
  
  .sidebar-footer {
    padding: ${spacing.lg};
    background: ${colors.sidebarBg}CC;
    border-top: 1px solid ${colors.border}33;
    margin-top: auto;
  }

  .collapse-sidebar-btn {
    width: 100%;
    padding: 10px;
    background: ${colors.surfaceLight}33;
    border: none;
    border-radius: 6px;
    color: ${colors.textSecondary};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .collapse-sidebar-btn:hover {
    background: ${colors.surfaceLight}66;
    color: ${colors.textPrimary};
  }

  .sidebar-footer {
    padding: ${spacing.lg} ${spacing.md};
    border-top: 1px solid ${colors.border};
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: ${spacing.md};
    padding: ${spacing.md};
    background-color: ${colors.surfaceLight};
    border-radius: ${borderRadius.md};
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .user-profile:hover {
    background-color: ${colors.border};
  }
  
  .sidebar.collapsed .user-profile {
    justify-content: center;
    padding: ${spacing.sm};
  }

  .user-profile img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .logout-btn {
    background: rgba(242, 123, 19, 0.1);
    color: ${colors.highlight};
    border: 1px solid rgba(242, 123, 19, 0.2);
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logout-btn:hover {
     background: rgba(242, 123, 19, 0.2);
     transform: translateY(-1px);
  }

  .user-name {
    color: ${colors.textPrimary};
    font-size: 13px;
    font-weight: 600;
    margin: 0;
  }

  .user-status {
    color: ${colors.textTertiary};
    font-size: 12px;
    margin: 0;
  }

  /* Scrollbar styling */
  .sidebar::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 3px;
  }

  .sidebar::-webkit-scrollbar-thumb:hover {
    background: ${colors.textTertiary};
  }

  /* Mobile */
  @media (max-width: 768px) {
    .sidebar {
      width: 280px;
      transform: translateX(-100%);
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.5);
    }

    .app.sidebar-open .sidebar {
      transform: translateX(0);
    }

    .logo h1 {
      font-size: 18px;
    }

    .nav-item {
      font-size: 15px;
      padding: ${spacing.md} ${spacing.lg};
    }
    
    /* Ensure content margin is zero on mobile */
    .sidebar.collapsed ~ .main-content,
    .main-content {
        margin-left: 0 !important;
    }
    
    /* Hide desktop collapse interaction on mobile */
    .collapse-btn {
        display: none !important;
    }
  }

  /* Desktop - Layout Adjustment */
  @media (min-width: 769px) {
    .sidebar.collapsed ~ .main-content {
      margin-left: 80px;
    }
  }
`;

