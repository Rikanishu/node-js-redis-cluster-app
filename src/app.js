if (process.argv.length > 1 && process.argv[2] === 'getErrors') {
	require('./utils').retrieveErrors(true).then((entries) => {
		entries.forEach((entry) => {
			console.log(JSON.stringify(entry));
		});
		process.exit(0);
	})
} else {
	require('./process').spawn();
}