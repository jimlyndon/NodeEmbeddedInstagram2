var redis = require('redis'),
    fs = require('fs'),
    jade = require('jade'),
    io = require('socket.io');
    


    // Heroku won't actually allow us to use WebSockets
    // so we have to setup polling instead.
    // https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
    io.configure(function () {
      io.set("transports", ["xhr-polling"]);
      io.set("polling duration", 10);
    });
    
    
    var settings = require('./settings'),
    helpers = require('./helpers'),
    app = settings.app,
    subscriptionPattern = 'channel:*',
    socket = io.listen(app);
    
    
// We use Redis's pattern subscribe command to listen for signals
// notifying us of new updates.
var rtg   = require("url").parse(settings.REDISTOGO_URL);
var redisClient = redis.createClient(rtg.port, rtg.hostname);
redisClient.auth(rtg.auth.split(":")[1]);
var pubSubClient = redis.createClient(rtg.port, rtg.hostname);
pubSubClient.auth(rtg.auth.split(":")[1]);
//var redisClient = redis.createClient(settings.REDIS_PORT, settings.REDIS_HOST);
//var pubSubClient = redis.createClient(settings.REDIS_PORT, settings.REDIS_HOST);

pubSubClient.psubscribe(subscriptionPattern);

pubSubClient.on('pmessage', function(pattern, channel, message){
  helpers.debug("Handling pmessage: " + message);

  /* Every time we receive a message, we check to see if it matches
     the subscription pattern. If it does, then go ahead and parse it. */

  if(pattern == subscriptionPattern){
      try {
        var data = JSON.parse(message)['data'];
        
        // Channel name is really just a 'humanized' version of a slug
        // san-francisco turns into san francisco. Nothing fancy, just
        // works.
        var channelName = channel.split(':')[1].replace(/-/g, ' ');
      } catch (e) {
          return;
      }
    
    // Store individual media JSON for retrieval by homepage later
    for(index in data){
        var media = data[index];
        media.meta = {};
        media.meta.location = channelName;
        redisClient.lpush('media:objects', JSON.stringify(media));
    }
    
    // Send out whole update to the listeners
    var update = {
      'type': 'newMedia',
      'media': data,
      'channelName': channelName
    };
    for(sessionId in socket.clients){
      socket.clients[sessionId].send(JSON.stringify(update));
    }
  }
});
