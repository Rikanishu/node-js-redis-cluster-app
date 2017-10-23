var appConfig = {
	workersCount: 10,
	lockTime: 500,
	messagesDelay: 500,
	appName: 'NodeJsApp',
	lockResource: 'MessageGenerator',
	messagesChannel: 'MessagesChannel',
	taskExecutionLockKeyPrefix: 'TaskLocking',
	errorsPrefix: 'Errors',
	taskExecutionLockSeconds: 10,
	generatorLifeTime: 20000,
	redis: {
		host: '127.0.0.1',
		port: 6379
	}
};

appConfig.lockResource = appConfig.appName + ':' + appConfig.lockResource;
appConfig.messagesChannel = appConfig.appName + ':' + appConfig.messagesChannel;
appConfig.taskExecutionLockKeyPrefix = appConfig.appName + ':' + appConfig.taskExecutionLockKeyPrefix;
appConfig.errorsPrefix = appConfig.appName + ':' + appConfig.errorsPrefix;

module.exports = appConfig;