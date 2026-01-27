import { colors, spacing, typography, borderRadius } from '../theme/theme';

export const SidebarStyles = `
  .sidebar {
    width: 260px;
    height: 100vh;
    background-color: ${colors.surface};
    border-right: 1px solid ${colors.border};
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    overflow-y: auto;
    z-index: 1000;
    transition: transform 0.3s ease;
  }

  .sidebar-header {
    padding: ${spacing.lg} ${spacing.md};
    border-bottom: 1px solid ${colors.border};
  }

  .logo {
    display: flex;
    align-items: center;
    gap: ${spacing.md};
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .logo:hover {
    opacity: 0.8;
  }

  .logo-icon {
    font-size: 24px;
    color: ${colors.primary};
  }

  .logo h1 {
    color: ${colors.textPrimary};
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }

  .sidebar-nav {
    flex: 1;
    padding: ${spacing.lg} ${spacing.md};
    overflow-y: auto;
  }

  .nav-group {
    margin-bottom: ${spacing.xl};
  }

  .nav-group-title {
    font-size: 11px;
    font-weight: 600;
    color: ${colors.textTertiary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 ${spacing.md} 0;
    padding: 0;
  }

  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: ${spacing.md};
    padding: ${spacing.md} ${spacing.lg};
    background: transparent;
    border: none;
    color: ${colors.textSecondary};
    cursor: pointer;
    border-radius: ${borderRadius.md};
    transition: all 0.2s;
    font-family: ${typography.fontFamily};
    font-size: 14px;
    font-weight: 500;
    margin-bottom: ${spacing.sm};
  }

  .nav-item:hover {
    background-color: ${colors.surfaceLight};
    color: ${colors.textPrimary};
  }

  .nav-item.active {
    background-color: ${colors.primary}20;
    color: ${colors.primary};
    border-left: 3px solid ${colors.primary};
    padding-left: calc(${spacing.lg} - 3px);
  }

  .nav-icon {
    font-size: 18px;
  }

  .nav-label {
    flex: 1;
    text-align: left;
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

  .user-profile img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .user-info {
    flex: 1;
    min-width: 0;
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
  }
`;

