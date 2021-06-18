$(function(){

	const $main = $('main');
	const template = $('#template-post').html();
	const base = $('base').attr('href');
	const $end = $('#end');
	const auth = $('#logout').length > 0;

	// observe main width
	document.documentElement.style.setProperty('--main-width', $main.width()+"px");
	$(window).on('resize', function(){
		document.documentElement.style.setProperty('--main-width', $main.width()+"px");
	});
	
	// listen to websocket
	const listen = function(){
		const ws = new WebSocket(base.replace(/^http?/,'ws')+"stream.json");
		ws.addEventListener('message', function(event) {
			const data = JSON.parse(event.data);
			
			switch (data.event) {
				case "publish":
				case "republish":
			
					const rendered = Mustache.render(template, { base: base, auth: auth, zoup: base+'zoup', ...data });
			
					// preserve scroll state
					const heightBefore = window.innerHeight;

					// replace or prepend
					if ($("#post-"+data.id).length === 1) {
						$("#post-"+data.id).replaceWith($(rendered));
					} else {
						$main.prepend($(rendered));
					}

					// restore scroll state
					window.scrollBy(0, window.innerHeight-heightBefore);
					
				break;
				case "unpublish":

					const $post = $("#post-"+data.id);

					if ($post.length === 1) {

						console.log("removing post "+data.id);

						// preserve scroll state
						const heightBefore = window.innerHeight;

						// ckeck if post is atop scroll position
						const scrollAfter = ($post.get(0).offsetTop < window.scrollY)

						if (scrollAfter) console.log("adjust scroll position");
						else console.log("stay put");

						// remove
						$post.remove();

						// restore scroll state
						if (scrollAfter) window.scrollBy(0, window.innerHeight-heightBefore);

					}

				break;
			}
			
		});
		ws.addEventListener('open', function(event) {
			console.log("Websocket is open", ws);
		});
		ws.addEventListener('close', function(event) {
			setTimeout(listen,1000);
		});
	};
	if ($end.length > 0) listen();

	// intersection observer for end element
	const observer = new IntersectionObserver(function(entries, observer){
		const event = entries.find(function(entry){
			return entry.target === $end[0];
		});
		if (!event || !event.isIntersecting) return;

		// ignore intersections
		observer.unobserve(event.target);
		
		const before = $end.attr("data-before");
		const next_url = $end.attr("data-next-url");

		$end.attr('data-before', null);
		$end.attr('data-next-url', null);

		if (!before) {
			$end.text("This is the end.");
			return;
		}
		
		$end.html('<i class="icon-spinner spin"></i> Loading <a href="'+base+'?before='+before+'">more posts</a>');
		
		fetch(next_url).then(function(response){
			if (!response.ok) return $end.html('Could not load <a href="'+base+'?before='+before+'">more posts</a> #2'); //FIXME try again after a while
			
			response.json().then(function(feed){

				feed.items.forEach(function(post){
					const rendered = $(Mustache.render(template, { base: base, auth: auth, zoup: base+'zoup', ...post }));

					// add button handlers
					$('button.remove', rendered).on('click', removehandler);

					$end.before(rendered);
				});
				
				// fix up the end
				if (feed.next_url) {

					feed.before = (new URL(feed.next_url).searchParams.get("before"));

					$end.attr("data-next-url", feed.next_url);
					$end.attr("data-before", feed-before);
					$end.html('<a href="{{base}}/?before='+feed.before+'">Load more Posts</a>');
					
					// observe again
					observer.observe(event.target);
					
				} else {
					$end.text("This is the end.");
				}

			}).catch(function(err){
				$end.html('Could not load <a href="'+base+'?before='+before+'">more posts</a> #3'); //FIXME try again after a while
			});
			
			
		}).catch(function(err){
			$end.html('Could not load <a href="'+base+'?before='+before+'">more posts</a> #4'); //FIXME try again after a while
		});
		
	}, {
		rootMargin: '0px 0px 5000px 0px',
		threshold: 0
	});
	
	// observe the end if not nigh
	if ($end.length > 0 && $end.attr("data-next-url")) observer.observe($end[0]);
	
	// remove post
	const removehandler = function(evt){
		evt.preventDefault();
		
		const $btn = $(this);
		$btn.parent().children().hide();

		$question = $('<label>You sure?</label>');
		$yesbtn = $('<button><i class="icon-delete" title="remove"></i> Remove it</button>');
		$nobtn = $('<button><i class="icon-cross" title="remove"></i> Keep it</button>');

		$yesbtn.on('click', function(){

			fetch('/api/unpublish', {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					"id": $btn.attr("data-id")
				})
			}).then(function(resp){
				if (resp.status === 200) {
					$btn.parents('article').remove();
				} else {
					$question.remove();
					$nobtn.remove();
					$yesbtn.remove();
					$fail = $('<label><i class="icon-warning"></i> Post could not be removed.</label>');
					$btn.parent().append($fail);
					setTimeout(function(){
						$fail.remove();
						$btn.parent().children().show();
					},3000);
				}
			
			}).catch(function(err){ 
				$question.remove();
				$nobtn.remove();
				$yesbtn.remove();
				$fail = $('<label><i class="icon-warning"></i> Post could not be removed.</label>');
				$btn.parent().append($fail);
				setTimeout(function(){
					$fail.remove();
					$btn.parent().children().show();
				},3000);
			});
			
		});

		$nobtn.on('click', function(){
			$question.remove();
			$nobtn.remove();
			$yesbtn.remove();
			$btn.parent().children().show();
		});

		$btn.parent().append($question).append($yesbtn).append($nobtn);
	};

	$('button.remove').on('click', removehandler);
	
	// 
	window.addEventListener("message", function(e){

		// adjust tumblr iframe height
		if (e.origin === "https://embed.tumblr.com" && typeof e.data === "object" && e.data.type === "embed-size" && e.data.height) {
			const iframe = Array.from($('iframe[src^="'+e.origin+'"]')).find(function(i){
				return (i.contentWindow === e.source)
			});
			if (iframe) {
				const $iframe = $(iframe);
				$iframe.attr("height", e.data.height);
				$iframe.attr("style", "height: "+e.data.height+"px !important; max-height: "+e.data.height+"px !important");
				// $iframe.css({ height: e.data.height+"px !important", "max-height": e.data.height+"px !important" });
			}
		}

	}, false);
	
});
