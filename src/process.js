const redis = require('redis');
const Redlock = require('redlock');
const uuid = require('uuid/v1');
const cluster = require('cluster');
const config = require('./config');
const utils = require('./utils');

var ProcessInstance = function() {
	this.mainRedisConection = utils.connectToRedis();
	this.messagingRedisConnection = utils.connectToRedis();
	this.genMessagesInterval = null;
	this.isWorker = false;
	this.isGenerator = false;
};

ProcessInstance.prototype.run = function() {
	this.listenMessages();
	this.tryToAcquireLock();
};

ProcessInstance.prototype.tryToAcquireLock =  function() {
	var self = this;
	var redlockInstance = new Redlock([self.mainRedisConection], {
		retryCount: 10,
		retryDelay: config.lockTime
	});
	redlockInstance.on('clientError', (err) => {
		logForProcess('A RedLock locking error has occurred');
		logForProcess(err);
	});
	redlockInstance.lock(config.lockResource, config.lockTime).then((lock) => {
		logForProcess('Lock acquired!');
		self.extendLockTillApplicationStop(lock);
		self.generateMessages();
		if (config.generatorLifeTime > 0) {
			setTimeout(() => {
				logForProcess('Time to die...');
				process.exit(0);
			}, config.generatorLifeTime);
		}
	}, (lockError) => {
		self.tryToAcquireLock();
	});
};

ProcessInstance.prototype.listenMessages = function() {
	var self = this;

	self.isWorker = true;
	self.isGenerator = false;
	if (self.genMessagesInterval !== null) {
		clearInterval(self.genMessagesInterval);
		self.genMessagesInterval = null;
	}

	self.messagingRedisConnection.subscribe(config.messagesChannel);
	self.messagingRedisConnection.on('message', (channel, message) => {
		if (channel === config.messagesChannel) {
			var data = JSON.parse(message);
			if (data && data.uuid) {
				self.mainRedisConection.set([config.taskExecutionLockKeyPrefix + ':' + data.uuid, 1, 'NX', 'EX', config.taskExecutionLockSeconds], (err, reply) => {
					if (err) {
						logForProcess('Can\'t set key', data.uuid);
						return;
					}

					if (reply) {
						logForProcess('Execution of task ' + data.uuid);
						if (!data.broken) {
							logForProcess('Message: ' + data.message);
						} else {
							logForProcess('ERROR happened: ' + data.message + ', logging');
							self.mainRedisConection.set(config.errorsPrefix + ':' + data.uuid, JSON.stringify({
								ts: (new Date()).getTime(),
								uuid: data.uuid,
								message: data.message,
								proc: process.pid
							}), (err) => {
								if (err) {
									logForProcess(err);
								}
							});
						}
					}
				})
			}
		}
	});
};

ProcessInstance.prototype.generateMessages = function() {
	var self = this;

	self.isWorker = false;
	self.isGenerator = true;

	self.messagingRedisConnection.unsubscribe();

	if (self.genMessagesInterval !== null) {
		clearInterval(self.genMessagesInterval);
	}

	self.genMessagesInterval = setInterval(() => {

		var message;
		var somethingIsBroken = false;
		var partsCanBeBroken = [
			'Engine',
			'Sensors',
			'Display',
			'Input Device',
			'Sound Speakers',
			'Camera'
		];

		// generate error in 5% of all messages
		if (Math.random() > 0.95) {
			var item = partsCanBeBroken[Math.floor(Math.random() * partsCanBeBroken.length)];
			message = item + ' is broken!';
			somethingIsBroken = true;
		} else {
			message = 'OK';
		}

		self.messagingRedisConnection.publish(config.messagesChannel, JSON.stringify({
			uuid: uuid(),
			message: message,
			broken: somethingIsBroken
		}));

	}, config.messagesDelay);
};

ProcessInstance.prototype.extendLockTillApplicationStop = function(lock) {
	var self = this;
	lock.extend(config.lockTime).then((lock) => {
		setTimeout(() => {
			self.extendLockTillApplicationStop(lock);
		}, (config.lockTime - 50));
	}, (err) => {
		logForProcess('Failed to extend lock');
		logForProcess(err);
		self.listenMessages();
	});
}

function logForProcess() {
	var args = Array.prototype.slice.call(arguments);
	args.unshift('[' + process.pid + ']');
	console.log.apply(this, args);
}

module.exports = {
	spawn: function() {
		if (cluster.isMaster) {
			console.log('Master ' + process.pid  + ' is running');
			for (let i = 0; i < config.workersCount; i++) {
				cluster.fork();
			}
			cluster.on('exit', (worker, code, signal) => {
				console.log('Worker ' + worker.process.pid + ' died');
			});
		} else {
			(new ProcessInstance()).run();
		}
	}
};