const redis = require('redis');
const appConfig = require('./config');

function connectToRedis() {
	return redis.createClient({
		host: appConfig.redis.host,
		port: appConfig.redis.port
	});
}

function retrieveErrors(remove) {
	var client = connectToRedis();
	return new Promise(function(resolve) {
		client.keys(appConfig.errorsPrefix + ':*', function (err, keys) {
			if (err) {
				return console.log(err);
			}
			if (keys && keys.length) {
				var obj = {};
				var remaining = keys.length;
				for (let i = 0; i < keys.length; ++i) {
					(function(i) {
						client.get(keys[i], function (err, reply) {
							--remaining;

							if (err) {
								console.log(err);
								return;
							}

							obj[i] = reply;

							if (remove) {
								client.del(keys[i], function(err) {
									if (err) {
										console.log(err);
									}
								})
							}

							if (remaining == 0) {
								var result = [];
								Object.keys(obj).forEach(function(key) {
									result.push(JSON.parse(obj[key]));
								});
								result.sort((a, b) => {
									var x = a.ts; var y = b.ts;
									return ((x < y) ? -1 : ((x > y) ? 1 : 0));
								});
								resolve(result);
							}

						});
					})(i);
				}
			} else {
				resolve([]);
			}
		});
	});
}

module.exports = {

	connectToRedis: connectToRedis,
	retrieveErrors: retrieveErrors

};


