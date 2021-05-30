$(function(){

	const $main = $('main');
	const template = $('#template-post').html();
	const base = $('base').attr('href');
	const $end = $('#end');

	// observe main width
	document.documentElement.style.setProperty('--main-width', $main.width()+"px");
	$(window).on('resize', function(){
		document.documentElement.style.setProperty('--main-width', $main.width()+"px");
	});
	
	// listen to websocket
	const listen = function(){
		const ws = new WebSocket(base.replace(/^http?/,'ws')+"stream.json");
		ws.addEventListener('message', function(event) {
			const post = JSON.parse(event.data);
			const rendered = Mustache.render(template, { base: base, ...post });
			
			// preserve scroll state
			const heightBefore = window.innerHeight;

			// replace or prepend
			if ($("#post-"+post.id).length === 1) {
				$("#post-"+post.id).replaceWith($(rendered));
			} else {
				$main.prepend($(rendered));
			}

			// restore scroll state
			window.scrollBy(0, window.innerHeight-heightBefore);

		});
		ws.addEventListener('open', function(event) {
			console.log("Websocket is open", ws);
		});
		ws.addEventListener('close', function(event) {
			setTimeout(listen,1000);
		});
	};
	listen();

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
					const rendered = $(Mustache.render(template, { base: base, zoup: base+'zoup', ...post }));
					$end.before(rendered);

					// FIXME: add all the magic events

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
	if ($end.attr("data-next-url")) observer.observe($end[0]);
	
});
