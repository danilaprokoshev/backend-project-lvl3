import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import prettier from 'prettier';
import debug from 'debug';
import 'axios-debug-log';

const debugPageLoader = debug('page-loader');

const isEmptyPathname = (pathname) => pathname === '/';
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
  const localFilename = (path.join(host, dir, name)).replace(/[^\w]/g, '-').concat(ext || '.html');

  return path.join(fullFilesDirPath, localFilename);
};

const getResourcesLinks = (cheerioModel, URLObject) => {
  const mapping = {
    img: 'src',
    script: 'src',
    link: 'href',
  };

  const modifiedCheerioModel = cheerioModel;
  const resourcesLinks = [];

  Object.keys(mapping).forEach((resource) => {
    modifiedCheerioModel(resource).each(function handler() {
      const attrToChange = modifiedCheerioModel(this).attr(mapping[resource]);
      if (!attrToChange) {
        return;
      }
      const baseURL = path.join(URLObject.href, '/');
      const attrToChangeURL = new URL(attrToChange, baseURL);
      if (attrToChangeURL.host !== URLObject.host) {
        return;
      }
      // maybe refactor
      const localLink = composeLocalLink(URLObject, attrToChangeURL.pathname);
      modifiedCheerioModel(this).attr(mapping[resource], localLink);
      resourcesLinks.push({ externalLink: attrToChangeURL.href, localLink, type: resource });
    });
  });
  return { modifiedCheerioModel, resourcesLinks };
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
      debugPageLoader('raw html was successfully loaded');
      sourceData = data;
      return fs.mkdir(filesDirPath, { recursive: true });
    })
    .then(() => {
      const $ = cheerio.load(sourceData);
      const { modifiedCheerioModel, resourcesLinks } = getResourcesLinks($, URLObject);
      resultedData = modifiedCheerioModel.root().html();
      const promises = resourcesLinks.map(({ externalLink, localLink, type }) => axios({
        method: 'get',
        url: externalLink,
        responseType: type === 'img' ? 'stream' : 'text',
      })
        .then((response) => {
          debugPageLoader(`resource ${externalLink} was successfully loaded`);
          return ({ result: 'success', data: response.data, localLink });
        })
        .catch((e) => {
          debugPageLoader(`error while loading resource ${externalLink}: ${e}`);
          return ({ result: 'error', error: e });
        }));
      return Promise.all(promises);
    })
    .then((contents) => {
      const successResponses = contents.filter(({ result }) => result === 'success');
      const promises = successResponses
        .map(({ localLink, data }) => fs.writeFile(path.join(directoryPath, localLink), data));
      return Promise.all(promises);
    })
    .then(() => fs.writeFile(pagePath, prettier.format(resultedData, { parser: 'html' })))
    .then(() => pagePath)
    .catch((e) => debugPageLoader(`error while loading page from ${url}: ${e}`));
};
