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

  test.skip('given incorrect url', async () => {
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(400, 'Bad Request');
    const url = 'htt://ru.hexlet.io/courses';
    const result = await pageLoader(url);

    expect(scope.isDone()).toBe(false);
    expect(result).toBe('the url is incorrect');
  });
});

describe('checks files existence and its content', () => {
  // TODO: add describe each for multiple arguments
  const url = 'https://ru.hexlet.io/courses';
  test('in default directory', async () => {
    const expectedHtml = await readFixtureFile('ru-hexlet-io-courses.html');
    const scope = nock(/ru\.hexlet\.io/)
      .get(/courses$/)
      .reply(200, expectedHtml);
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
});
