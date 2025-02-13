<template>
  <div>
    <div>
      <label for="days-slider">Number of forecasts to show: {{ days }}</label>
      <input
        type="range"
        :min="3"
        :max="14"
        :value="days"
        @mouseup="setDays"
        name="days-slider"
        id="days"
      />
    </div>
    <div>{{ shortForecast }}</div>
    <svg :height="height" :width="width">
      <g class="bars" />
    </svg>
  </div>
</template>

<script>
import * as d3 from "d3";

const margin = 20;

const DEFAULT_FORECAST = "Hover for Forecast";

export default {
  name: "BarChart",
  data() {
    return {
      days: 7,
      shortForecast: DEFAULT_FORECAST,
    };
  },
  props: { // data is passed in as a prop - this is a read-only property
    data: Array,
    height: Number,
    width: Number,
  },
  computed: {
    xScale() {
      return d3
        .scaleBand()
        .padding(0.1)
        .domain(this.data.map((d) => d.name))
        .range([0, this.width]);
    },
    yScale() {
      return d3
        .scaleLinear()
        .domain([
          Math.min(
            0,
            d3.min(this.data, (d) => d.temperature)
          ),
          d3.max(this.data, (d) => d.temperature),
        ])
        .range([0, this.height - margin]);
    },
    rectWidth() {
      return this.xScale.bandwidth();
    },
  },
  methods: {
    setDays(event) {
      this.days = +event.target.value; // convert to number
    },
  },
  updated() {
    const that = this;
    d3.select(".bars")
      .selectAll("g.bar")
      .data((this.data || []).slice(0, this.days)) // only show the number of days selected
      .join(
        (enter) => {
          enter = enter.append("g").attr("class", "bar");
          const rect = enter
            .append("rect")
            .attr("width", this.rectWidth)
            .attr("height", 0)
            .attr("y", this.height)
            .attr("x", (d) => this.xScale(d.name))
            .attr("fill", "lightblue");
          rect
            .transition()
            .delay((_, i) => i * 50) // delay each bar by 50ms - creating transition animation
            .attr("y", (d) => this.height - this.yScale(d.temperature))
            .attr("height", (d) => this.yScale(d.temperature));

          const nameText = enter
            .append("text")
            .attr("class", "name-text")
            .attr("y", this.height + this.rectWidth)
            .attr("x", (d) => this.xScale(d.name))
            .attr(
              "transform",
              (d) => `rotate(-90 ${this.xScale(d.name)} ${this.height})`
            )
            .attr("opacity", 0)
            .text((d) => d.name);
          nameText.transition().attr("opacity", 1);

          const tempText = enter
            .append("text")
            .attr("class", "temp-text")
            .attr("text-anchor", "middle")
            .attr("x", (d) => this.xScale(d.name) + this.rectWidth / 2)
            .attr("y", this.height)
            .text((d) => d.temperature);
          tempText
            .transition()
            .delay((_, i) => 100 + i * 50)
            .attr("y", (d) => this.height - this.yScale(d.temperature) - 5);

          return enter;
        },
        (update) => {
          update
            .select("rect")
            .attr("fill", "lightgreen")
            .attr("width", this.rectWidth)
            .attr("x", (d) => this.xScale(d.name));
          update
            .select(".name-text")
            .attr("y", this.height + this.rectWidth)
            .attr("x", (d) => this.xScale(d.name))
            .attr(
              "transform",
              (d) => `rotate(-90 ${this.xScale(d.name)} ${this.height})`
            );
          update
            .select(".temp-text")
            .attr("x", (d) => this.xScale(d.name) + this.rectWidth / 2);
          return update;
        },
        (exit) => {
          exit
            .select("rect")
            .transition()
            .attr("height", 0)
            .attr("y", this.height)
            .on("end", () => {
              exit.remove();
            });
          exit.select("text").transition().attr("opacity", 0);
          return exit;
        }
      )
      .on("mouseenter", (event, d) => {
        that.shortForecast = d.shortForecast;
      })
      .on("mouseleave", () => {
        that.shortForecast = DEFAULT_FORECAST;
      });
  },
};
</script>

<style>
input[type="range"]::-webkit-slider-thumb {
  cursor: ew-resize; /* grab */
}
</style>
