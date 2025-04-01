<template>
  <div class="prompt-input">
    <el-input
      :disabled="thinking"
      placeholder="Ask about the housing lottery..."
      v-model="prompt"
      @keyup.enter="getResponse"
      type="textarea"
    ></el-input>
  </div>
  <div v-html="parsedMarkdown" class="chat-textarea"></div>
</template>

<script>
import { GoogleGenAI } from "@google/genai";
import MarkdownIt from "markdown-it";

export default {
  name: "Chat",
  props: {
    lotteries: {
      type: Array,
      default: () => [],
    },
    lottery_stats: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      thinking: true,
      prompt: "",
      response: "",
      chat: null,
      ai: null
      }
  },
  async mounted() {
    // Initialize genAI with the API key from the .env file
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = new GoogleGenAI({ apiKey: apiKey });

    this.chat = this.ai.chats.create({
      model: "gemini-2.0-flash",
      temperature: 0.5, // Adjust the temperature for creativity. Low values are more deterministic. High values are more creative.
      history: [
        {
          role: "user",
          parts: [
            { text: "Hello. Tell me about Housing Lotteries" },
            { text: "What is the average number of applicants in the Bronx?" },
            { text: "What's the highest Household income in Brooklyn?" },
            { text: "Compare with Bronx?" },
            { text: "Summarize this lottery in a card" },
            { text: "What's the number of lotteries and rent ranges in 2017?" },
            { text: "What can I ask?" },
          ],
        },
        {
          role: "model",
          parts: [
            { text: "Let me summariz the housing lotteries across boros?" },
            { text: "Here a summary for for those units in the Bronx" },
            { text: "Here is a summary of Household Income in Brooklyn" },
            { text: "Here is an analysis comparing Brooklyn and the Bronx" },
            { text: "Ok, let me show you a brief summary",},
            { text: "Here are lotteries that took place in 2017" },
            { text: "Here is JSON data for Brooklyn" },
            { text: "Here are some interesting follow-up questions" },
          ],
        },
      ],
    });
    let message =
      "Briefly analze this housing lottery data. Only provide detailed summaries and analysis when prompted:" +
      JSON.stringify(this.lotteries);
    message +=
      "Here are lottery stats. `LTTRY_PROJ_NO` and `Lottery Number` is the common key to connect the two data sets." +
      JSON.stringify(this.lottery_stats);
    message +=
      "Please provide a summary of the data and some interesting follow-up questions.";
    const response = await this.chat.sendMessage({
      message: message,
    });
    this.response = response.text;
    console.log("Chat response:", this.response);
    this.thinking = false;
  },
  computed: {
    parsedMarkdown() {
      const md = new MarkdownIt();
      return md.render(this.response);
    },
  },
  methods: {
    async getResponse() {
      this.thinking = true;
      console.log("Prompt:", this.prompt);
      // Send the prompt to the chat model
      const response = await this.chat.sendMessage({
        message: this.prompt,
      });
        // Just a regular response
        this.response = response.text;
        console.log("Chat response:", this.response);

      this.thinking = false;
    },
    showCard() {
      console.log("Card shown");
    },
  },
};
</script>

<style>
.prompt-input {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  width: 600px;
  transform: translate(-50%, -50%);
  margin: 1rem;
  z-index: 1;
}
.chat-textarea {
  text-align: left;
  max-width: 800px;
  line-height: 1.6;
  font-size: 16px;
  color: #333;
  word-wrap: break-word;
  margin: 1rem auto;
  padding: 1rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
