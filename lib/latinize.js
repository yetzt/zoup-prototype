const latinize = require("latinize");
latinize.characters = { ...latinize.characters, "ä": "ae", "ö": "oe", "ü": "ue", "ß": "sz" };

module.exports = latinize;