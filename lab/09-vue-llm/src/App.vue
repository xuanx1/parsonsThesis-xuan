<template>
  <h2>Ask Gemini about Housing Lotteries</h2>
  <div class="section">
    <Lottery :lotteries="filteredLotteries" :lottery_stats="lottery_stats" />
  </div>
  <!-- <Chat v-if="lotteries && lottery_stats" :lotteries="lotteries" :lottery_stats="lottery_stats" /> -->
  <ChatTextResponseOnly
     v-if="lotteries && lottery_stats"
     :lotteries="lotteries"
     :lottery_stats="lottery_stats"
   />
</template>

<script>
import Lottery from "./components/Lottery.vue";
// import Chat from "./components/Chat.vue";
import ChatTextResponseOnly from "./components/ChatTextResponseOnly.vue";

import * as d3 from "d3";

export default {
  name: "App",
  data() {
    return {
      lotteries: null,
      lottery_stats: null,
      filters: ["1", "2", "3", "4", "5"],
    };
  },
  computed: {
    filteredLotteries() {
      if (!this.lotteries) {
        return null;
      }
      return this.lotteries.filter((d) => this.filters.includes(d.Boro));
    },
  },
  components: {
    Lottery,
    // Chat,
    ChatTextResponseOnly,
  },
  mounted() {
    Promise.all([
      d3.csv("housing_lotteries.csv"),
      d3.csv("lottery_income_household.csv"),
    ]).then((data) => {
      this.lotteries = data[0];
      this.lottery_stats = data[1];
    });
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  position: relative;
}

.section {
  height: 500px;
}
</style>
