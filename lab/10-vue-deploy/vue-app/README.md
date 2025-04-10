# vue-app

## Project setup

```
yarn install
```

### Compiles and hot-reloads for development

```
yarn serve
```

### Compiles and minifies for production

```
yarn build
```

### Lints and fixes files

```
yarn lint
```

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).

### Node requirements

This code requires node version 18 or higher
Use `nvm install 18` to install and set current node version, or use `nvm use 18` to switch.

### Troubleshoot

If you get an error related to openssl-legacy-provider, change `package.json` scripts from:

```
"export NODE_OPTIONS=--openssl-legacy-provider && vue-cli-service serve"
```
```
"vue-cli-service serve"
```