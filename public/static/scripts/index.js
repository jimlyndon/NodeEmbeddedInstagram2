// initialize viewmodel for tweets, instagrams, etc.
var viewModel = {
    instagrams : ko.observableArray([]),
    tweets : ko.observableArray([]),
    endAnimation : function(model, evt) {
        $(evt.currentTarget).parent().removeClass('animating');
    }
};

ko.bindingHandlers.tweet = {
    update: function(element, valueAccessor, allBindingsAccessor) {
        // First get the latest data that we're bound to
        var value = valueAccessor(), allBindings = allBindingsAccessor();

        // Next, whether or not the supplied model property is observable, get its current value
        var valueUnwrapped = ko.utils.unwrapObservable(value); 

        $.each(valueUnwrapped, function(idx, oembed_id) {            
            var oembed_url = 'https://api.twitter.com/1/statuses/oembed.json?align=center&id=' + oembed_id;
            
            $.ajax({
              url: oembed_url,
              dataType: "jsonp",
              type: "GET"
            }).done(function (resp, status, xhr) {
                $(element).append("<div>" + resp.html + "</div>");
            });
        });
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