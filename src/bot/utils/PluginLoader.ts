/**
 * Plugin loader - discovers and loads plugins from filesystem
 */

import fs from 'fs/promises';
import path from 'path';
import { IPlugin } from '../types/plugin';
import { Logger } from './logger';

export class PluginLoader {
  private logger: Logger;
  private pluginsDir: string;

  constructor(pluginsDir: string = path.join(process.cwd(), 'src/bot/plugins')) {
    this.logger = new Logger('PluginLoader');
    this.pluginsDir = pluginsDir;
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadPlugins(): Promise<IPlugin[]> {
    const plugins: IPlugin[] = [];

    try {
      const files = await fs.readdir(this.pluginsDir);
      const pluginFiles = files.filter(
        f => f.endsWith('Plugin.ts') || f.endsWith('Plugin.js')
      );

      for (const file of pluginFiles) {
        try {
          const pluginPath = path.join(this.pluginsDir, file);
          // Dynamic import - in production this would be from dist/
          const module = await import(pluginPath);
          const plugin = module.default as IPlugin;

          plugins.push(plugin);
          this.logger.info(`Loaded plugin: ${plugin.id}`);
        } catch (error) {
          this.logger.error(`Failed to load plugin from ${file}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to read plugins directory', error);
    }

    return plugins;
  }
}
