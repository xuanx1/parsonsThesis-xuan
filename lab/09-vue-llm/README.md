# Overview of Large Language Models (LLMs)

## Gemini
An AI model by Google designed for advanced reasoning and multimodal tasks.  
- **Setup Key**: Access via [Google Cloud Console](https://console.cloud.google.com/), [AI Studio](https://aistudio.google.com/), or CLI and enable the Gemini API.  
- **Docs**: [JavaScript](https://ai.google.dev/gemini-api/docs/text-generation#javascript)
- **Cookbook**[Cookbook](https://ai.google.dev/gemini-api/cookbook)
### Steps to Add .env and Use the API Key

To integrate the `.env` file for securely storing your `GOOGLE_API_KEY` and initialize genAI using it, follow these steps:
**Install dotenv (if not already installed)**:  
    If you're using Vite, it automatically supports `.env` files. However, if you're using Webpack or another build tool, you may need to install `dotenv`:  
```bash
npm install dotenv
```
1. **Create a `.env` File**:  
    In the root of your project, create a `.env` file.

2. **Add your `GOOGLE_API_KEY` to the `.env` File**:  
    ```plaintext
    GOOGLE_API_KEY=your_api_key_here
    ```
3. **Update `vue.config.js` to Use `dotenv-webpack`**:  
    Update your `vue.config.js` file to include the `dotenv-webpack` plugin:  
    ```javascript
    const Dotenv = require('dotenv-webpack');

    module.exports = {
        configureWebpack: {
        plugins: [
            new Dotenv(),
        ],
        },
    };
    ```

**Install Dependencies**:  
Run the following command to install the required package:  
```bash
npm install @google/genai
```

**Add to `package.json`**:  
To ensure the dependency is saved in your `package.json`, use the `--save` flag:  
```bash
npm install @google/genai --save
```
This will add the package to the `dependencies` section of your `package.json` file.

## ChatGPT
An AI model by OpenAI optimized for conversational tasks and general-purpose use.  
- **Setup Key**: Sign up at OpenAI, generate an API key in the user dashboard.  
- **Docs**: [ChatGPT API Docs](https://platform.openai.com/docs/)  

## Claude
An AI assistant by Anthropic focused on ethical and safe conversational AI.  
- **Setup Key**: Request API access via Anthropic's website.  
- **Docs**: [Claude API Docs](https://www.anthropic.com/index/api)  

## LLaMA
A family of open-source language models by Meta, designed for research and experimentation.  
- **Setup Key**: Download weights after approval from Meta's research portal.  
- **Docs**: [LLaMA GitHub](https://github.com/facebookresearch/llama)  

## Summary
- **Cost**: Gemini and ChatGPT are paid services; Claude offers limited free access; LLaMA is free and open-source.  
- **Open Source**: Only LLaMA is fully open-source, while others are proprietary.