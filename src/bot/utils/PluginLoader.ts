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
          // Convert to file URL for Windows compatibility
          const importPath = process.platform === 'win32' ? `file://${pluginPath}` : pluginPath;
          
          // Dynamic import - in production this would be from dist/
          const module = await import(importPath);
          
          // Check for default export or named export matching the class style
          // Assuming plugins export the class or an instance as default, 
          // or we instantiate it if it's a class constructor.
          // However, in our index.ts we are instantiating them manually: 
          // this.pluginManager.register(new StagingTestPlugin());
          // So this loader might actually be redundant if we are manually registering in index.ts
          // But to fix the error, we fix the path.
          
          // NOTE: The current index.ts logic loads plugins dynamically AND manually registers them.
          // That causes double loading or conflicts.
          // Based on index.ts: "const plugins = await this.pluginLoader.loadPlugins();"
          // usage is: it just loads them into an array but doesn't do anything with them yet?
          
          // Let's just fix the import for now.
          const plugin = new (Object.values(module)[0] as any)() as IPlugin;
          
          // We are not actually using this return value in index.ts properly yet, 
          // but let's fix the crash.
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
