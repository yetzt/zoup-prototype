#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const conf = require("conf");
const prompts = require("prompts");
const zxcvbn = require("zxcvbn");
const color = require("kleur");
const chalk = require("chalk");
const pure = require("pure-color");
const bcrypt = require("bcryptjs");
const resolve = require("resolve-global").silent;
const exec = require("child_process").exec;

const validateurl = require("../lib/validate-url");
const password = require("../lib/password");

const homedir = path.resolve(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']);

const config = new conf();

(async function(){

	console.log(color.bold("Let's set up your zoup."));

	// look for process managers
	const pm = [{ title: "Nope.", value: null }, ...["pm2","forever","nodemon",].map(function(m){
		const installed = !!resolve(m);
		return { title: ((!installed)?"Install and use":"Use")+" '"+m+"'"+(m==="nodemon"?" (for development)":"") , value: m, sort: (installed)?0:1 };
	}).sort(function(a,b){
		return a.sort-b.sort;
	})];

	// prompts.override(config.store);
	const data = await prompts([{
		type: 'text',
		name: 'username',
		initial: config.get('username')||'',
		message: 'Username',
		validate: function(v){
			return (v.length > 0) ? true : "Please type something.";
		}
	},{
		type: 'select',
		name: 'password',
		message: 'I want to',
		initial: false,
		choices: [{
			title: "keep the current password", "value": null,
		},{
			title: 'type in my own secure password', "value": true,
		},{
			title: 'get a secure random password', "value": false,
		}].filter(function(c){
			return (c.value !== null || !!config.get('password'));
		}),
	},{
		type: function(p,c){ return (c.password) ? 'password' : null; },
		name: 'password',
		initial: '',
		message: 'Password',
		validate: function(v){
			if (!this.hasOwnProperty("tries") || this.tries > 5) this.tries=0;
			const zx = zxcvbn(v);
			return (v.length === 0 || zx.score >= 4) ? true : (++this.tries > 3) ? "You can leave it blank if you want a secure random password instead" : "This password can be cracked in "+(zx.crack_times_display.offline_fast_hashing_1e10_per_second)+".";
		}
	},{
		type: 'text',
		name: 'title',
		initial: config.get('title')||function(p,c){
			return "The zoup of "+c.username;
		},
		message: 'A title',
	},{
		type: 'text',
		name: 'main-color',
		initial: config.get('main-color')||function(p,c){
			return pure.convert.rgb.hex(pure.convert.xyz.rgb(pure.convert.lab.xyz(pure.convert.lch.lab([ 47, 69, (Math.random()*360) ]))));
		},
		message: 'The main theme color',
		format: function(v){
			v = v.replace(/^#/,'').toLowerCase().replace(/[^a-f0-9]/g,'0');
			v = (v.length <= 3) ? (v[0]||"0")+(v[0]||"0")+(v[1]||"0")+(v[1]||"0")+(v[2]||"0")+(v[2]||"0") : (v[0]||"0")+(v[1]||"0")+(v[2]||"0")+(v[3]||"0")+(v[4]||"0")+(v[5]||"0");
			v = "#"+v;
			return v;
		},
		validate: function(v){
			if (!/^#[0-9a-f]{6}$/.test(v)) return ("This needs to be a hex color: #RRGGBB");
			return true;
		},
		onRender: function() {
			let c = (this._value||this.initial);
			c = c.replace(/^#/,'').toLowerCase().replace(/[^a-f0-9]/g);
			if (c.length === 0 || c.length%3 !== 0) return;
			if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
			c = "#"+c;
			this.msg = chalk.hex(c)(this.msg);
		},
		onState: function() {
			let c = (this._value||this.initial);
			c = c.replace(/^#/,'').toLowerCase().replace(/[^a-f0-9]/g);
			if (c.length === 0 || c.length%3 !== 0) return;
			if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
			c = "#"+c;
			this.rendered = chalk.hex(c).inverse(this.rendered);
		}
	},{
		type: 'toggle',
		name: 'light-theme',
		message: 'Theme',
		initial: false,
		active: 'Light',
		inactive: 'Dark'
	},{
		type: 'text',
		name: 'datadir',
		initial: config.get('datadir')||path.resolve(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'], 'zoup'),
		message: 'Data directory',
	},{
		type: 'select',
		name: 'listen',
		message: 'Recieve connections on a',
		choices: [{
			title: "TCP port", value: "port",
		},{
			title: "Socket", value: "socket",
		}],
		initial: function(p,c){
			return config.get('listen')==="socket"?1:0;
		},
	},{
		type: function(p,c){ return (c.listen === "socket") ? 'text' : null; },
		name: 'socket',
		initial: config.get('socket')||function(p,c){
			return path.resolve(c.datadir, "zoup.socket");
		},
		message: 'Socket',
	},{
		type: function(p,c){ return (c.listen === "port") ? 'text' : null; },
		name: 'hostname',
		initial: config.get('hostname')||'localhost',
		message: 'Hostname',
	},{
		type: function(p,c){ return (c.listen === "port") ? 'number' : null; },
		name: 'port',
		float: false,
		min: 1,
		max: 65535,
		initial: config.get('port')||8000,
		message: 'Port',
	},{
		type: 'text',
		name: 'url',
		initial: config.get('url')||function(p,c){
			return (c.listen === "port") ? ((c.port===443)?"https":"http")+"://"+(c.hostname||"localhost")+((c.port===80||c.port===443)?"":(":"+c.port))+"/" : "https://zoup.example.org/";
		},
		message: 'Your external URL',
		validate: validateurl,
		format: function(v){
			const u = new URL(v);
			u.hash = "";
			u.search = "";
			u.username = "";
			u.password = "";
			u.searchParams = "";
			u.pathname = u.pathname.replace(/\/$/,'')+'/';
			return u.toString().replace(/\/$/,'')+'/';
		}
	},{
		type: 'select',
		name: 'pm',
		message: 'Want to use a process manager to run zoup as a deamon?',
		choices: pm,
		initial: Math.max(0,pm.findIndex(function(v){
			return v.value === config.get("pm")
		})),
	}]);

	if (data.password === null) { // keep the password
		data.password = config.get('password');
	} else {
		if (data.password === '' || data.password === false) { // autogenerate password
			data.password = password(23);
			console.log(color.bold("Your autogenerated password is: %s"), color.red(data.password));
			console.log(color.bold("Better put that in your password manager."));
		}
		data.password = bcrypt.hashSync(data.password, 12);
	} 

	(function(next){
		// install process manager
		if (!data.pm || !!resolve(data.pm)) return next();
		console.log(color.bold("%s npm install -g %s"), color.green(">"), color.cyan(data.pm));
		const cmd = exec("npm install -g "+data.pm, next);
		cmd.stdout.on('data', function(d){ console.log("%s %s", color.green("npm>"), d); });
		cmd.stderr.on('data', function(d){ console.error("%s %s", color.red("npm>"), d); });
	})(function(){
		
		config.set(data);

		// generate session secret
		if (!config.get('secret')) config.set('secret',password(32));

		// mark as configured
		config.set('configured', true);

		console.log(color.bold("Ready to go. %s"), color.magenta("<3"));
	});

})();

