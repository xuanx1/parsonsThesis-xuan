<template>
  <div class="prompt-input">
    <el-input
      :disabled="thinking"
      placeholder="Ask about housing lotteries..."
      v-model="prompt"
      @keyup.enter="getResponse"
      type="textarea"
    ></el-input>
  </div>
  <div class="cards"></div>
  <div v-html="parsedMarkdown" class="chat-textarea"></div>
</template>

<script>
import { Type, GoogleGenAI } from "@google/genai";
import MarkdownIt from "markdown-it";

// Define a function that the model can call to control smart lights
const createCard = {
  name: "showCard",
  description: "Creates a lottery summary on a card.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      lottery: {
        type: Type.NUMBER,
        description: "Lottery identifier.",
      },
      title: {
        type: Type.STRING,
        description: "Title of the lottery.",
      },
      units: {
        type: Type.NUMBER,
        description: "Number of units in the lottery.",
      },
      rent: {
        type: Type.NUMBER,
        description: "Rent amount for the lottery.",
      },
      applicants: {
        type: Type.NUMBER,
        description: "Number of applicants for the lottery.",
      },
    },
    required: ["lottery", "title", "units", "rent", "applicants"],
  },
};

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
      ai: null,
      config: {
        tools: [
          {
            functionDeclarations: [createCard],
          },
        ],
      },
    };
  },
  async mounted() {
    // Initialize genAI with the API key from the .env file
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = new GoogleGenAI({ apiKey: apiKey });

    this.chat = this.ai.chats.create({
      model: "gemini-2.0-flash",
      config: this.config, // Pass the config to the chat model
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
            { text: "Summarize this lottery in a card" },
          ],
        },
        {
          role: "model",
          parts: [
            { text: "Let me summarize the housing lotteries across boros?" },
            { text: "Here a summary for for those units in the Bronx" },
            { text: "Here is a summary of Household Income in Brooklyn" },
            { text: "Here is an analysis comparing Brooklyn and the Bronx" },
            { text: "Ok, let me show you a brief summary" },
            { text: "Here are lotteries that took place in 2017" },
            { text: "Here are some interesting follow-up questions" },
            { text: "Creating card" },
          ],
        },
      ],
    });
    let message =
      "Briefly analze this housing lottery data, provide detailed examples analysis when prompted:" +
      JSON.stringify(this.lotteries);
    message +=
      "Here are lottery stats. `LTTRY_PROJ_NO` and `Lottery Number` is the common key to connect the two data sets." +
      JSON.stringify(this.lottery_stats);
    message +=
      "Please provide a summary of the data and some interesting follow-up questions.";
    message +=
      "Call the function `showCard` to create a card with the lottery summary if prompted, or there are less than 10 results. Pass the title, lottery number, units, rent, and number of applicants as parameters.";
    const response = await this.chat.sendMessage({
      message: message,
    });
    this.response = response.text;
    console.log("Chat response:", this.response);
    this.thinking = false;
  },
  computed: {
    parsedMarkdown() {
      if (typeof this.response === "string") {
        const md = new MarkdownIt();
        return md.render(this.response);
      }
      return "";
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
      // Check if the response contains a function call
      if (response.functionCalls && response.functionCalls.length > 0) {
        response.functionCalls.forEach((functionCall) => {
          console.log("Function Response:", functionCall);
          const args = functionCall.args || {};
          const lottery = args.lottery || null;
          const title = args.title || "--";
          const units = args.units || "--";
          const rent = args.rent || "--";
          const applicants = args.applicants || "--";
          // Call the showCard function with the parameters
          this.showCard(lottery, title, units, rent, applicants);
        });
      }

      // Just a regular response
      this.response = response.text;
      console.log("Chat response:", this.response);

      this.thinking = false;
    },
    showCard(lottery, title, units, rent, applicants) {
      // Create a card with the lottery summary
      const cardContainer = document.querySelector(".cards");
      if (cardContainer) {
        const card = document.createElement("div");
        card.classList.add("card");
        card.innerHTML = `
            <p>Lottery Number: <strong>${lottery}</strong></p>
            <p>Title: <strong>${title}</strong></p>
            <p>Units: <strong>${units}</strong></p>
            <p>Rent: <strong>$${rent}</strong></p>
            <p>Applicants: <strong>${applicants}</strong></p>
        `;
        card.addEventListener("click", () => {
          if (!this.thinking) {
            this.prompt = `Tell me more about lottery number ${lottery} (detailed text summary)`;
            this.getResponse();
          }
        });
        cardContainer.appendChild(card);
      }
      console.log("Card shown");
    },
  },
};
</script>

<style>
p {
  margin: 0;
}

.prompt-input {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  width: 600px;
  transform: translate(-50%, -50%);
  margin: 1rem;
  z-index: 1;
}

.cards {
  position: fixed;
  top: 1rem;
  width: 100%;
  margin: 1rem;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.card {
  font-size: 11px;
  width: 240px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  transition: transform 0.2s ease-in-out;
  backdrop-filter: blur(20px);
}

.card:hover {
  transform: scale(1.02);
}

.card:active {
  transform: scale(0.98);
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
