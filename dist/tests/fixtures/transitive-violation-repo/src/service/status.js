"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceStatus = void 0;
const client_1 = require("../db/client");
exports.serviceStatus = client_1.db.connected;
