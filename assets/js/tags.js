// adapted from https://github.com/iamqamarali/vanilla-tags-input
(function(factory) {
	window.zoup = window.zoup || {};
	window.zoup.tags = factory();
})(function() {
	"use strict"

	// Plugin Constructor
	var TagsInput = function(opts) {
		this.options = Object.assign(TagsInput.defaults, opts);
		this.init();
	}

	// Initialize the plugin
	TagsInput.prototype.init = function(opts) {
		this.options = opts ? Object.assign(this.options, opts) : this.options;

		if (this.initialized) this.destroy();

		if (!(this.orignal_input = (typeof this.options.selector === 'string') ? document.querySelector(this.options.selector) : this.options.selector)) {
			return this;
		}

		this.arr = [];
		this.wrapper = this.orignal_input.parentNode;
		this.input = document.createElement('input');
		this.input.placeholder="+ tag";
		this.input.className="add-tag";
		init(this);
		initEvents(this);

		this.initialized = true;
		this.input.focus();
		return this;
	};

	// Add Tags
	TagsInput.prototype.addTag = function(string) {

		string = (string||"").toLowerCase().replace(/,/g,'').trim();
		if (!string) return;

		if (this.anyErrors(string)) return;

		this.arr.push(string);
		var tagInput = this;

		var tag = document.createElement('span');
		tag.className = this.options.tagClass;
		tag.innerText = string;

		var icon = document.createElement('i');
		icon.className = 'icon-tag';
		tag.prepend(icon);
		//tag.appendChild(icon);


		var closeIcon = document.createElement('a');
		closeIcon.innerHTML = '&times;';

		// delete the tag when icon is clicked
		tag.addEventListener('click', function(e) {
			e.preventDefault();
			for (var i = 0; i < tagInput.wrapper.childNodes.length; i++) {
				if (tagInput.wrapper.childNodes[i] == tag) tagInput.deleteTag(tag, i);
			}
		});

		tag.appendChild(closeIcon);
		this.wrapper.insertBefore(tag, this.input);
		this.orignal_input.value = this.arr.join(',');

		return this;
	};

	// Delete Tags
	TagsInput.prototype.deleteTag = function(tag, i) {
		tag.remove();
		this.arr.splice(i, 1);
		this.orignal_input.value = this.arr.join(',');
		return this;
	};

	// Make sure input string have no error with the plugin
	TagsInput.prototype.anyErrors = function(string) {
		return ((this.options.max != null && this.arr.length >= this.options.max) || (!this.options.duplicate && this.arr.indexOf(string) != -1));
	};

	// Add tags programmatically
	TagsInput.prototype.addData = function(array) {
		var plugin = this;

		array.forEach(function(string) {
			plugin.addTag(string);
		})
		return this;
	};

	// Get the Input String
	TagsInput.prototype.getInputString = function() {
		return this.arr.join(',');
	};
	
	// destroy the plugin
	TagsInput.prototype.destroy = function() {
		this.orignal_input.removeAttribute('hidden');

		delete this.orignal_input;
		var self = this;

		Object.keys(this).forEach(function(key) {
			if (self[key] instanceof HTMLElement) self[key].remove();
			if (key != 'options') delete self[key];
		});

		this.initialized = false;
	};

	// Private function to initialize the tag input plugin
	function init(tags) {
		tags.wrapper.append(tags.input);
		tags.orignal_input.setAttribute('hidden', 'true');
		// tags.orignal_input.parentNode.insertBefore(tags.wrapper, tags.orignal_input);
	};

	// initialize the Events
	function initEvents(tags) {
		tags.wrapper.addEventListener('click', function() {
			tags.input.focus();
		});
		tags.input.addEventListener('keydown', function(e) {
			if (e.altKey || e.shiftKey || e.ctrlKey) return;
			var str = tags.input.value.trim().toLowerCase();
			if (str && !!(~[9, 13, 188].indexOf(e.keyCode))) {
				e.preventDefault();
				tags.input.value = "";
				if (str != "") tags.addTag(str);
			}

		});
	};
	
	// Set All the Default Values
	TagsInput.defaults = {
		selector: '',
		tagClass: 'tag',
		max: null,
		duplicate: false
	}

	return TagsInput;
});
