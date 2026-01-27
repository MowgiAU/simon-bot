import { IPlugin, IPluginRegistry } from '../types/plugin';
import { Logger } from '../utils/logger';

/**
 * PluginManager - responsible for plugin lifecycle management
 * 
 * Responsibilities:
 * - Register/unregister plugins
 * - Enable/disable plugins
 * - Load plugins from filesystem
 * - Track plugin state
 * - Validate plugin contracts
 */
export class PluginManager implements IPluginRegistry {
  private plugins: Map<string, IPlugin> = new Map();
  private enabledPlugins: Set<string> = new Set();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('PluginManager');
  }

  /**
   * Register a plugin with the system
   * Validates plugin contract before registration
   */
  register(plugin: IPlugin): void {
    this.validatePlugin(plugin);

    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }

    this.plugins.set(plugin.id, plugin);
    
    if (plugin.defaultEnabled) {
      this.enabledPlugins.add(plugin.id);
    }

    this.logger.info(`Registered plugin: ${plugin.id} v${plugin.version}`);
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    this.plugins.delete(pluginId);
    this.enabledPlugins.delete(pluginId);
    this.logger.info(`Unregistered plugin: ${pluginId}`);
  }

  /**
   * Get a specific plugin
   */
  get(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAll(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get only enabled plugins
   */
  getEnabled(): IPlugin[] {
    return this.getAll().filter(p => this.enabledPlugins.has(p.id));
  }

  /**
   * Get only disabled plugins
   */
  getDisabled(): IPlugin[] {
    return this.getAll().filter(p => !this.enabledPlugins.has(p.id));
  }

  /**
   * Check if plugin is enabled
   */
  isEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }

  /**
   * Enable a plugin at runtime
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    if (this.enabledPlugins.has(pluginId)) {
      this.logger.warn(`Plugin "${pluginId}" is already enabled`);
      return;
    }

    try {
      await plugin.initialize();
      this.enabledPlugins.add(pluginId);
      this.logger.info(`Enabled plugin: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to enable plugin "${pluginId}"`, error);
      throw error;
    }
  }

  /**
   * Disable a plugin at runtime
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    if (!this.enabledPlugins.has(pluginId)) {
      this.logger.warn(`Plugin "${pluginId}" is already disabled`);
      return;
    }

    try {
      await plugin.shutdown();
      this.enabledPlugins.delete(pluginId);
      this.logger.info(`Disabled plugin: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to disable plugin "${pluginId}"`, error);
      throw error;
    }
  }

  /**
   * Validate plugin contract - ensure it implements everything required
   */
  private validatePlugin(plugin: IPlugin): void {
    const required = ['id', 'name', 'description', 'version', 'author', 'initialize', 'shutdown'];
    const missing = required.filter(field => !(field in plugin) || plugin[field as keyof IPlugin] === undefined);

    if (missing.length > 0) {
      throw new Error(
        `Plugin "${plugin.id}" is invalid - missing required fields: ${missing.join(', ')}`
      );
    }

    // Validate arrays are arrays
    if (!Array.isArray(plugin.commands)) plugin.commands = [];
    if (!Array.isArray(plugin.events)) plugin.events = [];
    if (!Array.isArray(plugin.dashboardSections)) plugin.dashboardSections = [];
    if (!Array.isArray(plugin.requiredPermissions)) plugin.requiredPermissions = [];
  }
}
