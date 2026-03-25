// src/utils/logger.ts

/**
 * Small logger utility for Truss.
 * Keeps logging in one place instead of calling console directly everywhere.
 */
export const logger = {
  isEnabled(): boolean {
    // All logger methods share the same DEBUG gate so CLI output stays quiet by default.
    return process.env.DEBUG === "true";
  },
  /**
   * General info messages.
   * Use for normal progress logs.
   */
  info(message: string): void {
    if (this.isEnabled()) {
      console.log(message);
    }
  },

  /**
   * Warning messages.
   * Use when something is unusual but not fatal.
   */
  warn(message: string): void {
    if (this.isEnabled()) {
      console.warn(message);
    }
  },

  /**
   * Error messages.
   * Use for failures and important problems.
   */
  error(message: string): void {
    if (this.isEnabled()) {
      console.error(message);
    }
  },

  /**
   * Debug messages.
   * Useful during development.
   * Can be turned on only when DEBUG=true.
   */
  debug(message: string): void {
    if (this.isEnabled()) {
      console.debug(message);
    }
  },
};
