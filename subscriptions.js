var redis = require('redis'),
    fs = require('fs'),
    jade = require('jade'),
    io = require('socket.io'),
    settings = require('./settings'),
    helpers = require('./helpers'),
    app = settings.app,
    subscriptionPattern = 'channel:*',
    socket = io.listen(app);

// Heroku won't actually allow us to use WebSockets so we have to setup polling instead, unless deploying on a different host
// https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
socket.configure(function () {
  socket.set("transports", ["xhr-polling"]);
  socket.set("polling duration", 10);
});
    
    
// We use Redis's pattern subscribe command to listen for signals notifying us of new updates.
// REDISTOGO_URL if using heroku's redis_to_go addon.  Otherwise using REDIS_PORT/REDIS_HOST instead
var rtg   = require("url").parse(settings.REDISTOGO_URL),
redisClient = redis.createClient(rtg.port, rtg.hostname),
pubSubClient = redis.createClient(rtg.port, rtg.hostname);

if(!!rtg.auth) {
  redisClient.auth(rtg.auth.split(":")[1]);
  pubSubClient.auth(rtg.auth.split(":")[1]);
}
//var redisClient = redis.createClient(settings.REDIS_PORT, settings.REDIS_HOST);
//var pubSubClient = redis.createClient(settings.REDIS_PORT, settings.REDIS_HOST);



// subscribe to a pattern
pubSubClient.psubscribe(subscriptionPattern);

// register a callback function that will be executed when a message is received from redis
pubSubClient.on('pmessage', function(pattern, channel, message) {
  //helpers.debug("Handling pmessage: " + pattern + " on channel " + channel);

  /* Every time we receive a message, we check to see if it matches
     the subscription pattern. If it does, then go ahead and parse it. */
  if(pattern == subscriptionPattern) {
    try {
      var data = JSON.parse(message)['data'];
        
      // Channel name is really just a 'humanized' version of a slug
      // san-francisco turns into san francisco. Nothing fancy, just
      // works.
      var channelName = channel.split(':')[1].replace(/-/g, ' ');
      helpers.debug("channelName is " + channelName);
    } catch(e) {
      helpers.debug("error?");
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
        
    socket.sockets.emit('message', JSON.stringify(update));
  }
});