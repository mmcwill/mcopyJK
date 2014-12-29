$(document).ready(function () {

});

var socket = io.connect();
socket.on('message', function (data) {
	$('body').html('<pre>' + JSON.stringify(data.state) ;+ '</pre>');
});