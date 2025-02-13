### Objective

**Understand how to use d3.js with frameworks**

- Think about the separation of responsibilities for different parts of the DOM
- Refresh how d3.js enter/update/exit works

### Questions to check your understanding

- Under what conditions does `xScale` get recomputed? What about `yScale`?
- Why do we need to pass the function `(update) => update` to the `.join` method if it doesn't change anything?
- Which HTML and SVG elements are rendered by the Vue framework and which ones by d3?

### Features to try implementing

- [easy] Change the color of bars in the "update" selection so it's easier to visually differentiate between bars that were just added and bars that were previously visible.
- [medium] When the user hovers over a bar, display the `shortForecast` for that period underneath the bar chart.
- [hard] Change the behavior of the input slider so the d3 transition only begins when the user releases the slider (hint: on `mouseup`).

**Understand how to use CSS to add responsiveness and interactivity**

- Use media queries for different screen sizes
- Change appearance of elements based on their behavior

### Questions to check your understanding

- What does `1fr` mean in CSS grid? (If you need a thorough tutorial, [this](https://cssgridgarden.com/) is a good one.)
- What is the difference between "justify" and "align" in CSS flex?
- What different properties of the page can we use to define a CSS media query?

### Features to try implementing

- [easy] Change a media query breakpoint so that the mobile styles are applied for any screen the size of an iPad or smaller.
- [medium] Use the `cursor` CSS property to style the handle of the range slider in the BarChart component.
- [hard] Add an event listener for the `resize` event on the window. Update the hard-coded SVG width so it is never larger than the window width.
