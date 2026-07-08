# maptalks.biglayer (深度优化版)
----
这是一个用于使用原生 WebGL 渲染百万级海量数据的高性能图层插件，支持 Maptalks 2D 引擎以及最新的基于 WebGL 的 3D 矢量地图引擎（如 `ispace-gl` 和 Maptalks 1.x 系列）。

## ✨ 核心优化与增强特性 (Core Optimizations)

本插件经过了深度的底层架构重构与性能调优，完美解决了在海量数据加载与复杂 3D 地图交互中的各类边界问题：

### 1. 3D 地图相机矩阵对齐 (彻底解决缩放/拖拽漂移)
* 针对 Maptalks 1.x / `ispace-gl` 引入的 WebGL 3D 渲染引擎，本插件摒弃了老旧的 2D 仿射相机推算，**直接桥接底图的官方 3D 相机投影矩阵 (`map.projViewMatrix`)**。
* 通过坐标分辨率的自适应缩放补偿，彻底解决了在地图进行拖拽、缩放、倾斜（Pitch）和旋转（Bearing）时点位脱离底图产生漂移的问题，实现了 100% 严丝合缝的坐标对齐。
* 完美向下兼容 Maptalks 0.x (0.37.0) 等无 3D 矩阵支持的老版本地图。

### 2. 极致的内存与 GC 优化 (Float32Array 重构)
* 在底层构建 WebGL 坐标系顶点数据时，全面抛弃了原生的 JS 动态数组 (`Array.push`)。
* 引擎在数据解析前会**预分配连续的 `Float32Array` 内存块**，采用原生指针偏移量进行极速定址赋值。
* 这使得在加载数十万甚至数百万点位时，加载解析速度暴增数倍，并且**实现“零垃圾回收（GC）碎片”**，彻底告别了海量数据初次加载造成的页面“顿卡”。

### 3. 企业级 WebGL 显存管理与灾备恢复 (Context Loss)
* 实现了完美的 WebGL **垃圾自动回收（GC）机制**。当图层从地图上移除（`removeLayer`）时，其内部创建的几十百兆的 VBO（顶点缓冲区）、Shader 碎片、Program 句柄以及 Texture 贴图会被 100% 释放，彻底告别多图层切换引发的 GPU 显存泄露。
* 植入了强壮的 `webglcontextlost` 显存崩溃监听。当显卡资源被系统强行回收或休眠唤醒时，插件能够**全自动静默恢复**所有的渲染状态并重新推流顶点数据，打造极其健壮的 7x24 小时大屏可视化底座。

### 4. 其他细节优化
* **多倍屏 (Retina) 高清适配**：动态匹配设备的 `devicePixelRatio`，防止高分屏下渲染视口失真模糊。
* **Alpha 双缓冲区修复**：修正了原生默认配置中的拼写错误，激活 `doubleBuffer`，杜绝混合模式下的图标边缘黑块。
* **构建支持升级**：修正了 `graceful-fs` 依赖锁定，完美支持在现代 Node (如 v20/v26) 环境下直接打包编译。

## 📦 安装与使用

### 引入依赖

确保您的项目中已经引入了 `maptalks`。然后引入本插件的最新构建文件：
```html
<!-- 引入 maptalks 基础库 -->
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/maptalks/dist/maptalks.min.js"></script>
<!-- 引入优化后的 biglayer -->
<script type="text/javascript" src="dist/maptalks.biglayer.min.js"></script>
```

### 快速起步 (Point Layer)

```javascript
// 1. 准备数万条点位数据
var data = [
    // [x, y, { 属性对象 }]
    [116.40, 39.90, { "type": 1, "name": "北京" }],
    // ... 万级别以上的数据
];

// 2. 创建图层并定义 Symbol (样式)
var bigLayer = new maptalks.BigPointLayer('big-points', data, {
    // 开启双缓冲防黑边
    doubleBuffer: true 
}).setStyle([
    {
        filter: ['==', 'type', 1],
        symbol: {
            'markerFile': 'images/marker.png',
            'markerWidth': 20,
            'markerHeight': 30
        }
    }
]);

// 3. 将海量图层挂载至地图
bigLayer.addTo(map);

// 4. 点击交互支持 (基于极速 K-D 树索引)
map.on('click', function (e) {
    var identifyRes = bigLayer.identify(e.coordinate);
    if (identifyRes) {
        console.log("您点击了点位: ", identifyRes);
    }
});
```

## 🛠️ 本地开发与编译

```shell
git clone https://github.com/maptalks/maptalks.biglayer.git
cd maptalks.biglayer
npm install
# 开发模式 (启动本地服务)
npm run dev
# 生产构建 (产出至 dist 目录)
npx gulp minify
```
> **注意**：Demo 中的测试数据文件可能较大 (>50M)，请耐心等待加载。

## 🗺️ 官方 Demo 示例参考

* **百万级建筑物拉伸 (20K+ 纽约曼哈顿建筑)**
  参考：`demo/extrude-building.html`
* **全国近百万村落点位分布 (925,507个坐标)**
  参考：`demo/zhai.html`
* **海量百万级用户打点**
  参考：`demo/users.html`
