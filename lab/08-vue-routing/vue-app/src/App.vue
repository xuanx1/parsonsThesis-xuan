<template>
  <div>
    <el-menu :default-active="activeIndex" class="el-menu-demo" mode="horizontal" @select="handleSelect">
      <el-menu-item index="1">
        <router-link class="margin-x" to="/">Home</router-link>
      </el-menu-item>
      <el-menu-item index="2">
        <router-link class="margin-x" to="/methodology">Methodology</router-link>
      </el-menu-item>
    </el-menu>
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: "App",
};
</script>

<style>
.margin-x {
  margin: 0px 5px;
}
</style>
