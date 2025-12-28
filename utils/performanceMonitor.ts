import React from 'react';

/**
 * Performance monitoring utilities
 * Tracks component render times and performance metrics
 */

interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private maxEntries = 100;

  /**
   * Mark the start of a performance measurement
   */
  mark(name: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * Mark the end of a performance measurement and calculate duration
   */
  measure(name: string): number | null {
    if (typeof performance === 'undefined') {
      return null;
    }

    try {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name)[0];
      const duration = measure?.duration || 0;

      this.addEntry({
        name,
        duration,
        timestamp: Date.now(),
      });

      // Cleanup marks and measures
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(name);

      return duration;
    } catch (error) {
      console.warn('Performance measurement failed:', error);
      return null;
    }
  }

  /**
   * Add a performance entry
   */
  private addEntry(entry: PerformanceEntry): void {
    this.entries.push(entry);
    
    // Keep only the most recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /**
   * Get all performance entries
   */
  getEntries(): PerformanceEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by name
   */
  getEntriesByName(name: string): PerformanceEntry[] {
    return this.entries.filter(entry => entry.name === name);
  }

  /**
   * Get average duration for a specific measurement
   */
  getAverageDuration(name: string): number {
    const entries = this.getEntriesByName(name);
    if (entries.length === 0) return 0;
    
    const total = entries.reduce((sum, entry) => sum + entry.duration, 0);
    return total / entries.length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Log performance summary
   */
  logSummary(): void {
    const summary = this.entries.reduce((acc, entry) => {
      if (!acc[entry.name]) {
        acc[entry.name] = {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: -Infinity,
        };
      }

      const stat = acc[entry.name];
      stat.count++;
      stat.totalDuration += entry.duration;
      stat.minDuration = Math.min(stat.minDuration, entry.duration);
      stat.maxDuration = Math.max(stat.maxDuration, entry.duration);

      return acc;
    }, {} as Record<string, { count: number; totalDuration: number; minDuration: number; maxDuration: number }>);

    console.table(
      Object.entries(summary).map(([name, stats]) => ({
        name,
        count: stats.count,
        avg: (stats.totalDuration / stats.count).toFixed(2) + 'ms',
        min: stats.minDuration.toFixed(2) + 'ms',
        max: stats.maxDuration.toFixed(2) + 'ms',
      }))
    );
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * HOC to measure component render time
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const name = componentName || Component.displayName || Component.name || 'Component';

  const WrappedComponent = (props: P) => {
    performanceMonitor.mark(`${name}-render`);
    
    const result = React.createElement(Component, props);
    
    // Measure after render
    setTimeout(() => {
      performanceMonitor.measure(`${name}-render`);
    }, 0);

    return result;
  };

  return WrappedComponent;
}
