import pageLoader from '../src/index.js';

test('return right path', async () => {
  const url = 'https://ru.hexlet.io/courses';
  const data = await pageLoader(url, 'home/user/current-dir');

  expect(data).toBe('home/user/current-dir/ru-hexlet-io-courses.html');
});
