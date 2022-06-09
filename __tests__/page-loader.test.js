/* eslint-disable jest/no-conditional-expect */
import os from 'os';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import nock from 'nock';
import pageLoader from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
const readFixtureFile = (filename) => fs.readFile(getFixturePath(filename), 'utf-8');

nock.disableNetConnect();

let tmpDirPath;

beforeEach(async () => {
  tmpDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

describe('return correct path', () => {
  const url = 'https://ru.hexlet.io/courses';
  const filename = 'ru-hexlet-io-courses.html';

  test('in default directory', async () => {
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, 'OK');
    const tmpPageDirpath = path.join(tmpDirPath, process.cwd());
    await fs.mkdir(tmpPageDirpath, { recursive: true });
    const tmpPageFilePath = path.join(tmpPageDirpath, filename);
    const result = await pageLoader(url, tmpPageDirpath);

    expect(scope.isDone()).toBe(true);
    expect(result).toBe(tmpPageFilePath);
  });

  test('in optional directory', async () => {
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, 'OK');
    const optionalDirectoryPath = '/var/tmp';
    const tmpPageDirpath = path.join(tmpDirPath, optionalDirectoryPath);
    await fs.mkdir(tmpPageDirpath, { recursive: true });
    const tmpPageFilePath = path.join(tmpPageDirpath, filename);
    const result = await pageLoader(url, tmpPageDirpath);

    expect(scope.isDone()).toBe(true);
    expect(result).toBe(tmpPageFilePath);
  });
});

describe('specified urls cases', () => {
  test('given empty url', async () => {
    const result = await pageLoader('');

    expect(result).toBe('the url must not be an empty');
  });

  //   test.skip('given incorrect url', async () => {
  //     const scope = nock(/ru\.hexlet\.io/)
  //       .get(/courses$/)
  //       .reply(400, 'Bad Request');
  //     const url = 'htt://ru.hexlet.io/courses';
  //     const result = await pageLoader(url);

//     expect(scope.isDone()).toBe(false);
//     expect(result).toBe('the url is incorrect');
//   });
});

describe('checks files existence and its content', () => {
  // TODO: add describe each for multiple arguments
  const url = 'https://ru.hexlet.io/courses';
  test('in default directory', async () => {
    const responseHtml = await readFixtureFile('ru-hexlet-io-courses.html');
    const expectedHtml = await readFixtureFile('ru-hexlet-io-courses_changed.html');
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, responseHtml)
      .get(/courses$/)
      .reply(200, responseHtml);
    const result = await pageLoader(url, tmpDirPath);
    const resultedHtml = await fs.readFile(result, 'utf-8');

    expect(scope.isDone()).toBe(true);
    expect(resultedHtml.trim()).toBe(expectedHtml.trim());
  });
  test('check downloading images', async () => {
    const htmlToResponse = await readFixtureFile('mocked-ru-hexlet-io-courses.html');
    const expectedHtml = await readFixtureFile('changed-ru-hexlet-io-courses.html');
    const expectedImage = await readFixtureFile('nodejs.png');
    const imageFilename = 'ru-hexlet-io-assets-professions-nodejs.png';
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, htmlToResponse)
      .get(/assets\/professions\/nodejs.png$/)
      .reply(200, () => createReadStream(getFixturePath('nodejs.png')));

    const result = await pageLoader(url, tmpDirPath);
    const resultedHtml = await fs.readFile(result, 'utf-8');
    const downloadedImagePath = path.join(tmpDirPath, 'ru-hexlet-io-courses_files', imageFilename);
    const resultedImage = await fs.readFile(downloadedImagePath, 'utf-8');

    expect(scope.isDone()).toBe(true);
    expect(resultedImage.trim()).toBe(expectedImage.trim());
    expect(resultedHtml.trim()).toBe(expectedHtml.trim());
  });
  test('check downloading links and scripts', async () => {
    const htmlToResponse = await readFixtureFile('mocked-links-scripts-ru-hexlet-io-courses.html');
    const expectedHtml = await readFixtureFile('changed-links-scripts-ru-hexlet-io-courses.html');
    const expectedCSS = await readFixtureFile('application.css');
    const CSSFilename = 'ru-hexlet-io-assets-application.css';
    const expectedRelatedHtml = await readFixtureFile('mocked-links-scripts-ru-hexlet-io-courses.html');
    const relatedHtmlFilename = 'ru-hexlet-io-courses.html';
    const expectedJS = await readFixtureFile('runtime.js');
    const JSFilename = 'ru-hexlet-io-packs-js-runtime.js';

    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, htmlToResponse)
      .get(/assets\/application.css$/)
      .replyWithFile(200, getFixturePath('application.css'), {
        'Cotent-Type': 'text/css',
      })
      .get(/courses$/)
      .reply(200, htmlToResponse)
      .get(/packs\/js\/runtime.js$/)
      .replyWithFile(200, getFixturePath('runtime.js'), {
        'Cotent-Type': 'text/javascript',
      })
      .get(/assets\/professions\/nodejs.png$/)
      .reply(200, () => createReadStream(getFixturePath('nodejs.png')));

    const result = await pageLoader(url, tmpDirPath);
    const resultedHtml = await fs.readFile(result, 'utf-8');
    const downloadedCSSPath = path.join(tmpDirPath, 'ru-hexlet-io-courses_files', CSSFilename);
    const resultedCSS = await fs.readFile(downloadedCSSPath, 'utf-8');
    const downloadedRelatedHtmlPath = path.join(tmpDirPath, 'ru-hexlet-io-courses_files', relatedHtmlFilename);
    const resultedRelatedHtml = await fs.readFile(downloadedRelatedHtmlPath, 'utf-8');
    const downloadedJSPath = path.join(tmpDirPath, 'ru-hexlet-io-courses_files', JSFilename);
    const resultedJS = await fs.readFile(downloadedJSPath, 'utf-8');

    expect(scope.isDone()).toBe(true);
    expect(resultedHtml.trim()).toBe(expectedHtml.trim());
    expect(resultedCSS.trim()).toBe(expectedCSS.trim());
    expect(resultedRelatedHtml.trim()).toBe(expectedRelatedHtml.trim());
    expect(resultedJS.trim()).toBe(expectedJS.trim());
  });
});

