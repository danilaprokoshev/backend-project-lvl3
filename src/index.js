import axios from 'axios';

export default (url, dirPath = process.cwd()) => axios.get(url);
