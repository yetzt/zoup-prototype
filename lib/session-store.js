// minimalistic session store with fixed nedb

const path = require("path");
const config = require("./config");
const db = require("./db");

module.exports = function(session){

	function store() {
		this.db = new db("session", { autoLoad: true });
		this.db.ensureIndex({ fieldName: 'expires' });
		this.db.remove({ 'data.cookie.expires': { $lt: new Date() }}, { multi: true });
	};

	store.prototype.__proto__ = session.Store.prototype;

	store.prototype.get = function(id, fn) {
		this.db.findOne({ _id: id }, function(err, session) {
			if (err) return fn(err);
			if (!session) return fn(null, null);
			fn(null, session.data);
		});
	};

	store.prototype.set = function(id, data, fn) {
		this.db.update({ _id: id }, { _id: id, data: data }, { multi: false, upsert: true }, fn);
	};

	store.prototype.destroy = function(id, fn) {
		this.db.remove({ _id: id }, { multi: false }, fn);
	};

	return new store();
	
};


