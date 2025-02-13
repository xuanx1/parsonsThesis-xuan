<template>
  <div>
    <h1>Making decisions based on the weather forecast</h1>
    <h3>Next daytime temperature: {{ firstDaytimePeriod.temperature }}</h3>
    <div class="recommendation-group">
      <BikeRecommender :recommendation="bikeRecommendation" />
      <UmbrellaRecommender :recommendation="umbrellaRecommendation" />
    </div>
    <BarChart :data="periods" :height="400" :width="width" />
  </div>
</template>

<script>
import BikeRecommender from "./components/BikeRecommender.vue";
import UmbrellaRecommender from "./components/UmbrellaRecommender.vue";
import BarChart from "./components/BarChart.vue";

const API_URL = "https://api.weather.gov/gridpoints/OKX/33,37/forecast";
const MAX_SVG_WIDTH = 600;

export default {
  name: "App",
  components: {
    BikeRecommender,
    UmbrellaRecommender,
    BarChart,
  },
  data() {
    return {
      forecast: null,
      width: MAX_SVG_WIDTH,
    };
  },
  computed: {
    periods() {
      if (!this.forecast || !this.forecast.properties) {
        return [];
      }
      return this.forecast.properties.periods;
    },
    firstDaytimePeriod() {
      const daytimePeriod = this.periods.find((d) => d.isDaytime);
      return daytimePeriod || {};
    },
    bikeRecommendation() {
      const { temperature } = this.firstDaytimePeriod;
      if (temperature === undefined) {
        return null;
      }
      return temperature >= 45 && temperature < 80;
    },
    umbrellaRecommendation() {
      if (!this.periods.length) {
        return false;
      }
      const nextDaytimeForecast = this.forecast.properties.periods.find(
        (d) => d.isDaytime
      );
      if (!nextDaytimeForecast) {
        return false;
      }
      return nextDaytimeForecast.shortForecast.includes("Rain");
    },
  },
  methods: {
    onResize() {
      this.width = Math.min(MAX_SVG_WIDTH, window.innerWidth);
    },
  },
  mounted() {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => {
        this.forecast = data;
      });

    window.addEventListener("resize", this.onResize);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.onResize);
  },
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
}

.recommendation-group {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}

@media (max-width: 768px) {
  .recommendation-group {
    flex-direction: column;
    align-items: center;
  }
}
</style>
