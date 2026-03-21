import { colors } from './theme/theme';

export const AppStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body, #root {
    width: 100%;
    height: 100%;
  }

  body {
    background-color: ${colors.background};
    color: ${colors.textPrimary};
    font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .app {
    display: flex;
    min-height: 100vh;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: ${colors.background};
    transition: margin-left 0.3s ease;
    z-index: 10;
    position: relative;
    height: 100vh;
    width: 100%;
    overflow: hidden;
  }

  /* Indent only when Desktop Sidebar is visible */
  @media (min-width: 1025px) {
    .sidebar:not(.collapsed) + .main-content,
    .sidebar:not(.collapsed) ~ .main-content {
      margin-left: 260px;
      width: calc(100% - 260px);
    }

    .sidebar.collapsed + .main-content,
    .sidebar.collapsed ~ .main-content {
      margin-left: 72px;
      width: calc(100% - 72px);
    }
  }

  .main-content-scroll-container {
    flex: 1;
    overflow-y: auto !important;
    overflow-x: hidden;
    width: 100%;
    height: 100%;
    -webkit-overflow-scrolling: touch;
    display: block;
  }

  /* Global scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  /* Dashboard & Grid Layouts */
  .dashboard-grid-split {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    margin-bottom: 28px;
  }

  .dashboard-card-main {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 24px;
  }

  .dashboard-card-activity {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 24px;
  }

  /* Shared Mobile Optimizations */
  @media (max-width: 1200px) {
    .dashboard-grid-split {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1024px) {
    .main-content {
      margin-left: 0 !important;
      padding-top: 0 !important;
    }
    
    .sidebar-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 999;
      backdrop-filter: blur(8px);
    }

    .dashboard-grid-split {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .dashboard-container {
      padding: 12px !important;
    }

    .settings-overview-banner {
      flex-direction: column !important;
      align-items: flex-start !important;
      padding: 16px !important;
    }

    .dashboard-grid-split {
      grid-template-columns: 1fr !important;
    }

    .dashboard-card-main, .dashboard-card-activity {
      padding: 16px;
    }

    .stats-grid {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .info-banner-hide-mobile {
      display: none !important;
    }
  }
`;
