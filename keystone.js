// Simulate config options from your production environment by
// customising the .env file in your project's root folder.
require('dotenv').load();

// Require keystone
var keystone = require('keystone');
var handlebars = require('express-handlebars');

// Initialise Keystone with your project's configuration.
// See http://keystonejs.com/guide/config for available options
// and documentation.

keystone.init({

	'name': 'club-site-admin',
	'brand': 'club-site-admin',
	
	'sass': 'public',
	'static': 'public',
	'favicon': 'public/favicon.ico',
	'views': 'templates/views',
	'view engine': 'hbs',
	
	'custom engine': handlebars.create({
		layoutsDir: 'templates/views/layouts',
		partialsDir: 'templates/views/partials',
		defaultLayout: 'default',
		helpers: new require('./templates/views/helpers')(),
		extname: '.hbs'
	}).engine,
	
	'auto update': true,
	'session': true,
	'auth': true,
	'user model': 'User'

});

// Load your project's Models

keystone.import('models');

// Setup common locals for your templates. The following are required for the
// bundled templates and layouts. Any runtime locals (that should be set uniquely
// for each request) should be added to ./routes/middleware.js

keystone.set('locals', {
	_: require('underscore'),
	env: keystone.get('env'),
	utils: keystone.utils,
	editable: keystone.content.editable
});

// Load your project's Routes

keystone.set('routes', require('./routes'));

// Initialise site config from admin UI if needed

var SiteConfig = keystone.list('SiteConfig');
SiteConfig.model.find().exec(function(err, c) {
  if (!c.length) {
    console.log('Initialising SiteConfig...');
    var siteConfig = new SiteConfig.model({
      name: 'Club Site'
    });
    siteConfig.save(function(err) {
      if (err) throw new Error('Failed to initialise SiteConfig: ' + err);
    });
  }
  else {
    siteConfig = c[0];
  }
  keystone.set('siteConfig', siteConfig);
});

// Configure the navigation bar in Keystone's Admin UI


keystone.set('nav', {
	'posts': ['posts', 'post-categories'],
	'results': 'meeting-results',
	'galleries': 'galleries',
	'enquiries': 'enquiries',
	'users': 'users'
});


// keystone.set('wysiwyg additional plugins', 'table');
// keystone.set('wysiwyg additional options', {menubar: 'table'});

// Start Keystone to connect to your database and initialise the web server

keystone.start();
