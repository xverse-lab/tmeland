<template>
  <div class="minimaps">
    <div class="close" @click="handleClose"></div>
    <div class="minimaps-map">
      <div v-for="item in minimaps" :key="item.id"  :class="['icons', currentArea === item.id && 'active']" :style="{left: px2rem(item.position.x), top: px2rem(item.position.y) }" @click="handleClick(item)">
        <img :src="item.image" >
        <span class="minimap-name">{{item.name}}</span>
      </div>
    </div>
  </div>
</template>

<script>
import airshipBase from './images/airship-base.png'
import birthSquare from './images/birth-square.png'
import disco from './images/disco.png'
import hotAirBalloonBase from './images/hot-air-balloon-base.png'
import liveHall from './images/live-hall.png'
import sculptureGallery from './images/sculpture-gallery.png'
import watchTower from './images/watchtower.png'
import gameCenter from './images/game-center.png'
import manmadeGarden from './images/manmade-garden.png'
import musicMuseum from './images/music-museum.png'

const minimaps = [{
  id: 'airshipBase',
  name: '飞艇基地',
  position: {
    x: '125',
    y: '90'
  },
  image: airshipBase
},{
  id: 'birthSquare',
  name: '出生广场',
  position: {
    x: '230',
    y: '402'
  },
  image: birthSquare
},{
  id: 'disco',
  name: '迪厅',
  position: {
    x: '228',
    y: '184'
  },
  image: disco
},{
  id: 'hotAirBalloonBase',
  name: '热气球基地',
    position: {
    x: '230',
    y: '29'
  },
  image: hotAirBalloonBase
},{
  id: 'liveHall',
  name: '直播厅',
  position: {
    x: '316',
    y: '328'
  },
  image: liveHall
},{
  id: 'sculptureGallery',
  name: '雕塑园',
  position: {
    x: '125',
    y: '328'
  },
  image: sculptureGallery
},{
  id: 'watchTower',
  name: '瞭望塔',
  position: {
    x: '348',
    y: '61'
  },
  image: watchTower
},{
  id: 'gameCenter',
  name: '游戏中心',
  position: {
    x: '394',
    y: '225'
  },
  image: gameCenter
},{
  id: 'manmadeGarden',
  name: '人造景观园',
  position: {
    x: '46',
    y: '144'
  },
  image: manmadeGarden
},{
  id: 'musicMuseum',
  name: '音乐博物馆',
  position: {
    x: '46',
    y: '245'
  },
  image: musicMuseum
}]


export default {
  name: 'minimap',
  props: {
    currentArea: String
  },
  data() {
    return {
      minimaps
    }
  },
  methods: {
    px2rem(val) {
      return val / 40 + 'rem'
    },
    handleClick(item) {
      this.$emit('select', { id: item.id })
    },
    handleClose() {
      this.$emit('close')
    }
  }
}
</script>

<style>
.minimaps {
  width: 15.05rem;
  height: 16.9rem;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 0.6rem;
  border: 0.05rem solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(2px);
  position: absolute;
  top: 1.325rem;
  right: 8rem;
}

.minimaps-map {
  width: 12.9rem;
  height: 12.9rem;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background-image: url('./images/map.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.minimaps .icons {
  width: 1.6rem;
  height: 1.6rem;
  position: absolute;
}

.minimaps .icons.active {
  background-color: #FFEA95;
}

.minimaps .icons img{
  width: 100%;
  height: 100%;
}

.minimaps .close {
  position: absolute;
  top: 0;
  left: 0;
  background-image: url('./images/close.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  width: 3.88rem;
  height: 1.4rem;
}

.minimap-name {
  font-size: 0.5rem;
  font-weight: 500;
  color: #FFFFFF;
  line-height: 0.7rem;
  text-shadow: 0px 0px 0px rgba(0, 0, 0, 0.5);
  position: absolute;
  bottom: 0.03rem;
  left: 50%;
  transform: translate(-50%, 100%);
  width: 2.5rem;
}
</style>
