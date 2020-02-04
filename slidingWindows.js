// There are mainly 3 ways to implement rate limit: the leaky bucket, fixed windows and sliding
// logs. However, as a combination of the last two algorithms, the sliding windows algorithms is
// the ideal choice for processing large amount of requests while still being light and fast.

const redis = require('redis');
const moment = require('moment')
const redisClient = redis.createClient();

module.exports = (req, res, next) => {
  redisClient.exists(req.headers.user, (err, rep) => {
    if (err) {
      console.log(err)
      process.exit(1)
    }
    if (rep === 1) {
      redisClient.get(req.headers.user, (err,redisRes) => {
        const data = JSON.parse(redisRes)
        const currentTime = moment().unix()
        const lessThanMinuteAgo = moment().subtract(1,'minute').unix();
        const RequestCountPerMinutes = data.filter((item) => {
          return item.requestTime > lessThanMinuteAgo;
        })

        let thresHold = 0;
        RequestCountPerMinutes.forEach((item) => {
          thresHold = thresHold + item.counter;
        })

        if(thresHold >= 50){
          return res.json({ "error" : 1,"message" : "Limit exceeded" })
        }
        else{
          let isFound = false;
          data.forEach(element => {
            if(element.requestTime) {
                isFound = true;
                element.counter++;
            }
          });
          if(!isFound){
            data.push({
              requestTime : currentTime,
              counter : 1
            })
          }

          redisClient.set(req.headers.user,JSON.stringify(data));
          next();
        }
      })
    }
    else {
      let data = [];
      let requestData = {
        'requestTime' : moment().unix(),
        'counter' : 1
      }
      data.push(requestData);
      redisClient.set(req.headers.user,JSON.stringify(data));
      next();
    }
  })
}