'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')({
    lazy: true
});
var revDel = require('rev-del');
var st = require('st');

var config = {
    assets: '_assets',
    build: 'build',
    bundle: {
        css: 'bundle.css',
        js: 'bundle.js'
    },
    bower_components: 'bower_components',
    devBaseUrl: 'http://localhost',
    development: 'src',
    lint: {
        sass: ['./src/sass/**/*.scss', '!./src/sass/vendor/**/*.scss'],
        js: ['./src/scripts/**/*.js', '!./src/scripts/vendor/**/*.js']
    },
    paths: {
        assets: {
            all: './_assets/**/*',
            css: './_assets/css/',
            fonts: './_assets/fonts',
            img: './_assets/img',
            js: './_assets/js/'
        },
        build: './build/',
        development: './src/',
        files: './src/**/*.html',
        fonts: './src/fonts/**/*',
        index: './src/index.html',
        images: './src/images/**/*',
        sass: './src/sass/**/*.scss',
        scripts: './src/scripts/**/*.js'
    },
    portBuild: 8000,
    portDev: 7800,
    files: {
        index: 'index.html',
        css: './_assets/css/**/*.css',
        js: './_assets/js/**/*.js'
    },
    urls: {
        assets: '/_assets',
        bower: '/bower_components'
    },
    bower: {
        json: require('./bower.json'),
        directory: './bower_components/',
        ignorePath: '..'
    },
    packages: [
          './package.json',
          './bower.json'
      ]
};

config.getWiredepDefaultOptions = function () {
    var options = {
        bowerJson: config.bower.json,
        directory: config.bower.directory,
        ignorePath: config.bower.ignorePath
    }

    return options;
};

gulp.task('connect', function () {
    $.connect.server({
        root: [config.build],
        port: config.portBuild,
        base: config.devBaseUrl,
        livereload: true
    });
});

gulp.task('open-build', ['connect', 'optimize'], function () {
    var manifest = require(config.paths.build + 'rev-manifest.json');
    var file = config.paths.build + String(manifest[config.files.index]);

    gulp.src(file)
        .pipe($.open({
            uri: config.devBaseUrl + ':' + config.portBuild + '/' + String(manifest[config.files.index])
        }));
});

gulp.task('connect-dev', function () {
    $.connect.server({
        root: [config.development],
        port: config.portDev,
        base: config.devBaseUrl,
        livereload: true,
        middleware: function (connect, opt) {
            return [
                st({
                    path: config.bower_components,
                    url: config.urls.bower,
                    cache: false
                }),
                st({
                    path: config.assets,
                    url: config.urls.assets,
                    cache: false
                })
            ];
        }
    });
});

gulp.task('open-dev', ['connect-dev', 'inject'], function () {
    gulp.src(config.paths.index)
        .pipe($.open({
            uri: config.devBaseUrl + ':' + config.portDev + '/'
        }));
});

gulp.task('optimize', ['inject'], function (done) {
    var cssFilter = $.filter('**/*.css', {
        restore: true
    });
    var jsAppFilter = $.filter('**/app.js', {
        restore: true
    });
    var jsLibFilter = $.filter('**/lib.js', {
        restore: true
    });

    return gulp
        .src(config.paths.index)
        .pipe($.plumber())
        .pipe($.useref({
            searchPath: './'
        }))
        .pipe(cssFilter)
        .pipe($.csso())
        .pipe(cssFilter.restore)
        .pipe(jsLibFilter)
        .pipe($.uglify())
        .pipe(jsLibFilter.restore)
        .pipe(jsAppFilter)
        .pipe($.uglify())
        .pipe(jsAppFilter.restore)
        .pipe($.rev())
        .pipe($.revReplace())
        .pipe(gulp.dest(config.paths.build))
        .pipe($.rev.manifest())
        .pipe(revDel({
            dest: config.paths.build
        }))
        .pipe(gulp.dest(config.paths.build));
});

gulp.task('inject', ['insert-dependencies', 'compile-sass', 'compile-js'], function () {
    return gulp
        .src(config.paths.index)
        .pipe($.inject(gulp.src(config.files.css)))
        .pipe($.inject(gulp.src(config.files.js)))
        .pipe(gulp.dest(config.paths.development));
});

gulp.task('insert-dependencies', function () {
    var options = config.getWiredepDefaultOptions();
    var wiredep = require('wiredep').stream;

    return gulp
        .src(config.paths.index)
        .pipe(wiredep(options))
        .pipe(gulp.dest(config.paths.development));
});

gulp.task('compile-sass', ['lint-sass'], function () {
    return gulp
        .src(config.paths.sass)
        .pipe($.plumber())
        .pipe($.sourcemaps.init())
        .pipe($.concat(config.bundle.css))
        .pipe($.sass().on('error', $.sass.logError))
        .pipe($.autoprefixer({
            browsers: ['last 2 version', '> 5%']
        }))
        .pipe($.sourcemaps.write())
        .pipe(gulp.dest(config.paths.assets.css))
        .pipe($.connect.reload());
});

gulp.task('lint-sass', function () {
    return gulp.src(config.lint.sass)
        .pipe($.cached('lint-sass')) //cache only works on not concatted files
        .pipe($.sassLint({
            configFile: '.sass-lint.yml' //note this name must be used, otherwise it will not be found
        }))
        .pipe($.sassLint.format())
        .pipe($.sassLint.failOnError());
});

gulp.task('compile-js', ['lint-js'], function () {
    return gulp
        .src(config.paths.scripts)
        .pipe($.plumber())
        .pipe($.concat(config.bundle.js))
        .pipe(gulp.dest(config.paths.assets.js))
        .pipe($.connect.reload());
});

gulp.task('lint-js', function () {
    return gulp.src(config.lint.js)
        .pipe($.cached('lint-js')) //cache only works on not concatted files
        .pipe($.eslint({
            config: 'eslint.config.json'
        }))
        .pipe($.eslint.format())
        .pipe($.eslint.failAfterError());
});

gulp.task('clean-assets', function (done) {
    var files = config.paths.assets.all;

    return clean(files);
});

gulp.task('reload', function () {
    gulp.src(config.paths.files)
        .pipe($.connect.reload());
});

gulp.task('fonts', function () {
    gulp.src(config.paths.fonts)
        .pipe(gulp.dest(config.paths.assets.fonts))
        .pipe($.connect.reload());
});

gulp.task('images', function () {
    gulp.src(config.paths.images)
        .pipe(gulp.dest(config.paths.assets.img))
        .pipe($.connect.reload());
});

gulp.task('watch', function () {
    gulp.watch(config.paths.files, ['reload']);
    gulp.watch(config.paths.images, ['images']);
    gulp.watch(config.paths.fonts, ['fonts']);
    gulp.watch(config.paths.sass, ['compile-sass']);
    gulp.watch(config.paths.scripts, ['compile-js']);
});

gulp.task('default', ['fonts', 'images', 'open-dev', 'watch']);
gulp.task('build', ['fonts', 'images', 'open-build', 'watch']);

function clean(path) {
    return gulp.src(path, {
            read: false
        })
        .pipe($.rimraf({
            force: true
        }));
}

function log(msg) {
    if (typeof (msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}