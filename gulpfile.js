'use strict';
var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var uglify = require('gulp-uglify');
var gulpif = require('gulp-if');
var exec = require('child_process').exec;


var notify = require('gulp-notify');

var buffer = require('vinyl-buffer');
var argv = require('yargs').argv;
// sass
var sass = require('gulp-sass');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
var sourcemaps = require('gulp-sourcemaps');
//jade
var jade = require('gulp-jade');
// BrowserSync
var browserSync = require('browser-sync');
// js
var watchify = require('watchify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
// image optimization
var imagemin = require('gulp-imagemin');
// linting
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
// testing/mocha
var mocha = require('gulp-mocha');

// gulp build --production
var production = !!argv.production;
// determine if we're doing a build
// and if so, bypass the livereload
var build = argv._.length ? argv._[0] === 'build' : false;
var watch = argv._.length ? argv._[0] === 'watch' : true;

// ----------------------------
// VARS
// ----------------------------
var src = './src';
var dest = './build';
var bower_path = './bower_components';

// ----------------------------
// Error notification methods
// ----------------------------
var beep = function() {
	var os = require('os');
	var file = 'gulp/error.wav';
	if (os.platform() === 'linux') {
		// linux
		exec("aplay " + file);
	} else {
		// mac
		console.log("afplay " + file);
		exec("afplay " + file);
	}
};
var handleError = function(task) {
	return function(err) {
		beep();
			notify.onError({
				message: task + ' failed, check the logs..',
				sound: false
			})(err);
		
		gutil.log(gutil.colors.bgRed(task + ' error:'), gutil.colors.red(err));
		var now = new Date(); 
		gutil.log(gutil.colors.red('Err at: ' + now));
		this.emit('end');
	};
};
// --------------------------
// CUSTOM TASK METHODS
// --------------------------
var tasks = {
	// --------------------------
	// Delete build folder
	// --------------------------
	clean: function(cb) {
		del([dest + '/'], cb);
	},
	// --------------------------
	// Copy static assets
	// --------------------------
	assets: function() {
		return gulp.src(src+'/assets/**/*')
			.pipe(gulp.dest(dest + '/assets/'));
	},

	fonts: function() {
		gulp.src(bower_path + '/font-awesome/fonts/**.*')
			.pipe(gulp.dest(dest + '/fonts'));
		gutil.log(gutil.colors.white('Fonts font-awesome copied'));
		// gulp.task('fa-fonts', function() {
		// });

		gulp.src(bower_path + '/bootstrap-sass/assets/fonts/bootstrap/**.*')
			.pipe(gulp.dest(dest + '/fonts/bootstrap'));
		gutil.log(gutil.colors.white('Fonts bootstrap copied'));
		// gulp.task('bst-fonts', function() {
		// });
	},
	// --------------------------
	// JADE
	// --------------------------
	jade: function() {
		gulp.src([src + '/views/**/*.jade'])
			.on('error', handleError('JADE'))
			.pipe(jade({pretty: true}))
			.pipe(gulp.dest(dest + '/'));
	},
	// --------------------------
	// SASS (libsass)
	// --------------------------
	sass: function() {
		return gulp.src(src+'/scss/*.scss')
			// sourcemaps + sass + error handling
			.pipe(gulpif(!production, sourcemaps.init()))
			.pipe(sass({
				sourceComments: !production,
				outputStyle: production ? 'compressed' : 'nested',
				includePaths: [
					bower_path + '/bootstrap-sass-official/assets/stylesheets',
					bower_path + '/fontawesome/scss',
					bower_path + '/bourbon/app/assets/stylesheets',
					bower_path + '/neat/app/assets/stylesheets',
				]
			}))
			.on('error', handleError('SASS'))
			// generate .maps
			.pipe(gulpif(!production, sourcemaps.write({
				'includeContent': false,
				'sourceRoot': '.'
			})))
			// autoprefixer
			.pipe(gulpif(!production, sourcemaps.init({
				'loadMaps': true
			})))
			.pipe(postcss([autoprefixer({browsers: ['last 2 versions']})]))
			// we don't serve the source files
			// so include scss content inside the sourcemaps
			.pipe(sourcemaps.write({
				'includeContent': true
			}))
			// write sourcemaps to a specific directory
			// give it a file and save
			.pipe(gulp.dest(dest + '/css'));
	},
	// --------------------------
	// Browserify
	// --------------------------
	browserify: function() {
		var bundler = browserify(src+'/js/index.js', {
			debug: !production,
			cache: {}
		});
		// determine if we're doing a build
		// and if so, bypass the livereload
		var build = argv._.length ? argv._[0] === 'build' : false;
		if (watch) {
			bundler = watchify(bundler);
		}
		var rebundle = function() {
			return bundler.bundle()
				.on('error', handleError('Browserify'))
				.pipe(source('build.js'))
				.pipe(gulpif(production, buffer()))
				.pipe(gulpif(production, uglify()))
				.pipe(gulp.dest(dest + '/js/'));
		};
		bundler.on('update', rebundle);
		return rebundle();
	},
	// --------------------------
	// linting
	// --------------------------
	lintjs: function() {
		return gulp.src([
				'gulpfile.js',
				src+'/js/index.js',
				src+'/js/**/*.js'
			]).pipe(jshint())
			.pipe(jshint.reporter(stylish))
			.on('error', function() {
				beep();
			});
	},
	// --------------------------
	// Optimize asset images
	// --------------------------
	optimize: function() {
		return gulp.src(src+'/assets/**/*.{gif,jpg,png,svg}')
			.pipe(imagemin({
				progressive: true,
				svgoPlugins: [{removeViewBox: false}],
				// png optimization
				optimizationLevel: production ? 3 : 1
			}))
			.pipe(gulp.dest(src+'/assets/'));
	},
	// --------------------------
	// Testing with mocha
	// --------------------------
	test: function() {
		return gulp.src(src+'/**/*test.js', {read: false})
			.pipe(mocha({
				'ui': 'bdd',
				'reporter': 'spec'
			})
		);
	},


};

gulp.task('browser-sync', function() {
		browserSync({
				server: {
						baseDir: "./build"
				},
				port: process.env.PORT || 3000
		});
});

gulp.task('reload-sass', ['sass'], function(){
	browserSync.reload();
});
gulp.task('reload-js', ['browserify'], function(){
	browserSync.reload();
});
gulp.task('reload-jade', ['jade'], function(){
	browserSync.reload();
});

// --------------------------
// CUSTOMS TASKS
// --------------------------
gulp.task('clean', tasks.clean);
// for production we require the clean method on every individual task
var req = build ? ['clean'] : [];
// individual tasks
gulp.task('jade', req, tasks.jade);
gulp.task('assets', req, tasks.assets);
gulp.task('fonts', req, tasks.fonts);
gulp.task('sass', req, tasks.sass);
gulp.task('browserify', req, tasks.browserify);
gulp.task('lint:js', tasks.lintjs);
gulp.task('optimize', tasks.optimize);
gulp.task('test', tasks.test);

// --------------------------
// DEV/WATCH TASK
// --------------------------
gulp.task('watch', ['assets', 'jade', 'sass', 'browserify', 'browser-sync'], function() {

	// --------------------------
	// watch:sass
	// --------------------------
	gulp.watch(src+'/scss/**/*.scss', ['reload-sass']);

	// --------------------------
	// watch:js
	// --------------------------
	gulp.watch(src+'/js/**/*.js', ['lint:js', 'reload-js']);

	// --------------------------
	// watch:jade
	// --------------------------
	gulp.watch(src+'/views/**/*.jade', ['reload-jade']);

	gutil.log(gutil.colors.bgGreen('Watching for changes...'));
});

// build task
gulp.task('build', [
	'clean',
	'jade',
	'assets',
	'fonts',
	'sass',
	'browserify'
]);

gulp.task('default', ['watch']);

// gulp (watch) : for development and livereload
// gulp build : for a one off development build
// gulp build --production : for a minified production build