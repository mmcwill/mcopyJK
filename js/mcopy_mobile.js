$(document).ready(function () {

});

var mm = {};
mm.get = function (cmd) {
	var obj = {
		url : '/cmd/' + cmd,
		type : 'GET',
		success : function (data) {
			if (data.success) {
				mm.display(data);
			}
		}
	};
};