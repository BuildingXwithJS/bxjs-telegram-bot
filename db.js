const Datastore = require('nedb-promises');

const db = new Datastore({filename: 'database', autoload: true});

module.exports = db;
