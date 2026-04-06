/**
 * Native Module Debug Logger
 *
 * Specialized logging for React Native native module events and errors.
 * Helps diagnose issues like:
 * - "Unsupported top level event type" errors
 * - Native module registration failures
 * - Bridge communication issues
 * - Native event listener problems
 *
 * Usage:
 * ```ts
 * import { NativeModuleLogger } from '@/utils/nativeModuleLogger';
 *
 * // Enable native module debugging
 * NativeModuleLogger.enable();
 *
 * // Track specific module
 * NativeModuleLogger.trackModule('RNMaps', MapView);
 * ```
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

import { Logger } from './logger';

interface NativeModuleInfo {
  name: string;
  isRegistered: boolean;
  methods?: string[];
  constants?: Record<string, unknown>;
  hasEventEmitter: boolean;
  error?: string;
}

interface NativeEventLog {
  eventName: string;
  moduleName: string;
  timestamp: string;
  data?: unknown;
  error?: string;
}

type NativeModuleShape = Record<string, unknown> & {
  getConstants?: () => Record<string, unknown>;
  addListener?: (...args: unknown[]) => unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const isNativeModuleShape = (value: unknown): value is NativeModuleShape => isRecord(value);

class NativeModuleDebugger {
  private enabled = false;
  private moduleInfo: Map<string, NativeModuleInfo> = new Map();
  private eventLogs: NativeEventLog[] = [];
  private readonly maxEventLogs = 500;
  private eventEmitters: Map<string, NativeEventEmitter> = new Map();
  private eventListeners: Map<string, Array<{ eventName: string; remove: () => void }>> = new Map();

  /**
   * Enable native module debugging
   * Scans all registered native modules and logs their info
   */
  public enable(): void {
    if (this.enabled) {
      Logger.warn('[NativeModuleLogger] Already enabled');
      return;
    }

    this.enabled = true;
    Logger.info('[NativeModuleLogger] Native module debugging enabled');

    // Scan all native modules
    this.scanNativeModules();

    // Override console.error to catch native errors
    this.interceptNativeErrors();
  }

  /**
   * Disable native module debugging
   */
  public disable(): void {
    if (!this.enabled) return;

    this.enabled = false;

    // Remove all event listeners
    this.eventListeners.forEach((listeners) => {
      listeners.forEach(({ remove }) => remove());
    });
    this.eventListeners.clear();
    this.eventEmitters.clear();

    Logger.info('[NativeModuleLogger] Native module debugging disabled');
  }

  /**
   * Scan and log information about all registered native modules
   */
  private scanNativeModules(): void {
    Logger.info('[NativeModuleLogger] Scanning native modules...');

    Object.keys(NativeModules).forEach((moduleName) => {
      try {
        const module = NativeModules[moduleName] as unknown;

        if (!isNativeModuleShape(module)) {
          this.moduleInfo.set(moduleName, {
            name: moduleName,
            isRegistered: false,
            error: 'Module is null or undefined',
            hasEventEmitter: false,
          });
          return;
        }

        const constants =
          typeof module.getConstants === 'function' ? module.getConstants() : undefined;
        const info: NativeModuleInfo = {
          name: moduleName,
          isRegistered: true,
          methods: Object.keys(module).filter((key) => typeof module[key] === 'function'),
          ...(constants !== undefined && { constants }),
          hasEventEmitter: typeof module.addListener === 'function',
        };

        this.moduleInfo.set(moduleName, info);

        // Log modules related to maps/location
        if (
          moduleName.toLowerCase().includes('map') ||
          moduleName.toLowerCase().includes('location') ||
          moduleName.toLowerCase().includes('geolocation')
        ) {
          Logger.debug(`[NativeModuleLogger] Found relevant module: ${moduleName}`, {
            methods: info.methods?.slice(0, 10), // First 10 methods
            hasEventEmitter: info.hasEventEmitter,
            constantsCount: info.constants ? Object.keys(info.constants).length : 0,
          });
        }
      } catch (error) {
        this.moduleInfo.set(moduleName, {
          name: moduleName,
          isRegistered: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          hasEventEmitter: false,
        });
      }
    });

    Logger.info(`[NativeModuleLogger] Found ${this.moduleInfo.size} native modules`);
  }

  /**
   * Track events from a specific native module
   */
  public trackModule(moduleName: string, moduleOrEmitter?: unknown): void {
    if (!this.enabled) {
      Logger.warn('[NativeModuleLogger] Not enabled. Call enable() first.');
      return;
    }

    try {
      // Get the module
      const nativeModule: unknown = moduleOrEmitter ?? (NativeModules[moduleName] as unknown);

      if (nativeModule === null || nativeModule === undefined) {
        Logger.error(`[NativeModuleLogger] Module not found: ${moduleName}`);
        return;
      }

      // Create event emitter
      let emitter: NativeEventEmitter;

      if (nativeModule instanceof NativeEventEmitter) {
        emitter = nativeModule;
      } else if (typeof nativeModule === 'object') {
        emitter = new NativeEventEmitter(nativeModule as never);
      } else {
        Logger.error(`[NativeModuleLogger] Cannot create emitter for ${moduleName}`);
        return;
      }

      this.eventEmitters.set(moduleName, emitter);

      Logger.info(`[NativeModuleLogger] Now tracking events from: ${moduleName}`);

      // Try to track common event names
      const commonEvents = [
        'onMapReady',
        'onPress',
        'onUserLocationChange',
        'onRegionChange',
        'onMarkerPress',
        'topUserLocationChange', // The problematic event
        'topChange',
      ];

      const listeners: Array<{ eventName: string; remove: () => void }> = [];

      commonEvents.forEach((eventName) => {
        try {
          const subscription = emitter.addListener(eventName, (data: unknown) => {
            this.logEvent(eventName, moduleName, data);
          });

          listeners.push({
            eventName,
            remove: () => subscription.remove(),
          });
        } catch {
          // Event might not exist, that's okay
        }
      });

      this.eventListeners.set(moduleName, listeners);
    } catch (error) {
      Logger.error(
        `[NativeModuleLogger] Failed to track module: ${moduleName}`,
        {},
        error as Error,
      );
    }
  }

  /**
   * Log a native event
   */
  private logEvent(eventName: string, moduleName: string, data?: unknown): void {
    const log: NativeEventLog = {
      eventName,
      moduleName,
      timestamp: new Date().toISOString(),
      data,
    };

    this.eventLogs.push(log);

    // Keep only recent logs
    if (this.eventLogs.length > this.maxEventLogs) {
      this.eventLogs = this.eventLogs.slice(-this.maxEventLogs);
    }

    Logger.debug(`[NativeModuleLogger] Event: ${moduleName}.${eventName}`, {
      data: typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : data,
    });
  }

  /**
   * Intercept native errors from console.error
   */
  private interceptNativeErrors(): void {
    const consoleSink = globalThis.console;
    const originalError = consoleSink.error.bind(consoleSink);

    consoleSink.error = (...args: unknown[]) => {
      // Call original first
      originalError(...args);

      // Check if it's a native module error
      const message = args.map((arg) => String(arg)).join(' ');

      if (
        message.includes('Unsupported top level event type') ||
        message.includes('native module') ||
        message.includes('NativeModule') ||
        message.includes('topUserLocationChange')
      ) {
        Logger.error('[NativeModuleLogger] Native module error detected', {
          message,
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        });

        // Log current module states
        this.logModuleStates();
      }
    };
  }

  /**
   * Log the current state of tracked modules
   */
  private logModuleStates(): void {
    const states: Record<string, NativeModuleInfo> = {};

    this.moduleInfo.forEach((info, name) => {
      if (name.toLowerCase().includes('map') || name.toLowerCase().includes('location')) {
        states[name] = info;
      }
    });

    Logger.debug('[NativeModuleLogger] Current module states', states);
  }

  /**
   * Get information about a specific module
   */
  public getModuleInfo(moduleName: string): NativeModuleInfo | undefined {
    return this.moduleInfo.get(moduleName);
  }

  /**
   * Get all module information
   */
  public getAllModuleInfo(): NativeModuleInfo[] {
    return Array.from(this.moduleInfo.values());
  }

  /**
   * Get recent event logs
   */
  public getEventLogs(moduleName?: string, limit = 50): NativeEventLog[] {
    let logs = [...this.eventLogs];

    if (moduleName !== undefined && moduleName !== '') {
      logs = logs.filter((log) => log.moduleName === moduleName);
    }

    return logs.slice(-limit);
  }

  /**
   * Export debug report
   */
  public exportDebugReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      enabled: this.enabled,
      modules: this.getAllModuleInfo(),
      recentEvents: this.getEventLogs(undefined, 100),
      trackedModules: Array.from(this.eventListeners.keys()),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Check if a specific module is properly registered
   */
  public verifyModule(moduleName: string): boolean {
    const info = this.moduleInfo.get(moduleName);

    if (info?.isRegistered !== true) {
      Logger.error(`[NativeModuleLogger] Module not registered: ${moduleName}`, {
        error: info?.error,
      });
      return false;
    }

    Logger.info(`[NativeModuleLogger] Module verified: ${moduleName}`, {
      methods: info.methods?.length ?? 0,
      hasEventEmitter: info.hasEventEmitter,
    });

    return true;
  }

  /**
   * Log react-native-maps specific diagnostics
   */
  public logMapsDiagnostics(): void {
    Logger.info('[NativeModuleLogger] Running Maps diagnostics...');

    const mapsModules = ['AIRMap', 'AIRMapModule', 'RNMaps', 'AirMapModule'];

    mapsModules.forEach((moduleName) => {
      const module = NativeModules[moduleName] as unknown;

      if (isNativeModuleShape(module)) {
        Logger.info(`[NativeModuleLogger] Found Maps module: ${moduleName}`, {
          methods: Object.keys(module).filter((k) => typeof module[k] === 'function'),
          hasConstants: typeof module.getConstants === 'function',
        });

        if (typeof module.getConstants === 'function') {
          try {
            const constants = module.getConstants();
            Logger.debug(`[NativeModuleLogger] ${moduleName} constants:`, constants);
          } catch (error) {
            Logger.error(
              `[NativeModuleLogger] Failed to get ${moduleName} constants`,
              {},
              error as Error,
            );
          }
        }
      }
    });
  }
}

// Singleton instance
export const NativeModuleLogger = new NativeModuleDebugger();

// Export types
