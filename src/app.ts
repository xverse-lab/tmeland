import Vue from 'vue'
import { IPhotoShots, Xverse, XverseRoom, MotionType, Person } from '@xverse/tmeland'
import Minimap from './components/minimap/minimap.vue'
let room: XverseRoom

new Vue({
  el: '#app',
  components: {
    Minimap,
  },
  data() {
    return {
      userId: Math.random().toString(16).slice(2),
      isInPhotoBooth: false, // 是否进入拍照模式
      showAnimation: false, // 展示动画面板
      animations: [] as string[], // 可播放的动画
      currentShot: '', // 当前拍照模式
      showMinimap: false, // 是否展示小地图
      motionType: MotionType.Walk, // 移动方式
      person: Person.Third,
      currentArea: '', // 音乐岛上当前区域
    }
  },
  mounted() {
    this.initRoom()
  },
  methods: {
    async initRoom() {
      const urlParam = new window.URLSearchParams(location.search)
      const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
      const roomId = urlParam.get('roomId') || undefined
      const userId = urlParam.get('userId') || this.userId
      const avatarId = urlParam.get('avatarId') || 'KGe_Girl'
      const appId = (urlParam.get('appId') || import.meta.env.VITE_APPID) as string
      const skinId = (urlParam.get('skinId') || import.meta.env.VITE_SKINID) as string

      const wsServerUrl = urlParam.get('ws')
        ? decodeURIComponent(urlParam.get('ws')!)
        : 'wss://uat-eks.xverse.cn/xverse/ws' // TODO: 测试联调服务，后面上线可以不传

      // TODO: 这里因为元象素材会经常变更，所以先手动传入
      const skinDataVersion = urlParam.get('skinDataVersion') || '1005000002'

      const xverse = new Xverse({
        debug: false,
      })

      const token = await this.getToken(appId as string, userId)
      if (!token) {
        return alert('Token 获取失败')
      }

      try {
        room = await xverse.joinRoom({
          canvas: canvas,
          skinId: skinId,
          avatarId: avatarId,
          roomId: roomId,
          userId,
          wsServerUrl: wsServerUrl,
          appId: appId,
          token: token,
          skinDataVersion,
          nickname: 'emoji测试',
          firends: ['user1'],
        })
        this.bindUserAvatarEvent()
      } catch (error) {
        console.error(error)
        alert(error)
      }
      ;(window as any).room = room
      // 禁止行走后自动转向面对镜头
      room.disableAutoTurn = true
      this.setSkytvVideo()
      this.setMV()
      this.bindClickEvent()
    },

    bindUserAvatarEvent() {
      room.on('userAvatarLoaded', () => {
        if (!room.userAvatar) return
        console.log('Avatar 加载完毕')
        // currentArea
        this.currentArea = room.userAvatar.currentArea
        room.userAvatar.on('stopMoving', ({ target }) => {
          this.currentArea = target.currentArea
        })
      })
    },

    bindClickEvent() {
      room.on('click', (event) => {
        if (!event.target) return
        if (event.target.name === 'PhotoBooth') {
          this.togglePhotoBooth(event.target.id)
        }
      })
    },

    /**
     * 获取token，需要业务方部署 token 服务器
     */
    async getToken(appId: string, userId: string) {
      // 这个 url 只是给 demo 演示用的一个服务，业务方需要调用自己的服务
      const url = import.meta.env.VITE_TOKEN_URL as string
      try {
        const response = await fetch(url, {
          body: JSON.stringify({
            appid: appId,
            uid: userId,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })
        const data = await response.json()
        if (data.code !== 0) {
          throw new Error('token service error')
        }
        return data.token
      } catch (error) {
        console.error(error)
        return ''
      }
    },

    /**
     * 设置球幕视频
     */
    setSkytvVideo() {
      room.skytv.setUrl({
        url: 'https://static.xverse.cn/music-festival/4ke_1.5m_crop.mp4',
        loop: true,
        muted: true,
      })
    },

    /**
     * 设置广场的 MV
     */
    setMV() {
      room.tvs[0]
        .setUrl({
          url: 'https://static.xverse.cn/music-festival/k_music_01.mp4',
          loop: true,
          muted: false,
        })
        .then(() => {
          room.tvs.forEach((tv, index) => {
            if (index > 0) {
              tv.mirrorFrom(room.tvs[0])
            }
          })
        })
    },

    toggleShowAnimation() {
      this.showAnimation = !this.showAnimation
      this.animations = room.userAvatar ? room.userAvatar.animations : []
    },

    /**
     * 进入/退出拍照
     */
    togglePhotoBooth(id: string) {
      if (!this.isInPhotoBooth) {
        room.photoBooth.start(id).then((shot) => {
          this.isInPhotoBooth = true
          this.currentShot = shot
        })
      } else {
        room.photoBooth.stop().then(() => {
          this.isInPhotoBooth = false
        })
      }
    },

    // 切换近远景
    async setShots(shot: IPhotoShots) {
      room.photoBooth.setShots(shot).then((shot) => {
        this.currentShot = shot
      })
    },

    // 拍照
    async takePhoto() {
      try {
        const data = await room.photoBooth.takePhoto()
        console.log('拍照成功' + data)
      } catch (error) {
        console.error('拍照失败' + error)
      }
    },

    /**
     * Avatar 播放动作
     * @param animationName
     * @returns
     */
    playAnimation(animationName: string) {
      if (!room.userAvatar) return
      if (room.userAvatar.isMoving) {
        console.error('主播正在行进，不允许播放动画')
        return
      }
      let loop = false
      // PHOTO 开头的用于摆 pose
      if (animationName.startsWith('PHOTO')) {
        loop = true
      }
      room.userAvatar.playAnimation({ animationName, loop, extra: JSON.stringify({ messageId: '中文ID' }) })
    },

    /**
     * 小地图选中处理
     * @param item
     */
    handleMinimapSelect(item: { id: string }) {
      let id: string
      if ((id = item.id)) {
        this.toggleMotionType(MotionType.Run).then(() => {
          room.userAvatar?.moveToArea(id)
        })
      }
    },

    /**
     * 切换走跑模式
     * @param mode
     * @returns
     */
    toggleMotionType(mode: MotionType) {
      if (this.motionType === mode) return Promise.resolve()
      if (!room.userAvatar || room.userAvatar.isMoving || room.userAvatar.isRotating) {
        return Promise.reject()
      }
      return room.userAvatar
        .setMotionType({ type: mode })
        .then(() => {
          this.motionType = mode
        })
        .catch(() => {
          console.error(`切换${mode === MotionType.Run ? '走' : '跑'}模式失败`)
        })
    },

    /**
     * 切换一三人称
     * @param person
     */
    setPerson(person: Person) {
      room.camera.setPerson(person).then(() => {
        this.person = person
      })
    },

    toggleStats() {
      room.stats.isShow ? room.stats.hide() : room.stats.show()
    },
  },
})
