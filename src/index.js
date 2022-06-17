import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import prettier from 'prettier';
import debug from 'debug';
import 'axios-debug-log';
// import Listr from 'listr';

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

const downloadPage = (url, directoryPath = process.cwd()) => {
  const typeResponseMapping = {
    img: 'arraybuffer',
    script: 'arraybuffer',
    link: 'arraybuffer',
  };
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
    maxRedirects: 0,
    timeout: 500,
    responseType: 'arraybuffer',
  })
    .then((res) => {
      const { data } = res;
      // console.log('res', res);
      debugPageLoader('raw html was successfully loaded');
      sourceData = data;
      return fs.mkdir(filesDirPath);
    })
    .then(() => {
      const $ = cheerio.load(sourceData, {
        normalizeWhitespace: true,
        decodeEntities: false,
      });
      const { modifiedCheerioModel, resourcesLinks } = getResourcesLinks($, URLObject);
      resultedData = modifiedCheerioModel.root().html();
      // console.log(resultedData);
      if (/Server Error/i.test(resultedData)) {
        return Promise.reject(new Error('ENOENT'));
      }
      // const tasksArray = resourcesLinks.map(({ externalLink, localLink, type }) => ({
      //   title: externalLink,
      //   task: () => axios({
      //     method: 'get',
      //     url: externalLink,
      //     // maxRedirects: 0,
      //     timeout: 500,
      //     responseType: typeResponseMapping[type],
      //   }).then((response) => {
      //     debugPageLoader(`resource ${externalLink} was successfully loaded`);
      //     console.log(`resource ${externalLink} was successfully loaded`, response);
      //     // resourcesData.push({ result: 'success', data: response.data, localLink });
      //     return fs.writeFile(path.join(directoryPath, localLink), response.data);
      //   })
      //     .catch((e) => {
      //       console.log(`resource ${externalLink} fails`, e);
      //       debugPageLoader(`error while loading
      //       resource ${externalLink}: ${JSON.stringify(e)}`);
      //       throw e;
      //     }),
      // }));
      // const tasks = new Listr(tasksArray, { concurrent: true });
      // return tasks.run();
      const promises = resourcesLinks.map(({ externalLink, localLink, type }) => axios({
        method: 'get',
        url: externalLink,
        maxRedirects: 0,
        timeout: 500,
        responseType: typeResponseMapping[type],
      }).then((response) => {
        debugPageLoader(`resource ${externalLink} was successfully loaded`);
        return fs.writeFile(path.join(directoryPath, localLink), response.data);
      })
        .catch((e) => {
          debugPageLoader(`error while loading
          resource ${externalLink}: ${JSON.stringify(e)}`);
          return Promise.reject(e);
        }));
      const promise = Promise.all(promises);
      return promise;
    })
    // .then(() => {
    //   const successResponses = resourcesData.filter(({ result }) => result === 'success');
    //   const promises = successResponses
    //     .map(({ localLink, data }) => fs.writeFile(path.join(directoryPath, localLink), data));
    //   return Promise.all(promises);
    // })
    .then(() => fs.writeFile(pagePath, prettier.format(resultedData, { parser: 'html' })))
    .then(() => pagePath);
  // .catch((error) => Promise.reject(error));
};

export default downloadPage;
