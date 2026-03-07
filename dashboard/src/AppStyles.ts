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
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
      margin-left: 80px;
      width: calc(100% - 80px);
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
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${colors.background};
  }

  ::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${colors.textTertiary};
  }

  /* Dashboard & Grid Layouts */
  .dashboard-grid-split {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
  }

  .dashboard-card-main {
    background: #252D3E;
    border-radius: 12px;
    border: 1px solid #3E455633;
    padding: 24px;
  }

  .dashboard-card-activity {
    background: linear-gradient(118deg, rgba(36, 44, 61, 0.8), rgba(26, 30, 46, 0.9));
    border-radius: 12px;
    border: 1px solid #3E455633;
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
      background: rgba(0,0,0,0.5);
      z-index: 999;
      backdrop-filter: blur(4px);
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

    /* Grid splitting for mobile */
    .dashboard-grid-split {
      grid-template-columns: 1fr !important;
    }

    .dashboard-card-main, .dashboard-card-activity {
      padding: 16px;
    }

    .stats-grid {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }

    .info-banner-hide-mobile {
      display: none !important;
    }
  }
`;
