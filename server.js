/*

    Instagram real-time updates demo app.

*/


var url = require('url'),
  redis = require('redis'),
  settings = require('./settings'),
  helpers = require('./helpers'),
  subscriptions = require('./subscriptions');

var app = settings.app;

app.get('/callbacks/geo/:geoName', function(request, response){
    // The GET callback for each subscription verification.
  helpers.debug("GET " + request.url); 
  var params = url.parse(request.url, true).query;
  response.send(params['hub.challenge'] || 'No hub.challenge present');
});

app.post('/callbacks/geo/:geoName', function(request, response){
  helpers.debug("PUT /callbacks/geo/");

  response.send('OK');
});

// Render the home page
app.get('/', function(request, response){
  helpers.getMedia(function(error, media){
  response.render('geo.jade', {
        locals: { images: media }
    });
  });
});

app.listen(settings.appPort);
