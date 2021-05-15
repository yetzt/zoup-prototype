
const linvodb = require("@yetzt/linvodb");
const leveldown = require("leveldown");
const config = require("./config");

linvodb.dbPath = config.get("datadir");

module.exports = linvodb;