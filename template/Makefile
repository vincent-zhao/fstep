TESTS = test/*.test.js
REPORTER = spec
TIMEOUT = 5000
NPM_REGISTRY =
NPM_INSTALL_PRODUCTION = PYTHON=`which python2.6` NODE_ENV=production npm install $(NPM_REGISTRY)
NPM_INSTALL_TEST = PYTHON=`which python2.6` NODE_ENV=test npm install $(NPM_REGISTRY)

MOCHA_OPTS =

init:
	@$(NPM_INSTALL_TEST)
	@node ./build/make.js

test: init
	@NODE_ENV=test ./node_modules/mocha/bin/mocha \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS) \
		$(TESTS)

cov: init
	-rm -f coverage.html
	@$(MAKE) test MOCHA_OPTS='--require blanket' REPORTER=html-cov > coverage.html
	
.PHONY: test
