/* jsonpzip-init.js **************************************** */

new function () {
    var init = function () {
        JsonpZip.page = new JsonpZip.Page();
    };
	if ( window.jQuery && jQuery.fn && jQuery.fn.ready ) {
		jQuery.fn.ready( init );
	} else {
	    setTimeout( init, 0 );
	}
}

/* ********************************************************* */
