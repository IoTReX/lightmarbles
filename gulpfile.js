/* jshint camelcase:false */
var gulp = require('gulp-help')(require('gulp'));
var babel = require('gulp-babel');
var karma = require('karma').server;
var karmaConfig = require('./karma.conf.js');
var merge = require('merge-stream');
var pkg = require('./package.json');
var compass = require('gulp-compass');
var path = require('path');
var plug = require('gulp-load-plugins')();

var browserSync = require('browser-sync');
var reload = browserSync.reload;
var del = require('del');
var runSequence = require('run-sequence');
var _ = require('lodash');
var fs = require('fs');

var env = plug.util.env;
var log = plug.util.log;
var inject = require("gulp-inject");

var notifyOn = env.notify ? 'notify' : 'silent';
var isDebug = true;
var clientVersion = '1.0.0';

//Create comments for minified files
var commentHeader = common.createComments(plug.util);

gulp.task('serve', 'Launches a web browser after running tests and a build. DOES NOT watch for changes.', function (cb) {
    isDebug = false;
    runSequence(['build'], 'browser-sync', cb);
});

gulp.task('serve:debug', 'Launches a web browser after running tests and a build. DOES watch for changes.', function (cb) {
    isDebug = true;
    runSequence(['build:nobump'], 'watch', cb);
});

gulp.task('build-dist', 'Runs tests and build for production. DOES NOT serve or watch for changes.', function (cb) {
    isDebug = false;
    runSequence(['build'], cb);
});

gulp.task('build', false, ['clean'], function (cb) {
    log('Notification set to: ' + notifyOn);
    runSequence(['runtests'], ['bump', 'getVersion', 'createappconstants'], ['scss', 'images', 'fonts'], ['templatecache', 'js', 'configjs', 'rev-and-inject', 'buildNotify'], cb);
});

gulp.task('build:noclean', false, function (cb) {
    log('Notification set to: ' + notifyOn);
    runSequence(['runtests'], ['scss', 'images', 'fonts'], ['templatecache', 'js', 'configjs', 'rev-and-inject', 'buildNotify'], cb);
});

