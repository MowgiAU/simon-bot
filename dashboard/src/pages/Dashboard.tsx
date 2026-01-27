import React from 'react';
import { colors, spacing } from '../theme/theme';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 style={{ color: colors.textPrimary, margin: 0, fontSize: '32px', fontWeight: 700 }}>
          Dashboard
        </h1>
        <p style={{ color: colors.textSecondary, margin: '8px 0 0 0', fontSize: '15px' }}>
          Welcome to Simon Bot Control Panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(43, 140, 113, 0.12)' }}>
            <span style={{ fontSize: '24px' }}>👥</span>
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Servers</p>
            <h3 className="stat-value">1,234</h3>
            <p className="stat-change positive">+12% from last month</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(62, 89, 34, 0.12)' }}>
            <span style={{ fontSize: '24px' }}>👤</span>
          </div>
          <div className="stat-content">
            <p className="stat-label">Active Users</p>
            <h3 className="stat-value">24.5K</h3>
            <p className="stat-change positive">+5% from last month</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(122, 140, 55, 0.12)' }}>
            <span style={{ fontSize: '24px' }}>💬</span>
          </div>
          <div className="stat-content">
            <p className="stat-label">Messages Filtered</p>
            <h3 className="stat-value">156K</h3>
            <p className="stat-change positive">+8% from last month</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(242, 123, 19, 0.12)' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
          </div>
          <div className="stat-content">
            <p className="stat-label">System Status</p>
            <h3 className="stat-value">Healthy</h3>
            <p className="stat-change">All systems operational</p>
          </div>
        </div>
      </div>

      {/* Content Cards */}
      <div className="dashboard-grid">
        {/* Quick Actions Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="card-body">
            <button className="action-button">
              <span className="action-icon">🔧</span>
              Configure Word Filter
            </button>
            <button className="action-button">
              <span className="action-icon">➕</span>
              Add Plugin
            </button>
            <button className="action-button">
              <span className="action-icon">📊</span>
              View Analytics
            </button>
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="card-body">
            <div className="activity-item">
              <div className="activity-dot" style={{ backgroundColor: '#2B8C71' }}></div>
              <div className="activity-content">
                <p className="activity-title">Word Filter Updated</p>
                <p className="activity-time">2 hours ago</p>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" style={{ backgroundColor: '#3E5922' }}></div>
              <div className="activity-content">
                <p className="activity-title">New Server Added</p>
                <p className="activity-time">4 hours ago</p>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-dot" style={{ backgroundColor: '#7A8C37' }}></div>
              <div className="activity-content">
                <p className="activity-title">Plugin Reloaded</p>
                <p className="activity-time">1 day ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Servers Overview Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Top Servers</h2>
          </div>
          <div className="card-body">
            <div className="server-item">
              <div className="server-info">
                <p className="server-name">FL Studio Producers</p>
                <p className="server-members">45.2K members</p>
              </div>
              <span className="server-badge">Active</span>
            </div>
            <div className="server-item">
              <div className="server-info">
                <p className="server-name">Music Makers Guild</p>
                <p className="server-members">12.8K members</p>
              </div>
              <span className="server-badge">Active</span>
            </div>
            <div className="server-item">
              <div className="server-info">
                <p className="server-name">Producers Network</p>
                <p className="server-members">8.3K members</p>
              </div>
              <span className="server-badge">Active</span>
            </div>
          </div>
        </div>

        {/* System Info Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>System Info</h2>
          </div>
          <div className="card-body">
            <div className="info-row">
              <span className="info-label">Bot Version</span>
              <span className="info-value">v1.0.0</span>
            </div>
            <div className="info-row">
              <span className="info-label">Uptime</span>
              <span className="info-value">14 days, 6h</span>
            </div>
            <div className="info-row">
              <span className="info-label">Plugins Active</span>
              <span className="info-value">1 of 3</span>
            </div>
            <div className="info-row">
              <span className="info-label">Database Status</span>
              <span className="info-value" style={{ color: '#2B8C71' }}>Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
