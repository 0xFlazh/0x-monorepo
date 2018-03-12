import { postpublishUtils } from '@0xproject/dev-utils';
import { execAsync } from 'async-child-process';
import * as _ from 'lodash';

import * as packageJSON from '../package.json';
import * as tsConfig from '../tsconfig.json';

const cwd = `${__dirname}/..`;
const subPackageName = (packageJSON as any).name;
// Include any external packages that are part of the 0x.js public interface
// to this array so that TypeDoc picks it up and adds it to the Docs JSON
// So far, we only have @0xproject/types as part of 0x.js's public interface.
const fileIncludes = [...(tsConfig as any).include, '../types/src/index.ts'];
const fileIncludesAdjusted = postpublishUtils.adjustFileIncludePaths(fileIncludes, __dirname);
const projectFiles = fileIncludesAdjusted.join(' ');
const S3BucketPath = 's3://0xjs-docs-jsons/';

(async () => {
    const tagAndVersion = await postpublishUtils.getLatestTagAndVersionAsync(subPackageName);
    const tag = tagAndVersion.tag;
    const version = tagAndVersion.version;

    const releaseName = postpublishUtils.getReleaseName(subPackageName, version);
    const assets = [`${__dirname}/../_bundles/index.js`, `${__dirname}/../_bundles/index.min.js`];
    const release = await postpublishUtils.publishReleaseNotesAsync(tag, releaseName, assets);

    // tslint:disable-next-line:no-console
    console.log('POSTPUBLISH: Release successful, generating docs...');
    const jsonFilePath = `${__dirname}/../${postpublishUtils.generatedDocsDirectoryName}/index.json`;

    const result = await execAsync(`JSON_FILE_PATH=${jsonFilePath} PROJECT_FILES="${projectFiles}" yarn docs:json`, {
        cwd,
    });
    if (!_.isEmpty(result.stderr)) {
        throw new Error(result.stderr);
    }
    const fileName = `v${version}.json`;
    // tslint:disable-next-line:no-console
    console.log(`POSTPUBLISH: Doc generation successful, uploading docs... as ${fileName}`);
    const s3Url = S3BucketPath + fileName;
    return execAsync(`S3_URL=${s3Url} yarn upload_docs_json`, {
        cwd,
    });
})().catch(console.error);
