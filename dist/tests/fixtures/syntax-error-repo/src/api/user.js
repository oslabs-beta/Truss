"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUser = getUser;
const client_1 = require("../db/client");
function getUser(id) {
    return (0, client_1.query)(`SELECT * FROM users WHERE id = '${id}'`);
}
