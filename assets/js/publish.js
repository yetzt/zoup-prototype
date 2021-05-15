window.zoup = window.zoup || {};

window.zoup.publish = function(p,r){
	const root = p || $('body');
	const $html = $('html');
		
	// unfocus whatever is focussed
	$(document.activeElement).trigger("blur");

	// use paragraphs not divs
	document.execCommand("defaultParagraphSeparator", false, "p");
	
	// use mac modifier key
	const mac = (/^Mac/.test(navigator.platform) || /Macintosh/.test(navigator.appVersion) || /Mac OS/.test(navigator.appVersion) || /Mac OS/.test(navigator.oscpu));
	const modkey = (mac) ? "⌘" : "Ctrl+"
	
	const publish = $('<div class="z-publish-wrapper"><div class="z-publish"><form action="javascript:;" method="post" enctype="multipart/form-data"><input type="hidden" name="type" value="none"><div class="typeselect"><button class="text"><i class="icon-paragraph"></i><span>Just Text</span></button><button class="upload"><i class="icon-upload"></i><span>Upload Media</span></button><button class="link"><i class="icon-link"></i><span>External Link</span></button></div></form><p>You can paste or drag stuff in here. Press <kbd>'+modkey+'↵</kbd> to publish or <kbd>'+modkey+'Esc</kbd> to discard.</p></div></div>');
	const form = $('form',publish);

	if (r) $(".z-publish",publish).append($('<a href="javascript:;" class="escape" title="Close"><i class="icon-cross"></i></a>').on('click', function(e){
		e.preventDefault();
		escape();
	}));
	
	const uploads = [];
	
	form.on('submit', function(e){
		e.preventDefault();
		submit();
	});
	
	const submit = function(){
				
		// check if anything has been entered yet
		if ($("input[name=type]").val() === 'none') return;
		
		// get form data from native api
		const data = new FormData(form.get(0));

		// delete upload if uploads are captured
		if (uploads.length > 0) data.delete("upload");
		
		// treat contenteditable as inputs
		$('[contenteditable]', form).each(function(i,e){
			data.append($(e).attr('name')||'oops', $(e).html()); // FIXME
		});	
		
		uploads.forEach(function(u){
			if (u) data.append('upload', u);
		});
		
		/* debug
		let dataobj = {};
		for (let [key, value] of data) {
			if (dataobj[key] !== undefined) {
				if (!Array.isArray(dataobj[key])) {
					dataobj[key] = [dataobj[key]];
				}
				dataobj[key].push(value);
			} else {
				dataobj[key] = value;
			}
		}
		console.log("submit", dataobj);
		return;
		/* */
		
		// disable all buttons
		$("input, button", publish).attr("disabled",true);
		$("[contenteditable]", publish).removeAttr("contenteditable").attr("contentuneditable", true);
		const publishbtn = $("button.publish", publish);
		const publishbtn_backup = publishbtn.html();
		publishbtn.html('Publishing <i class="icon-reload spin"></i>');
		
		const fail = function(err){
			const error = $('<div class="error">Something went wrong.</div>');
			if (err) error.append('<span>'+err+'</span>');
			form.append(error);
			setTimeout(function(){ error.remove(); },5000);

			// re-enable buttons
			publishbtn.html(publishbtn_backup);
			$("input, button", publish).removeAttr("disabled");
			$("[contentuneditable]", publish).removeAttr("contentuneditable").attr("contenteditable", true);
		};
		
		fetch('/api/publish', {
			method: 'POST',
			body: data
		}).then(function(resp){
			if (resp.status !== 201) return fail();

			// undo all listenres
			$html.off("drop", drophandler);
			$html.off("paste", pastehandler);
			$html.off("dragover", prevent);
			$(document).off('keydown', keyhandler);
			
			publishbtn.html('Published <i class="icon-check"></i>');
			if (r) {
				setTimeout(function(){ escape(); },1000);
			} else {
				resp.json().then(function(post){
					location.href = post.url;
				}).catch(function(){
					escape();
				});
			}

		}).catch(function(err){ // error
			fail();
		});
		
	};
	
	const addfiles = function(f){

		const upl = $('.upload', publish);
		const input = $('input[type=file]', upl);
		
		Array.from(f).map(function(file){
			const n = uploads.push(file);

			const preview = $('<div class="preview"><span></span></div>')
			$('span', preview).text(file.name+" ("+filesize(file.size)+")");

			const reader = new FileReader();

			// don't do that for files > 10mb
			if (file.size < 10485760) switch (file.type) {
				case "image/jpeg":
				case "image/jpg":
				case "image/png":
				case "image/gif":
				case "image/webp":
					
					reader.addEventListener("load", function() {
						const img = $('<img>');
						img.attr('src', reader.result);
						preview.prepend(img);
					}, false);
					if (file) reader.readAsDataURL(file);
					
				break;
				case "video/ogg":
				case "video/mpeg":
				case "video/mp4":
				case "video/webm":

					reader.addEventListener("load", function() {
						const video = $('<video controls></video>');
						video.attr('type', file.type);
						video.attr('src', reader.result);
						preview.prepend(video);
					}, false);
					if (file) reader.readAsDataURL(file);

				break;
				case "audio/aac":
				case "audio/flac": 
				case "audio/mp3": 
				case "audio/mp4": 
				case "audio/mpeg": 
				case "audio/ogg": 
				case "audio/wav": 
				case "audio/webm": 
					
					reader.addEventListener("load", function() {

						const audio = $('<audio controls></audio>');
						audio.attr('type', file.type);
						audio.attr('src', reader.result);
						preview.prepend(audio);
					}, false);
					if (file) reader.readAsDataURL(file);
					
				break;
				
				default: 
					// boring file listing
					// FIXME: placeholder?
				break;
			}
			
			const remove = $('<a><i class="icon-cross"></i></a>');
			remove.on('click', function(){
				preview.remove();
				uploads[(n-1)] = undefined;
			});
			preview.append(remove);
			upl.append(preview);
			
		});

		// add in here
		$('.pick', upl).text('Pick another file').remove().appendTo(upl).on('click', function(e){
			e.preventDefault();
			input.trigger('click');
		});
		
	};
	
	const handle_link = function(url, title){
		switch ($("input[name=type]").val()) {
			case "none":
				$('button.link', publish).trigger('click');
			case "link":
				$('input[type=url]', publish).val(url);
				if (title) {
					$('button.caption', publish).trigger('click');
					$('[contenteditable]', publish).text(title);
				}
			break;
			default: 
				if (title) {
					handle_text($('<a href="'+url+'">'+title+'</a>').html());
				} else {
					handle_text(url)
				}
			break;
		}
	};
	
	const handle_text = function(text){
		switch ($("input[name=type]").val()) {
			case "none":
				$('button.text', publish).trigger('click');
			case "text":
				$('[contenteditable]', publish).html($('[contenteditable]', publish).html()+text);
			break;
			default:
				$('button.caption', publish).trigger('click');
				$('[contenteditable]', publish).html($('[contenteditable]', publish).html()+text);
			break;
		}
	};

	const handle_files = function(files){
		switch ($("input[name=type]").val()) {
			case "none":
				$('button.upload', publish).trigger('click');
			case "upload":
				addfiles(files);
			break;
			default:
				// uhm, no idea?
			break;
		}
	};

	const handle = function(t, e){
		
		const types = Array.from(t.types) || [];
		
		// detect links
		if (types.includes('text/uri-list') || types.includes('text/x-moz-url')) {
			
			// get first url and handle it;
			Array.from(t.items).find(function(itm){ return ["text/uri-list","text/x-moz-url"].includes(itm.type); }).getAsString(function(url){
				handle_link.apply(null, url.split(/\n/))
			});
			
			e.preventDefault();
			return;

		}
		
		// get files
		if (t.files && t.files.length > 0) {
			handle_files(t.files);
			e.preventDefault();
			return;
		}
		
		// images etc? FIXME check browsers
		
		// html
		if (types.includes("text/html")) {
			handle_text(t.getData("text/html"));
			e.preventDefault();
			return;
		}
		
		// FIXME: text/rtf
		
		// check text for url
		if (types.includes("text/plain")) {

			const text = t.getData("text/plain");

			// detect url
			if (/^https?:\/\/[^\s\t\n\r]+$/.test(text)) {
				handle_link(text);
			} else {
				handle_text(text.split(/\n\n/g).map(function(p){
					return '<div>'+(p.trim().replace(/\n/g,'<br>\n'))+'</div>';
				}).join('\n'));
			}

			e.preventDefault();
			return;
		}
		
	}
	
	const pastehandler = function(e){
		if ($(document.activeElement).is("input") || $(document.activeElement).is("[contenteditable]")) return; // ignore natural paste targets
		handle(e.clipboardData, e);
	};

	const drophandler = function(e){
		handle(e.dataTransfer, e);
	};

	const prevent = function(e){
		event.preventDefault();
	};
	
	$html.on("drop", drophandler);
	$html.on("paste", pastehandler);
	$html.on("dragover", prevent);
		
	$(".typeselect button", publish).one("click", function(evt){
		const type = $(this).attr('class');
		
		$("input[name=type]").val(type);
		
		switch (type) {
			case "text":

				const txt = $('<div class="text" name="html" contenteditable><p></p></div>');
				txt[0].designMode = "On";
				$(".typeselect").after(txt);
				txt.trigger('focus');

			break;
			case "link":
				
				const lnk = $('<div class="link media"><input type="url" name="link" placeholder="URL goes here"></div>');
				$(".typeselect").after(lnk);
				const lnkinput = $('input',lnk);
				lnkinput.trigger('focus');
				lnkinput.on('keydown', function(evt){
					if (evt.key === "Enter") {
						evt.preventDefault();
						lnkinput.trigger('blur');
						if ($('[contenteditable]', publish).length > 0) {
							$('[contenteditable]', publish).trigger('focus');
						}
					}
				});
			break;
			case "upload":

				const upl = $('<div class="upload media"><input type="file" name="upload" multiple><button class="pick">Pick a file</button></div>');
				const input = $('input[type=file]', upl);
				
				input.on('input', function(evt){

					// put in files
					addfiles(input[0].files)
					
					// reset file input
					input.attr('type', 'none').val('').attr('type', 'file');
					
				});

				$('.pick', upl).on('click', function(e){
					e.preventDefault();
					input.trigger('click');
				});

				// add
				input.hide();
				$(".typeselect").after(upl);
				if (evt.isTrusted) input.trigger('click');

			break;
		}
				
		// add action bar
		const action = $('<div class="action"><div class="add"><button class="title"><i class="icon-plus"></i> title</button><button class="caption"><i class="icon-plus"></i> caption</button><button class="tags"><i class="icon-tag"></i> tags</button></div><button class="publish">publish <i class="icon-check"></i></button></div>');
		if (type === "text") $('button.caption',action).remove();

		const tagsbtn = $("button.tags", action);
		tagsbtn.on('click', function(){
			
			// add in tags FIXME replace with something nicer
			const tags = $('<div class="tags"><input type="text" name="tags" placeholder="tags"></div>');
			tags.insertBefore(action);
			
			new zoup.tags({
				selector: $("input", tags).get(0), // '.tags input',
				duplicate : false,
			});
			
			// remove button
			tagsbtn.remove();
			
		});
		
		const titlebtn = $("button.title", action);
		titlebtn.on('click', function(){
			
			// add in title FIXME replace with something nicer
			const title = $('<div class="title"><input type="text" placeholder="title" name="title"></div>');
			action.parent().prepend(title);
			
			const titleinput = $('input',title);
			
			titleinput.trigger('focus');
			titleinput.on('keydown', function(evt){
				if (evt.key === "Enter") {
					evt.preventDefault();
					titleinput.trigger('blur');
					$('[contenteditable]', publish).trigger('focus');
				}
			});
			
			// remove button
			titlebtn.remove();
			
		});

		const captionbtn = $("button.caption", action);
		captionbtn.on('click', function(){
			
			const cptn = $('<div class="text" name="caption" contenteditable><p></p></div>');
			$(".media").after(cptn); // where?
			cptn.trigger('focus');
			
			// remove button
			captionbtn.remove();
			
		});

		const publishbtn = $("button.publish", action);
		publishbtn.on('click', function(e){
			e.preventDefault();
			submit();
		});

		$(".typeselect").parent().append(action);
		$('.typeselect').remove();

	});
	
	if (r) $('html').addClass("publish");
	root[(r?"prepend":"append")](publish);

	const escape = function(){
		// disable handlers and remove publish
		$(document).off('keyup', keyhandler);
		$html.off("drop", drophandler);
		$html.off("paste", pastehandler);
		$html.off("dragover", prevent);
		publish.remove();
		$html.removeClass("publish");
	};
	
	const keyhandler = function(k){
		// check for mod key
		if (mac && !k.metaKey || !mac && !k.ctrlKey) return;
		switch (k.key) {
			case "Enter":
			case "Return":
				submit();
			break;
			case "Escape":
				escape();
			break;
		}
	};
	
	$(document).on('keydown', keyhandler);
		
};

// hijack publish button
$(function(){
	$('#publish').on('click', function(e){
		e.preventDefault();
		zoup.publish($('body'),true);
	});	
});