describe('library throw errors', () => {
  const url = 'https://ru.hexlet.io/courses';
  test('throw network error', async () => {
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .replyWithError({
        message: 'Network Error',
        code: 404,
      });
    try {
      await pageLoader(url, tmpDirPath);
    } catch (e) {
      expect(e.message).toMatch('Network Error');
      expect(e.code).toBe(404);
    }
    expect(scope.isDone()).toBe(true);
    expect.assertions(3);
  });
  test('network error (connection problem)', async () => {
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .replyWithError({
        syscall: 'getaddrinfo',
        code: 'ENOTFOUND',
      });
    try {
      await pageLoader(url, tmpDirPath);
    } catch (e) {
      expect(e.syscall).toMatch('getaddrinfo');
      expect(e.code).toMatch('ENOTFOUND');
    }
    expect(scope.isDone()).toBe(true);
    expect.assertions(3);
  });
  test('more network error (loading resources)', async () => {
    const htmlToResponse = await readFixtureFile('mocked-links-scripts-ru-hexlet-io-courses.html');
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, htmlToResponse)
      .get(/assets\/professions\/nodejs.png$/)
      .reply(200, () => createReadStream(getFixturePath('nodejs.png')))
      .get(/packs\/js\/runtime.js$/)
      .replyWithFile(200, getFixturePath('runtime.js'), {
        'Cotent-Type': 'text/javascript',
      })
      .get(/courses$/)
      .reply(200, htmlToResponse)
      .get(/assets\/application.css$/)
      .replyWithError({
        message: 'Unathorized',
        code: 401,
      });
    try {
      await pageLoader(url, tmpDirPath);
    } catch (e) {
      expect(e.message).toMatch('Unathorized');
      expect(e.code).toBe(401);
    }
    expect(scope.isDone()).toBe(true);
    expect.assertions(3);
  });
  test('throw file system error', async () => {
    const htmlToResponse = await readFixtureFile('mocked-ru-hexlet-io-courses.html');
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, htmlToResponse);
    const pathWithDeniedPermission = '/private/var/ma';
    try {
      await pageLoader(url, pathWithDeniedPermission);
    } catch (e) {
      expect(e.code).toMatch('EACCES');
    }
    expect(scope.isDone()).toBe(true);
    expect.assertions(2);
  });
});
