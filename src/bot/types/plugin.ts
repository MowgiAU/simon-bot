import { Collection, PermissionResolvable } from 'discord.js';
import { z } from 'zod';

/**
 * Plugin Contract - every plugin MUST implement this interface
 */
export interface IPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  
  /**
   * Discord permissions required by this plugin
   */
  requiredPermissions: PermissionResolvable[];
  
  /**
   * Discord commands this plugin registers
   */
  commands: string[];
  
  /**
   * Discord events this plugin listens to
   */
  events: string[];
  
  /**
   * Dashboard sections this plugin provides
   * e.g., ['settings', 'wordgroups'] for word filter
   */
  dashboardSections: string[];
  
  /**
   * Whether this plugin is enabled by default
   */
  defaultEnabled: boolean;
  
  /**
   * Zod schema for plugin configuration validation
   */
  configSchema: z.ZodSchema;
  
  /**
   * Initialize plugin (called when bot starts or plugin is reloaded)
   */
  initialize(): Promise<void>;
  
  /**
   * Cleanup plugin (called when bot shuts down or plugin is disabled)
   */
  shutdown(): Promise<void>;
}

/**
 * Plugin metadata for dashboard registration
 */
export interface IPluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  dashboardSections: string[];
}

/**
 * Dashboard component provided by a plugin
 */
export interface IDashboardSection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  component: string; // Component name to render
  order: number;
}

/**
 * Plugin lifecycle hooks
 */
export interface IPluginHooks {
  onEnable?(): Promise<void>;
  onDisable?(): Promise<void>;
  onReload?(): Promise<void>;
}

/**
 * Plugin registry - manages all plugins
 */
export interface IPluginRegistry {
  register(plugin: IPlugin): void;
  unregister(pluginId: string): void;
  get(pluginId: string): IPlugin | undefined;
  getAll(): IPlugin[];
  getEnabled(): IPlugin[];
  getDisabled(): IPlugin[];
  isEnabled(pluginId: string): boolean;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
}

/**
 * Logger interface for consistent logging across plugins
 */
export interface ILogger {
  debug(msg: string, data?: any): void;
  info(msg: string, data?: any): void;
  warn(msg: string, data?: any): void;
  error(msg: string, error?: any): void;
}

/**
 * Plugin context - what the core provides to each plugin
 */
export interface IPluginContext {
  logger: ILogger;
  config: Map<string, any>;
  db: any; // Prisma client
  api: {
    baseUrl: string;
    token: string;
  };
}
