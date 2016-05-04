BIN := node_modules/.bin
TYPESCRIPT := $(shell jq -r '.files[]' tsconfig.json | grep -Fv .d.ts)

all: $(TYPESCRIPT:%.ts=%.js) .npmignore .gitignore

$(BIN)/tsc:
	npm install

.npmignore: tsconfig.json
	echo $(TYPESCRIPT) Makefile tsconfig.json | tr ' ' '\n' > $@

.gitignore: tsconfig.json
	echo $(TYPESCRIPT:%.ts=%.js) | tr ' ' '\n' > $@

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc
