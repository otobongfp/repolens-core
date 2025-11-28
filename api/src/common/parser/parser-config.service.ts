import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface LanguageConfig {
  name: string;
  extensions: string[];
  module: string;
  export: string;
  aliases: string[];
}

export interface ParserConfig {
  languages: LanguageConfig[];
}

@Injectable()
export class ParserConfigService {
  private readonly logger = new Logger(ParserConfigService.name);
  private config: ParserConfig | null = null;
  private extensionMap: Map<string, LanguageConfig> = new Map();
  private aliasMap: Map<string, LanguageConfig> = new Map();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      // Try multiple paths (development and production)
      const possiblePaths = [
        path.join(__dirname, 'languages.yaml'), // Production (dist)
        path.join(process.cwd(), 'src/common/parser/languages.yaml'), // Development
        path.join(process.cwd(), 'dist/common/parser/languages.yaml'), // Production fallback
      ];

      let configPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          configPath = p;
          break;
        }
      }

      if (!configPath) {
        throw new Error('languages.yaml not found in any expected location');
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      this.config = yaml.load(configContent) as ParserConfig;

      if (!this.config || !this.config.languages) {
        throw new Error('Invalid parser configuration');
      }

      // Build extension and alias maps
      for (const lang of this.config.languages) {
        // Map extensions to language config
        for (const ext of lang.extensions) {
          this.extensionMap.set(ext.toLowerCase(), lang);
        }
        
        // Map aliases to language config
        for (const alias of lang.aliases) {
          this.aliasMap.set(alias.toLowerCase(), lang);
        }
      }

      this.logger.log(
        `Loaded ${this.config.languages.length} language configurations`
      );
    } catch (error) {
      this.logger.error('Failed to load parser configuration:', error);
      // Fallback to default config
      this.config = this.getDefaultConfig();
      this.buildMaps();
    }
  }

  /**
   * Get language config by file extension
   */
  getLanguageByExtension(ext: string): LanguageConfig | null {
    const normalized = ext.toLowerCase().replace(/^\./, '');
    return this.extensionMap.get(normalized) || null;
  }

  /**
   * Get language config by alias
   */
  getLanguageByAlias(alias: string): LanguageConfig | null {
    const normalized = alias.toLowerCase();
    return this.aliasMap.get(normalized) || null;
  }

  /**
   * Get language config by file path
   */
  getLanguageByPath(filePath: string): LanguageConfig | null {
    const ext = path.extname(filePath).replace(/^\./, '');
    return this.getLanguageByExtension(ext);
  }

  /**
   * Get all language configurations
   */
  getAllLanguages(): LanguageConfig[] {
    return this.config?.languages || [];
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(filePath: string): boolean {
    return this.getLanguageByPath(filePath) !== null;
  }

  private getDefaultConfig(): ParserConfig {
    return {
      languages: [
        {
          name: 'javascript',
          extensions: ['js', 'jsx'],
          module: 'tree-sitter-javascript',
          export: 'default',
          aliases: ['js', 'javascript'],
        },
        {
          name: 'typescript',
          extensions: ['ts', 'tsx'],
          module: 'tree-sitter-typescript',
          export: 'typescript',
          aliases: ['ts', 'typescript'],
        },
        {
          name: 'python',
          extensions: ['py'],
          module: 'tree-sitter-python',
          export: 'default',
          aliases: ['py', 'python'],
        },
      ],
    };
  }

  private buildMaps() {
    if (!this.config) return;

    this.extensionMap.clear();
    this.aliasMap.clear();

    for (const lang of this.config.languages) {
      for (const ext of lang.extensions) {
        this.extensionMap.set(ext.toLowerCase(), lang);
      }
      for (const alias of lang.aliases) {
        this.aliasMap.set(alias.toLowerCase(), lang);
      }
    }
  }
}

