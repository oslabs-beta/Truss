// src/utils/logger.ts

/**
 * Small logger utility for Truss.
 * Keeps logging in one place instead of calling console directly everywhere.
 */
export const logger = {
  /**
   * General info messages.
   * Use for normal progress logs.
   */
  info(message: string): void {
    console.log(message);
  },

  /**
   * Warning messages.
   * Use when something is unusual but not fatal.
   */
  warn(message: string): void {
    console.warn(message);
  },

  /**
   * Error messages.
   * Use for failures and important problems.
   */
  error(message: string): void {
    console.error(message);
  },

  /**
   * Debug messages.
   * Useful during development.
   * Can be turned on only when DEBUG=true.
   */
  debug(message: string): void {
    if (process.env.DEBUG === "true") {
      console.debug(message);
    }
  },
};