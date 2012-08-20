var redis = require('redis');
var settings = require('./settings');
var crypto = require('crypto');
var _ = require('underscore');


// We use Redis's pattern subscribe command to listen for signals notifying us of new updates.
// REDISTOGO_URL if using heroku's redis_to_go addon.  Otherwise using REDIS_PORT/REDIS_HOST instead
var rtg = require("url").parse(settings.REDISTOGO_URL);
var redisClient = redis.createClient(rtg.port, rtg.hostname);
if (!!rtg.auth)
  redisClient.auth(rtg.auth.split(":")[1]);
//var redisClient = redis.createClient(settings.REDIS_PORT, settings.REDIS_HOST);


// makes sure subscription request is actually from Instagram
function isValidRequest(request) {
    // First, let's verify the payload's integrity by making sure it's
    // coming from a trusted source. We use the client secret as the key
    // to the HMAC.
    var hmac = crypto.createHmac('sha1', settings.CLIENT_SECRET);
    // TODO rawBody is broken/removed in latest express version, need to find workaround
    hmac.update(request.rawBody);
    var providedSignature = request.headers['x-hub-signature'];
    var calculatedSignature = hmac.digest(encoding='hex');
    
    // If they don't match up or we don't have any data coming over the
    // wire, then it's not valid.
    debug("providedSignature: " + providedSignature);
    debug("calculatedSignature: " + calculatedSignature);
    return !((providedSignature != calculatedSignature) || !request.body)
}
exports.isValidRequest = isValidRequest;

// This function gets the most recent media stored in redis
function getMedia(callback){
  redisClient.lrange('media:objects', 0, 20, function(error, media){
      // debug("getMedia: got " + media.length + " items");
      // Parse each media JSON to send to callback
      media = media.map(function(json){return JSON.parse(json);});
      callback(error, media);
  });
}
exports.getMedia = getMedia;

/*

    Each update that comes from Instagram merely tells us that there's new
    data to go fetch. The update does not include the data. So, we take the
    tag ID from the update, and make the call to the 'recent' API.

*/
function processInstagramUpdate(update) {  
  // build the URI to access instagram's 'recent' api
  var path = '/v1/tags/' + update.object_id + '/media/recent/';
  var channelName = 'instagram';
  
  // finish building the URI using the most recent instragram id that we already have
  getMinID(channelName, function(error, minID) {
    debug('minid ' + minID);
    var queryString = "?client_id="+ settings.CLIENT_ID;
    if(minID) {
      queryString += '&min_id=' + minID;
    } else {
        // If this is the first update, just grab the most recent.
      queryString += '&min_id=0';
    }
    
    var options = {
      host: settings.apiHost,
      // Note that in all implementations, basePath will be ''. Here at
      // instagram, this aint true ;)
      path: settings.basePath + path + queryString
    };
    
    if(settings.apiPort) {
        options['port'] = settings.apiPort;
    }

    // Asynchronously ask the Instagram API for new media for a given tag.
    settings.httpClient.get(options, function(response) {
      var data = '';
      var newData = {};
      var newDataStr = '';
      
      response.on('data', function(chunk) {
        data += chunk;
      });
      
      response.on('end', function() {
          try {            
            var dataArray = JSON.parse(data).data;
            var newDataArray = [];
            _.each(dataArray, function(obj, idx){
                var images = {};
                images.standard_resolution = obj.images.standard_resolution;
                
                var cap = {};
                if(!!obj.caption && !!obj.caption.text)
                  cap = obj.caption;
                else
                  cap.text = '';
                  
                newDataArray.push({id : obj.id, images : images, caption : cap });
            });
            newData = { "data": newDataArray };
            newDataStr = JSON.stringify(newData);
            console.log(newDataStr);
            
          } catch (e) {
              // console.log('Couldn\'t parse data. Malformed?');
              return;
          }
        
        setMinID(channelName, newData.data);

        // Let all the redis listeners know that we've got new media.
        redisClient.publish('channel:' + channelName, newDataStr);
      });
      
    }); // end settings.httpClient.get
    
  }); // end getMinID
}
exports.processInstagramUpdate = processInstagramUpdate;


/*
    In order to only ask for the most recent media, we store the MAXIMUM ID
    of the media for every tag we've fetched. This way, when we get an
    update, we simply provide a min_id parameter to the Instagram API that
    fetches all media that have been posted *since* the min_id.   
*/

// get the latest record
function getMinID(channelName, callback){
  redisClient.get('min-id:channel:' + channelName, callback);
}
exports.getMinID = getMinID;

// set the latest record
function setMinID(channelName, data){
    var sorted = data.sort(function(a, b){
        return parseInt(b.id) - parseInt(a.id);
    });
    var nextMinID;
    try {
      nextMinID = parseInt(sorted[0].id);
      redisClient.set('min-id:channel:' + channelName, nextMinID);
    } catch (e) {
        // console.log('Error parsing min ID');
        // console.log(sorted);
    }
}
exports.setMinID = setMinID;

// debug utility function
function debug(msg) {
  if (settings.debug) {
    console.log(msg);
  }
}
exports.debug = debug;




// testing

// For TESTING ONLY (remove for production)
// E.g., example photo: http://distillery.s3.amazonaws.com/media/2011/02/02/f9443f3443484c40b4792fa7c76214d5_7.jpg
function testing_add_instagramRecord() {  
  // fake instagram record
  var dataArray = JSON.parse('{"data": [{"caption": {"created_time": "1296703540","text": "#Snow","from": {"username": "emohatch","id": "1242695"},"id": "26589964"},"images": {"standard_resolution": {"url": "http://distilleryimage1.instagram.com/5fb063b2e1c911e1b44322000a1e8c9f_7.jpg","width": 612,"height": 612}},"id": "999999999"}]}').data;

  var newDataArray = [];
  _.each(dataArray, function(obj, idx){
      var images = {};
      images.standard_resolution = obj.images.standard_resolution;

      var cap = {};
      if(!!obj.caption && !!obj.caption.text)
        cap = obj.caption;
      else
        cap.text = '';

      newDataArray.push({id : obj.id, images : images, caption : cap });
  });
  newData = { "data": newDataArray };

  // Let all the redis listeners know that we've got new media.
  redisClient.publish('channel:' + 'instagram', JSON.stringify(newData));
}
exports.testing_add_instagramRecord = testing_add_instagramRecord;

