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
  }

  .main-content {
    flex: 1;
    overflow-y: auto;
    background-color: ${colors.background};
    transition: margin-left 0.3s ease;
    z-index: 1; /* Keep content below sidebar popovers */
    position: relative;
  }

  /* Only indent content when a sidebar is actually present */
  .sidebar:not(.collapsed) + .main-content,
  .sidebar:not(.collapsed) ~ .main-content {
    margin-left: 260px;
  }

  .sidebar.collapsed + .main-content,
  .sidebar.collapsed ~ .main-content {
    margin-left: 80px;
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

  /* Shared Mobile Optimizations */
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

    .stats-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 12px !important;
    }

    .info-banner-hide-mobile {
      display: none !important;
    }
  }
`;
