$(function(){
	
	// avatar
	const $avatar = $('form[action$=avatar]');
	$('input[type=file]', $avatar).on('input', function(e){
		const file = Array.from(this.files).shift();
		
		if (file.size > 10485760 || !["image/jpeg","image/png"].includes(file.type)) return;

		const reader = new FileReader();
		reader.addEventListener("load", function() {
			$("img", $avatar).attr('src', reader.result)
		}, false);
		reader.readAsDataURL(file);
	});
	
	$avatar.on('submit', function(e){
		e.preventDefault();

		$btn = $('button[type=submit]',this);
		
		$btn.html('Uploading <i class="icon-reload spin"></i>');
		
		// get form data from native api
		const data = new FormData(this);
		
		fetch('/api/settings/avatar', {
			method: 'POST',
			body: data
		}).then(function(resp){

			if (resp.status !== 200) {
				$btn.html('Failed <i class="icon-cross"></i>');
			} else {
				$btn.html('Saved <i class="icon-check"></i>');
				const result = resp.json();
				$("img", $avatar).attr('src', result.avatar);
			}

			setTimeout(function(){
				$btn.html('Save');
			},3000);
			
		}).catch(function(err){ 
			$btn.html('Failed <i class="icon-cross"></i> ');
			setTimeout(function(){
				$btn.html('Save');
			},3000);
			return;
		});
		
	});
	
	
	// description
	$('#description').on('submit', function(e){
		e.preventDefault();

		$btn = $('button[type=submit]',this);
		
		$btn.html('Updating <i class="icon-reload spin"></i>');
		
		fetch('/api/settings/description', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				description: $('textarea',this).val()
			})
		}).then(function(resp){

			if (resp.status !== 200) {
				$btn.html('Failed <i class="icon-cross"></i>');
			} else {
				$btn.html('Updated <i class="icon-check"></i>');
			}

			setTimeout(function(){
				$btn.html('Update');
			},3000);
			
		}).catch(function(err){ 
			$btn.html('Failed <i class="icon-cross"></i> ');
			setTimeout(function(){
				$btn.html('Update');
			},3000);
			return;
		});
		
	});
	
	
	// color
	const $color = $('form[action$=color]');
		
	$color.on('submit', function(e){
		e.preventDefault();

		$btn = $('button[type=submit]',this);
		$btn.html('Updating <i class="icon-reload spin"></i>');
		
		fetch('/api/settings/color', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				"main-color": $('#main-color').val(),
				"light-theme": ($('#theme-switch:checked').length===1)
			})
		}).then(function(resp){

			if (resp.status !== 200) {
				$btn.html('Failed <i class="icon-cross"></i>');
			} else {
				$btn.html('Updated <i class="icon-check"></i>');
			}

			setTimeout(function(){
				$btn.html('Update');
			},3000);
			
		}).catch(function(err){ 
			$btn.html('Failed <i class="icon-cross"></i> ');
			setTimeout(function(){
				$btn.html('Update');
			},3000);
			return;
		});
		
	});
	
});