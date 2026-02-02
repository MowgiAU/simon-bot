# Fuji Studio

**Fuji Studio** is a modular, high-performance Discord bot designed specifically for a 50k-user FL Studio music producer community.

## 🚀 Key Features

-   **Modular Architecture**: Built on a strict plugin system (TypeScript). Plugins are auto-discovered from `src/bot/plugins`.
-   **Dynamic Dashboard**: React/Vite-based web interface for managing plugins, roles, and configuration.
-   **Production Feedback**: Specialized system for music producer communities:
    -   AI-driven feedback analysis (Basic vs Constructive).
    -   Economy integration (Currency rewards/costs).
    -   **Audio Audition**: Native audio player support for feedback reviews, preventing dead links.
    -   **Interactive Moderation**: Approve/Deny feedback directly from Discord or Dashboard.
-   **Analytics**: Tracks voice, message, and member stats with persistence.
-   **Moderation**: Advanced word filter with regex support and auto-reposting.
-   **Performance**: Optimized for large scale usage.

## 📚 Documentation

*   **[Installation Guide](INSTALL.md)**: Steps to set up your own instance (Local & VPS).
*   **[Plugin Development](src/bot/plugins/README.md)**: How to create new plugins.

## 🛠️ Tech Stack

*   **Language**: TypeScript (Node.js & React)
*   **Database**: PostgreSQL + Prisma
*   **Bot Framework**: Discord.js
*   **Server**: Express (API) + Nginx (Reverse Proxy)
*   **Tools**: PM2, Vite, Zod

---
*Maintained by the Fuji Studio Team*
