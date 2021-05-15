
const linvodb = require("linvodb3");
const leveldown = require("leveldown");
const config = require("./config");

linvodb.dbPath = config.get("datadir");

module.exports = linvodb;