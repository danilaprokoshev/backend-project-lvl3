import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

export default (url, directoryPath = process.cwd()) => {
  if (!url) {
    return Promise.resolve('the url must not be an empty');
  }
  const { host, pathname } = new URL(url);
  const hrefWithoutProtocol = path.join(host, pathname);
  const filename = hrefWithoutProtocol
    .replace(/[^\w]/g, '-')
    .concat('.html');
  const filePath = path.join(directoryPath, filename);

  return axios({
    method: 'get',
    url,
    responseType: 'text',
  })
    .then(({ data }) => fs.writeFile(filePath, data))
    .then(() => filePath);
};
