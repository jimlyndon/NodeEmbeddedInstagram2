// initialize viewmodel for tweets, instagrams, etc.
var viewModel = {
    instagrams : ko.observableArray([]),
    tweets : ko.observableArray([]),
    endAnimation : function(model, evt){
        $(evt.currentTarget).parent().removeClass('animating');
    }
};

$(function () {
    ko.applyBindings(viewModel);
});

// on initial page load
// replace {} with { id:1234 } to specify starting point
$.post('/instagrams', {}, function(data) {
    $.each(data, function(idx, obj) {
        viewModel.instagrams.push(obj);
    });
}, 'json');

// replace {} with { id:1234 } to specify starting point
$.post('/tweets', {}, function(data) {
    $.each(data, function(idx, obj) {
        viewModel.tweets.push(obj);
    });
}, 'json');

// start socket.io
var socket = io.connect(window.location.hostname);
// on every server message from socket.io
socket.on('message', function(update){ 
    var data = $.parseJSON(update);
    $.each(data.media, function(idx, obj) {
        viewModel.instagrams.push(obj);
    });
});