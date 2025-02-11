<template>
  <div>
    <h1>Making decisions based on the weather forecast</h1>
    <UmbrellaRecommender :recommendation="recommendation" />
    <h3>Next daytime temperature: {{ firstDaytimePeriod.temperature }}</h3>
    <BikeRecommender :recommendation="recommendation" />
  </div>
</template>

<script>
import BikeRecommender from "./components/BikeRecommender.vue";
import UmbrellaRecommender from "./components/UmbrellaRecommender.vue";

const API_URL = "https://api.weather.gov/gridpoints/OKX/33,37/forecast";
export default {
  name: "App",
  components: {
    BikeRecommender,
    UmbrellaRecommender,
  },
  data() {
    return {
      forecast: null,
    };
  },
  computed: {
    umbrellaRecommendation() {
      if (
        !this.forecast ||
        !this.forecast.properties ||
        !this.forecast.properties.periods ||
        !this.forecast.properties.periods.length
      ) {
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
    /**
     * Retrieves the first daytime period from the forecast. The first daytime period object if found, otherwise an empty object.
     */
    firstDaytimePeriod() {
      if (!this.forecast) {
        return {};
      }
      console.log(this.forecast);
      const daytimePeriod = this.forecast.properties.periods.find(
        (d) => d.isDaytime
      );
      return daytimePeriod || {};
    },
    recommendation() {
      const { temperature } = this.firstDaytimePeriod;
      if (temperature === undefined) {
        return null;
      }
      return temperature >= 45 && temperature < 80;  
      // Check if the temperature is between 45 and 80 (inclusive of 45 and exclusive of 80)
      // If true, return true; otherwise, return false
    },
  },
  mounted() {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => {
        this.forecast = data;
      });
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
</style>
