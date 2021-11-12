<template>
  <div  class="dress_list">
    <div class ="dress_list-swiper">
      <div class="dress_list-item" v-for="item in components" :key="item.type" >
        <span>{{item.name}}</span>
        <div v-for="list in item.units" :key="list.id" :class="isComponentActive(item.type,list.id)?'active':''" @click="changeDress(list.id, item.type)">
          {{list.name}}
        </div>
      </div>
    </div>
      <button @click="changeAvatarComponentsConfirm" style="margin-bottom: 10px;">
        确认切换
      </button>
      <button @click="changeAvatarComponentsCancle">
        取消切换
      </button>
    </div>
</template>

<script>
import { ChangeComponentsMode } from  '@xverse/tmeland'
/**
 * 换装面板
 */
export default {
  props: {
    components: Array,
    currentComponents: Array
  },
  data() {
    return {
      previewingAvatarComponents: [],
      avatarComponents: []
    }
  },
  mounted() {
    this.avatarComponents = this.currentComponents
  },
  methods: {
    changeDress(id, type) {
      // 获取avatar该部分类别组件列表
      const components = this.components.filter((component) => component.type === type)[0]
      // 根据当前换装模式，选择不同的curComponents
      let curComponents = this.avatarComponents
      if (this.previewingAvatarComponents.length) {
        curComponents = this.previewingAvatarComponents
      }
      // 去掉相同类别部件
      let rest = curComponents.filter((com) => com.type !== type)
      if (type === 'suit') {
        const suitComb = components.suitComb
        // 过滤掉suitComb
        rest = rest.filter((item) => suitComb.indexOf(item.type) === -1)
      } else {
        const suit = curComponents.find((component) => component.type === 'suit')
        if (suit) {
          // 已经有suit穿在身上了且当前部件包含在套件中，则去掉suit并加上包含的部件
          const suitComb = this.components.find((component) => component.type === 'suit').suitComb
          if (suitComb.includes(type)) {
            rest = rest.filter((item) => item.type !== 'suit')
            suitComb.forEach((com) => {
              if (com !== type) {
                const id = components.units.find((unit) => unit.isDefault).id
                rest.push({ id, type: com })
              }
            })
          }
        }
      }
      this.previewingAvatarComponents = [...rest, { type, id }]
      window.room.userAvatar.changeComponents({
        avatarComponents: this.previewingAvatarComponents,
        mode: ChangeComponentsMode.Preview,
        endAnimation: 'GiftClap',
      })
    },
    async changeAvatarComponentsConfirm() {
      this.avatarComponents = this.previewingAvatarComponents
      this.previewingAvatarComponents = []
      window.room.userAvatar.changeComponents({ avatarComponents: this.avatarComponents, mode: ChangeComponentsMode.Confirm, endAnimation: 'GiftClap' })
      this.$emit('close')
    },
    async changeAvatarComponentsCancle() {
      this.previewingAvatarComponents = []
      window.room.userAvatar.changeComponents({ avatarComponents: this.avatarComponents, mode: ChangeComponentsMode.Cancel })
      this.$emit('close')
    },
    isComponentActive(type, id) {
      let curComponents = this.avatarComponents
      if (this.previewingAvatarComponents.length) {
        curComponents = this.previewingAvatarComponents
      }
      return !!curComponents.find((avatarComponent) => avatarComponent.type === type && avatarComponent.id === id)
    },
  }
}
</script>

<style>
</style>
