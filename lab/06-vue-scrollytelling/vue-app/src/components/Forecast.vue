<template>
  <el-card class="card" shadow="always" :style="{ opacity: 1 - progress }">
    <div>
      <strong> Section {{ data.number }} </strong>
      ({{ parseInt(progress * 100) }}%)
      <h2>
        <p>{{ data.name }}</p>
      </h2>
      <p>{{ data.detailedForecast }}</p>
      <img :src="data.icon" :alt="data.shortForecast" />
    </div>
  </el-card>
</template>

<script>
export default {
  name: "Forecast",
  props: {
    data: Object,
    progress: Number,
  },
};
</script>

<style>
// center the card
.card {
  margin: 0 auto;
  width: 200px;
}
</style>
