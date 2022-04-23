import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import prettier from 'prettier';

const isEmptyPathname = (pathname) => pathname === '/';
// TODO: import from parser dir
const composeLink = (URLObject, srcLink) => {
  const relativeURL = path.parse(srcLink);
  if (relativeURL.root === '/') {
    return `${URLObject.origin}${srcLink}`;
  }
  return `${URLObject.href}/${srcLink}`;
};
// TODO: import from parser dir
const composeLocalLink = (URLObject, srcLink) => {
  const { host, pathname } = URLObject;
  const hrefWithoutProtocol = path.join(host, isEmptyPathname(pathname) ? '' : pathname);
  const filesDirPath = hrefWithoutProtocol
    .replace(/[^\w]/g, '-');
  // TODO: pass dirname as arg
  const dirName = '_files';
  const fullFilesDirPath = `${filesDirPath}${dirName}`;
  const { dir, name, ext } = path.parse(srcLink);
  const localFilename = (path.join(host, dir, name)).replace(/[^\w]/g, '-').concat(ext);

  return path.join(fullFilesDirPath, localFilename);
};

export default (url, directoryPath = process.cwd()) => {
  if (!url) {
    return Promise.resolve('the url must not be an empty');
  }
  let sourceData;
  let resultedData;
  const URLObject = new URL(url);
  // TODO: add checking URL
  const { host, pathname } = URLObject;
  const hrefWithoutProtocol = path.join(host, isEmptyPathname(pathname) ? '' : pathname);
  const filename = hrefWithoutProtocol
    .replace(/[^\w]/g, '-');
  const ext = '.html';
  const filesDirName = '_files';
  const pagePath = path.join(directoryPath, `${filename}${ext}`);
  const filesDirPath = path.join(directoryPath, `${filename}${filesDirName}`);

  return axios({
    method: 'get',
    url,
    responseType: 'text',
  })
    .then(({ data }) => {
      sourceData = data;
      return fs.mkdir(filesDirPath, { recursive: true });
    })
    .then(() => {
      const $ = cheerio.load(sourceData);

      const imageLinks = [];
      // TODO: abstract to func with polimorphism
      $('img').each(function handler() {
        const attrToChange = $(this).attr('src');
        // TODO: add new URL constr to identify host name (e.g. script has the the same host)
        if (!attrToChange.startsWith('http')) {
          const externalLink = composeLink(URLObject, attrToChange);
          const localLink = composeLocalLink(URLObject, attrToChange);
          $(this).attr('src', localLink);
          imageLinks.push({ externalLink, localLink });
        }
      });
      resultedData = $.root().html();
      const promises = imageLinks.map(({ externalLink, localLink }) => axios({
        method: 'get',
        url: externalLink,
        responseType: 'stream',
      })
        .then((response) => ({ result: 'success', data: response.data, localLink }))
        .catch((e) => ({ result: 'error', error: e })));
      const promise = Promise.all(promises);
      return promise;
    })
    .then((contents) => {
      const successResponses = contents.filter(({ result }) => result === 'success');
      const promises = successResponses
        .map(({ localLink, data }) => fs.writeFile(path.join(directoryPath, localLink), data));
      return Promise.all(promises);
    })
    .then(() => fs.writeFile(pagePath, prettier.format(resultedData, { parser: 'html' })))
    .then(() => pagePath)
    .catch((e) => console.log(e));
};