gulp.task('build:nobump', false, ['clean'], function (cb) {
    log('Notification set to: ' + notifyOn);
    runSequence(['runtests'], ['scss', 'images', 'fonts'], ['templatecache', 'js', 'configjs', 'rev-and-inject', 'buildNotify'], cb);
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

gulp.task('bump', false, function () {
    return gulp.src(['package.json', 'bower.json', 'app.constants.json'])
      .pipe(plug.bump({ key: 'version', type: 'patch' }))
      .pipe(gulp.dest('./'));
});

gulp.task('getVersion', false, ['bump'], function () {
    var config = fs.readFileSync('./package.json', 'utf-8');
    var configObj = JSON.parse(config);
    log('Compiling version: ' + configObj.version);
    clientVersion = configObj.version;
    commentHeader = common.createComments(plug.util, clientVersion);
});

gulp.task('createappconstants', false, ['getVersion'], function () {
    var config = fs.readFileSync('./package.json', 'utf-8');
    var configObj = JSON.parse(config);
    log('Writing updated app constants module with version number: ' + configObj.version);
    return gulp.src('app.constants.json')
        .pipe(gulpNgConfig('app.constants', {
            version: configObj.version
        }))
        .pipe(gulp.dest('./code/app'));
});

gulp.task('clean', false, function () {
    var env = isDebug ? pkg.paths.tmpFolder : pkg.paths.distFolder;
    var paths = [env + 'index.html', env + 'rev-manifest.json', env + 'templates.js', env + 'assets/*'];
    log('Cleaning: ' + plug.util.colors.red(paths));
    return del.sync(paths, { force: true }, function (err) {
        if (err) {
            log(err);
        }
    });
});

gulp.task('analyze', 'Lints the JavaScript to report errors and warnings.', function () {
    log('Analyzing source with JSHint and JSCS');
    var jshintTests = analyzejshint('./test/**/*.spec.js', './test/.jshintrc');
    var jshint = analyzejshint([].concat(pkg.paths.js, '!./test/**/*.spec.js'), './.jshintrc');
    var jscs = analyzejscs([].concat(pkg.paths.js), './.jscsrc');
    return merge(jshintTests, jshint /*, jscs*/);
});

gulp.task('templatecache', false, function () {
    log('Creating an AngularJS $templateCache');
    var env = isDebug ? pkg.paths.tmpFolder : pkg.paths.distFolder;
    return gulp
        .src(pkg.paths.htmltemplates)
         .pipe(plug.bytediff.start())
        .pipe(plug.minifyHtml({
            empty: true
        }))
         .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(plug.angularTemplatecache('templates.js', {
            module: 'app',
            standalone: false,
            root: 'app/'
        }))
        .pipe(gulp.dest(env));
});

gulp.task('js', false, ['templatecache'], function () {
    log('Bundling, minifying, and copying the app\'s JavaScript');
    var env = isDebug ? pkg.paths.tmpFolder : pkg.paths.distFolder;
    var source = [].concat(pkg.paths.js, env + 'templates.js');

    if (isDebug) {
        return gulp.src(source)
        .pipe(plug.sourcemaps.init())
        .pipe(babel())
        .pipe(plug.concat('all.min.js'))
        .pipe(plug.header(commentHeader))
        .pipe(plug.sourcemaps.write())
        .pipe(gulp.dest(pkg.paths.tmpJavascript));
    }
    else {
        return gulp.src(source)
        .pipe(babel())
        .pipe(plug.concat('all.min.js'))
        .pipe(plug.ngAnnotate({ add: true, single_quotes: true }))
        .pipe(plug.bytediff.start())
        .pipe(plug.uglify({ mangle: true }))
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(plug.header(commentHeader))
        .pipe(gulp.dest(pkg.paths.distJavascript));
    }
});

gulp.task('vendorjs', false, function () {
    log('Bundling, minifying, and copying the Vendor JavaScript');
    var source = [].concat(pkg.paths.vendorjs);
    var dest = isDebug ? pkg.paths.tmpJavascript : pkg.paths.distJavascript;
    return gulp.src(source)
        .pipe(plug.concat('vendor.min.js'))
        .pipe(plug.bytediff.start())
        .pipe(plug.uglify())
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(gulp.dest(dest));
});

gulp.task('headsectionjs', false, function () {
    log('Bundling, minifying, and copying the JavaScript placed in the html head section');
    var dest = isDebug ? pkg.paths.tmpJavascript : pkg.paths.distJavascript;
    var source = [].concat(pkg.paths.headsectionjs);
    return gulp.src(source)
        .pipe(plug.concat('head.min.js'))
        .pipe(plug.bytediff.start())
        .pipe(plug.uglify())
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(gulp.dest(dest));
});

gulp.task('configjs', false, function () {
    log('Moving config js files');
    var source = [].concat(pkg.paths.configjs);
    var dest = isDebug ? pkg.paths.tmpJavascript : pkg.paths.distJavascript;
    return gulp.src(source)
        .pipe(gulp.dest(dest));
});

gulp.task('scss', false, function () {
    log('Generating css files from scss sources');
    return gulp.src(pkg.paths.scss)
        .pipe(compass({
            project: path.join(__dirname, './code'),
            font: 'assets/fonts',
            css: 'assets/css',
            image: 'assets/images',
            sass: 'scss',
            import_path: ["../bower_components/foundation/scss", "../bower_components/normalize-scss", "../bower_components/css-calc-mixin"],
            bundle_exec: true
        }))
        .on('error', function (err) {
            log(err.message);
        });
});

gulp.task('css', false, ['scss'], function () {
    log('Bundling, minifying, and copying the app\'s CSS');
    var dest = isDebug ? pkg.paths.tmpCss : pkg.paths.distCss;
    if (isDebug) {
        return gulp.src(pkg.paths.css)
        .pipe(plug.concat('all.min.css'))
        .pipe(plug.header(commentHeader))
        .pipe(gulp.dest(dest));
    } else {
        return gulp.src(pkg.paths.css)
        .pipe(plug.concat('all.min.css')) // Before bytediff or after
        .pipe(plug.autoprefixer('last 2 version', '> 5%'))
        .pipe(plug.bytediff.start())
        .pipe(plug.minifyCss({}))
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(plug.header(commentHeader))
        .pipe(gulp.dest(dest));
    }
    
});

gulp.task('vendorcss', false, ['scss'], function () {
    log('Compressing, bundling, copying vendor CSS');
    var dest = isDebug ? pkg.paths.tmpCss : pkg.paths.distCss;
    return gulp.src(pkg.paths.vendorcss)
        .pipe(plug.concat('vendor.min.css'))
        .pipe(plug.bytediff.start())
        .pipe(plug.minifyCss({})) 
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(gulp.dest(dest));
});

gulp.task('fonts', false, function () {
    log('Copying fonts');
    var dest = isDebug ? pkg.paths.tmpFonts : pkg.paths.distFonts;
    return gulp
        .src(pkg.paths.fonts)
        .on('error', function (err) {
            log(err.message);
        })
        .pipe(gulp.dest(dest));
});

gulp.task('images', false, function () {
    log('Copying images');
    var dest = isDebug ? pkg.paths.tmpImages : pkg.paths.distImages;
    return gulp
        .src(pkg.paths.images)
        .on('error', function (err) {
            log(err.message);
        })
        .pipe(gulp.dest(dest));
});

gulp.task('rev-and-inject', false, ['js', 'vendorjs', 'headsectionjs', 'css', 'vendorcss'], function (cb) {
    log('Rev\'ing files and injecting into index.html');
    var root = isDebug ? pkg.paths.tmpFolder : pkg.paths.distFolder;
    var minified = root + '**/*.min.*';
    var index = pkg.paths.client + 'index.html';
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
        .pipe(inject('assets/css/vendor.min.css', 'inject-vendor'))
        .pipe(inject('assets/css/all.min.css'))
        .pipe(inject('assets/js/vendor.min.js', 'inject-vendor'))
        .pipe(inject('assets/js/head.min.js', 'inject-head'))
        .pipe(inject('assets/js/all.min.js'))
        .pipe(inject('assets/js/config.environment.js', 'inject-config'))
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

gulp.task('tdd', 'Run unit tests and watch files.', function (cb) {
    karma.start(_.assign({}, karmaConfig, {
        singleRun: false,
        action: 'watch',
        browsers: ['PhantomJS']
    }), cb);
});

gulp.task('runtests', 'Run unit tests without watching files.', function (cb) {
    log('Starting up karma to run unit tests');
    karma.start(_.assign({}, karmaConfig, {
        singleRun: true,
        action: 'run',
        browsers: ['PhantomJS']
    }), function (exitStatus) {
        //Note: The stack trace inside gulp.js will display on exit in gulp versions less than version 4.0 
        cb(exitStatus ? "There are failing unit tests" : undefined);
    });
});

gulp.task('watch', false, ['browser-sync'], function () {
    log('Watching HTML files');
    gulp.watch("./code/app/**/*.html").on('change', logWatch);
    gulp.watch("./code/app/**/*.html", ['build:noclean', reload]);

    log('Watching Sass files');
    gulp.watch("./code/scss/*.scss").on('change', logWatch);
    gulp.watch("./code/scss/*.scss", ['build:noclean', reload]);

    log('Watching JS files');
    gulp.watch('./code/app/**/*.js').on('change', logWatch);
    gulp.watch('./code/app/**/*.js', ['build:noclean', reload]);

    log('Watching image files');
    gulp.watch("./code/assets/images/**/*").on('change', logWatch);
    gulp.watch("./code/assets/images/**/*", ['build:noclean', reload]);

    function logWatch(event) {
        var eventMessage = 'File ' + event.path + ' was ' + event.type + ', running tasks...';
        return gulp.src('').pipe(plug.notify({
            onLast: true,
            message: eventMessage
        }));
    }
});

gulp.task('browser-sync', false, function () {
    var env = isDebug ? 'tmp' : 'dist';
    browserSync({
        notify: true,
        logPrefix: pkg.name,
        port: 57107,
        server: {
            baseDir: './wwwroot/' + env,
            index: 'index.html'
        }
    });
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