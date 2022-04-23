import fs from 'fs/promises';
import axios from 'axios';

axios({
  method: 'GET',
  url: 'https://eloquentjavascript.net/img/cover.jpg',
  responseType: 'arraybuffer',
})
  .then((response) => {
    fs.writeFile('/var/tmp/1.png', response.data);
    console.log(response.data);
  });
