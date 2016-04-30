/* jshint camelcase:false */
var gulp = require('gulp-help')(require('gulp'));
var babel = require('gulp-babel');
var merge = require('merge-stream');
var pkg = require('./package.json');
var path = require('path');
var plug = require('gulp-load-plugins')();

var del = require('del');
var runSequence = require('run-sequence');
var _ = require('lodash');
var fs = require('fs');

var env = plug.util.env;
var log = plug.util.log;
var inject = require("gulp-inject");

gulp.task('build', false, ['clean'], function (cb) {
    log('Notification set to: ' + notifyOn);
    runSequence(['css'], ['js', 'rev-and-inject', 'buildNotify'], cb);
});

gulp.task('build:noclean', false, [], function (cb) {
    log('Notification set to: ' + notifyOn);
    runSequence(['css'], ['js', 'rev-and-inject', 'buildNotify'], cb);
});

gulp.task('buildNotify', false, ['rev-and-inject'], function () {
    if (notifyOn !== 'silent') {
        return gulp.src('').pipe(plug.notify({
            onLast: true,
            message: 'Code compiled and copied to output folder!'
        }));
    }
    else {
        return true;
    }
});

gulp.task('clean', false, function () {
    var env = isDebug ? pkg.paths.tmpFolder : pkg.paths.distFolder;
    var paths = [env + 'index.html', env + 'assets/*'];
    log('Cleaning: ' + plug.util.colors.red(paths));
    return del.sync(paths, { force: true }, function (err) {
        if (err) {
            log(err);
        }
    });
});

gulp.task('analyze', 'Lints the JavaScript to report errors and warnings.', function () {
    log('Analyzing source with JSHint and JSCS');
    var jshint = analyzejshint([].concat(pkg.paths.js, './.jshintrc');
    var jscs = analyzejscs([].concat(pkg.paths.js), './.jscsrc');
    return merge(jshintTests, jshint /*, jscs*/);
});

gulp.task('js', false, [], function () {
    log('Bundling, minifying, and copying the app\'s JavaScript');
    var source = [].concat(pkg.paths.js);

    return gulp.src(source)
        .pipe(plug.sourcemaps.init())
        .pipe(babel())
        .pipe(plug.concat('all.min.js'))
        .pipe(plug.sourcemaps.write())
        .pipe(gulp.dest(pkg.paths.dist + '/js'));
    
});

gulp.task('vendorjs', false, function () {
    log('Bundling, minifying, and copying the Vendor JavaScript');
    var source = [].concat(pkg.paths.vendorjs);
    return gulp.src(source)
        .pipe(plug.concat('vendor.min.js'))
        .pipe(plug.uglify())
        .pipe(gulp.dest(pkg.paths.dist + '/js'));
});

gulp.task('css', false, [], function () {
    log('Bundling, minifying, and copying the app\'s CSS');
    return gulp.src(pkg.paths.css)
        .pipe(plug.concat('all.min.css'))
        .pipe(gulp.dest(pkg.paths.dist + '/css'));
    
});

gulp.task('vendorcss', false, [], function () {
    log('Compressing, bundling, copying vendor CSS');
    return gulp.src(pkg.paths.vendorcss)
        .pipe(plug.concat('vendor.min.css'))
        .pipe(plug.minifyCss({}))
        .pipe(gulp.dest(pkg.paths.dist + '/css'));
});

gulp.task('rev-and-inject', false, ['js', 'vendorjs', 'css', 'vendorcss'], function (cb) {
    log('Rev\'ing files and injecting into index.html');
    var root = pkg.paths.dist;
    var minified = root + '**/*.min.*';
    var index = pkg.paths.client + '/index.html';
    var minFilter = plug.filter(['**/*.min.*', '!**/*.map']);
    var indexFilter = plug.filter(['index.html']);
    

    return gulp
        // Write the revisioned files
        .src([].concat(minified, index)) // add all staged min files and index.html
        .pipe(minFilter) // filter the stream to minified css and js
        .pipe(plug.rev()) // create files with rev's
        .pipe(gulp.dest(root)) // write the rev files
        .pipe(minFilter.restore()) // remove filter, back to original stream

        // inject the files into index.html
        .pipe(indexFilter) // filter to index.html
        .pipe(inject('/css/vendor.min.css', 'inject-vendor'))
        .pipe(inject('/css/all.min.css'))
        .pipe(inject('/js/vendor.min.js', 'inject-vendor'))
        .pipe(inject('/js/all.min.js'))
        .pipe(gulp.dest(root)) // write the rev files
        .pipe(indexFilter.restore()) // remove filter, back to original stream

        // replace the files referenced in index.html with the rev'd files
        .pipe(plug.revReplace())         // Substitute in new filenames
        .pipe(gulp.dest(root)) // write the index.html file changes
        .pipe(plug.rev.manifest()) // create the manifest (must happen last or we screw up the injection)
        .pipe(gulp.dest(root)); // write the manifest

    function inject(path, name) {
        log('rev path: ' + path);
        log('rev name: ' + name);
        var glob = root + path;
        var env = isDebug ? 'tmp/' : 'dist/';
        var options = {
            ignorePath: 'wwwroot/' + env,
            read: false,
            addRootSlash: false
        };
        if (name) { options.name = name; }
        return plug.inject(gulp.src(glob), options);
    }
});

gulp.task('watch', false, [], function () {
    log('Watching HTML files');
    gulp.watch("./client/**/*.html").on('change', logWatch);
    gulp.watch("./client/**/*.html", ['build:noclean']);

    log('Watching CSS files');
    gulp.watch("./client/css/*.css").on('change', logWatch);
    gulp.watch("./client/css/*.css", ['build:noclean']);

    log('Watching JS files');
    gulp.watch('./client/**/*.js').on('change', logWatch);
    gulp.watch('./client/**/*.js', ['build:noclean');

    function logWatch(event) {
        var eventMessage = 'File ' + event.path + ' was ' + event.type + ', running tasks...';
        return gulp.src('').pipe(plug.notify({
            onLast: true,
            message: eventMessage
        }));
    }
});

////////////////

/**
 * Execute JSHint on given source files
 * @param  {Array} sources
 * @param  {string} jshintrc - file path string, allows custom rules per path
 * @return {Stream}
 */
function analyzejshint(sources, jshintrc) {
    return gulp
        .src(sources)
        .pipe(plug.jshint(jshintrc))
        .pipe(plug.jshint.reporter('jshint-stylish'));
}

/**
 * Execute JSCS on given source files
 * @param  {Array} sources
 * @return {Stream}
 */
function analyzejscs(sources) {
    return gulp
        .src(sources)
        .pipe(plug.jscs('./.jscsrc'));
}