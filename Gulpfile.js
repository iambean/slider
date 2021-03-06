/**
 * Created by beanmao@tencent.com on 2016/5/10.
 */

'use strict';
let path = require('path'),
    gulp = require('gulp'),
    rename = require('gulp-rename'),
    includeFile = require('gulp-include-file'),
    //transfer es6 style codes to es5 standard codes.
    babel_es2015 = require('babel-preset-es2015'),
    babel = require('gulp-babel');

//get the 'package.json' content.
let pkgJSON = require('./package.json');

//the only thing is babel transfer.
gulp.task('default', function(){
    return gulp.src('src/index.js')
        //static include files
        .pipe(includeFile())
        //babel transfer.
        .pipe(babel({
            presets: [babel_es2015]
        }))
        .pipe(rename(`StaticSlider-${pkgJSON.version}.js`))
        .pipe(gulp.dest('./dist'))
        .pipe(rename(`StaticSlider.js`))
        .pipe(gulp.dest('./dist'))
        //TODO:for job with svn path.
        .pipe(gulp.dest('../../cdn/slider'));
});

