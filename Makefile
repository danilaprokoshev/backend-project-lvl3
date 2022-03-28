install:
	npm ci

lint:
	npx eslint .

lint-fix:
	npx eslint . --fix

test:
	npm test

page-loader:
	node bin/page-loader.js

publish:
	npm publish --dry-run
