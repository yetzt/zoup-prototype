$(function(){
	
	const template = $('#template-subscription').html();
	
	// add subscription
	const $subscribe = $('form[action$="/subscriptions"]');
	
	$subscribe.on('submit', function(e){
		e.preventDefault();
		$('.error', $subscribe).remove();

		const $btn = $('button[type=submit]',this);
		$btn.html('<i class="icon-reload spin"></i> Subscribing');
				
		fetch('/api/subscriptions/follow', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				"feed": $('input[name=feed]',$subscribe).val(),
			}),
		}).then(function(resp){

			if (resp.status !== 200) {
				$btn.html('<i class="icon-cross"></i> Failed');
				
				resp.json().then(function(result){
					const $error = $('<div class="error">Error.</div>');
					$error.text(result.error);
					$subscribe.append($error);
					setTimeout(function(){
						$error.remove();
					},3000);
				});
				
			} else {
				$('input[name=feed]',$subscribe).val('');
				$btn.html('<i class="icon-check"></i> Subscribed');
				resp.json().then(function(data){

					// add to list
					const rendered = $(Mustache.render(template, { base: $('base').attr('href'), ...data }));
					$('button.unsubscribe', rendered).on('click', unsubscribe);
					$('#subscriptions').prepend(rendered);
					
				});
			}

			setTimeout(function(){
				$btn.html('<i class="icon-plus"></i> Subscribe');
			},3000);
			
		}).catch(function(err){ 
			$btn.html('<i class="icon-cross"></i> Failed');
			setTimeout(function(){
				$btn.html('<i class="icon-plus"></i> Subscribe');
			},3000);
			return;
		});
		
	});
	
	const unsubscribe = function(e){
		e.preventDefault();
		const $btn = $(this);
		
		fetch('/api/subscriptions/unfollow', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				"feed": $btn.attr("data-feed"),
			}),
		}).then(function(resp){

			if (resp.status !== 200) {
				$btn.html('<i class="icon-cross"></i> Failed');
				setTimeout(function(){
					$btn.html('<i class="icon-cross"></i> Unsubscribe');
				},3000);
			} else {
				$btn.parents('.subscription').remove();
			}

		}).catch(function(err){ 
			$btn.html('<i class="icon-cross"></i> Failed');
			setTimeout(function(){
				$btn.html('<i class="icon-cross"></i> Unsubscribe');
			},3000);
			return;
		});
		
	};
	
	$('button.unsubscribe').on('click', unsubscribe);

});