const execAsync = require('async-child-process').execAsync;
const postpublish_utils = require('../../../scripts/postpublish_utils');
const tsConfig = require('../tsconfig.json');

const cwd = __dirname + '/..';
const S3BucketPath = 's3://staging-0xjs-docs-jsons/';
// Include any external packages that are part of the 0x.js public interface
// to this array so that TypeDoc picks it up and adds it to the Docs JSON
// So far, we only have @0xproject/types as part of 0x.js's public interface.
const fileIncludes = [...tsConfig.include, '../types/src/index.ts'];
const fileIncludesAdjusted = postpublish_utils.adjustFileIncludePaths(fileIncludes, __dirname);
const projectFiles = fileIncludesAdjusted.join(' ');
const jsonFilePath = __dirname + '/../' + postpublish_utils.generatedDocsDirectoryName + '/index.json';
const version = process.env.DOCS_VERSION;

execAsync('JSON_FILE_PATH=' + jsonFilePath + ' PROJECT_FILES="' + projectFiles + '" yarn docs:json', {
    cwd,
})
    .then(function(result) {
        if (result.stderr !== '') {
            throw new Error(result.stderr);
        }
        const fileName = 'v' + version + '.json';
        const s3Url = S3BucketPath + fileName;
        return execAsync('S3_URL=' + s3Url + ' yarn upload_docs_json', {
            cwd,
        });
    })
    .catch(function(err) {
        console.log(err);
    });
