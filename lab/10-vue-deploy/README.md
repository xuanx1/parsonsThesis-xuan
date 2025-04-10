# Deploy to GitHub Pages
This guide provides three distinct methods for deploying your Vue.js application to GitHub Pages. Select the approach that aligns best with your workflow and project requirements. You only need to follow one method to successfully deploy your app.

---

## Approach 1: Vue CLI Built-in Deployment Command

1. **Install `gh-pages`**  
   Install the `gh-pages` package:
   ```bash
   npm install gh-pages --save-dev
   ```

2. **Add a Deployment Script**  
   Add the following script to your `package.json`:
   ```json
   "scripts": {
       "deploy": "vue-cli-service build && gh-pages -d dist"
   }
   ```

3. **Run the Deployment Script**  
   Deploy your app with:
   ```bash
   npm run deploy
   ```
---

## Approach 2: Manual Deployment with Shell Script

1. **Create a `gh-pages` Branch**  
   - Create the `gh-pages` branch in your repository.  
   - Update your repo's settings to deploy from the `gh-pages` branch.

2. **Configure `vue.config.js`**  
   Add or update the `vue.config.js` file in your project root:
   ```javascript
   module.exports = {
       publicPath: process.env.NODE_ENV === 'production'
           ? '/thesis/' // Replace with your repository name
           : '/'
   };
   ```

3. **Run the Deployment Script**  
   From your `vue-app` root directory, run the following command:
   ```bash
   URL=https://github.com/danielsauter/thesis bash local-build-vue.sh
   ```

---

## Approach 3: Automated Deployment with GitHub Actions

1. **Create a Workflow File**  
   Add a `.github/workflows/deploy.yml` file to your repository:
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches:
         - main

   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest

       steps:
       - name: Checkout code
         uses: actions/checkout@v3

       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
           node-version: 16

       - name: Install dependencies
         run: npm install

       - name: Build the app
         run: npm run build

       - name: Deploy to GitHub Pages
         uses: peaceiris/actions-gh-pages@v3
         with:
           github_token: ${{ secrets.GITHUB_TOKEN }}
           publish_dir: ./dist
   ```

2. **Commit and Push**  
   Push the workflow file to your repository. GitHub Actions will automatically build and deploy your app to the `gh-pages` branch whenever you push to the `main` branch.

**Example Directory Structure**
Here’s how your project structure might look:

```
/
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml
├── vue-app/
│   ├── dist/                # Generated during build, ignored by .gitignore
│   ├── src/
│   ├── package.json
│   ├── vue.config.js
│   └── node_modules/
├── README.md
└── package.json
```

---

## Notes

- **Repository Settings**: Ensure your GitHub repository is configured to deploy from the `gh-pages` branch.
- **Public Path**: Update the `publicPath` in `vue.config.js` to match your repository name for proper asset loading.
- **Clean Up**: Remove old files from the `gh-pages` branch if necessary:
  ```bash
  git push origin --delete gh-pages
  ```
- **Node Option**:`--openssl-legacy-provider`: This specific option tells Node.js to use the legacy OpenSSL provider instead of the newer OpenSSL 3.0 provider. Use it if you are using Node.js 17 or later

Choose the approach that best fits your workflow!