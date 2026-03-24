"use strict";
// src/utils/logger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/**
 * Small logger utility for Truss.
 * Keeps logging in one place instead of calling console directly everywhere.
 */
exports.logger = {
    isEnabled() {
        return process.env.DEBUG === "true";
    },
    /**
     * General info messages.
     * Use for normal progress logs.
     */
    info(message) {
        if (this.isEnabled()) {
            console.log(message);
        }
    },
    /**
     * Warning messages.
     * Use when something is unusual but not fatal.
     */
    warn(message) {
        if (this.isEnabled()) {
            console.warn(message);
        }
    },
    /**
     * Error messages.
     * Use for failures and important problems.
     */
    error(message) {
        if (this.isEnabled()) {
            console.error(message);
        }
    },
    /**
     * Debug messages.
     * Useful during development.
     * Can be turned on only when DEBUG=true.
     */
    debug(message) {
        if (this.isEnabled()) {
            console.debug(message);
        }
    },
};
