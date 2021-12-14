import Vue from 'vue'
import {
  IPhotoShots,
  Xverse,
  XverseRoom,
  Person,
  ILiveInfo,
  Avatar,
  ClickTargetName,
  VehicleType,
  Codes,
  XverseError,
  IViewMode,
} from '@xverse/tmeland'
import Minimap from './components/minimap/minimap.vue'
import ComponentsPanel from './components/components-panel/components-panel.vue'
import Hls from 'hls.js'
import { toast } from './toast'

let room: XverseRoom

new Vue({
  el: '#app',
  components: {
    Minimap,
    ComponentsPanel,
  },
  data() {
    return {
      avatarId: '', // 用户的 avatar 类型ID
      userId: Math.random().toString(16).slice(2),
      isInPhotoBooth: false, // 是否进入拍照模式
      showAnimation: false, // 展示动画面板
      animations: [] as string[], // 可播放的动画
      currentShot: '', // 当前拍照模式
      showMinimap: false, // 是否展示小地图
      person: Person.Third,
      currentArea: '', // 音乐岛上当前区域
      isInDisco: false, // 是否在迪厅中
      isInLiveHall: false, // 是否在直播厅中
      showComponentsPanel: false, // 展示换装面板
      components: [] as any[], // Avatar 的组件列表
      avatarComponents: [] as any[],
      isInBox: false, // 是否在包厢中
      isOnVehicle: false, // 是否在载具上
      viewMode: 'simple',
      isInGameCenter: false, // 在游戏厅中
      isOverTower: false, // 在瞭望塔上
      isShowBooking: false, // 展示预约页面
      isTimeToGo: false, // 展示现在前往
      isBooking: false, // 是否已在预约队列中
      vehicle: '',
      clickVehicle: '',
      observerArea: '', // 观察者区域
    }
  },
  mounted() {
    this.initRoom()
  },
  methods: {
    async initRoom() {
      const xverse = new Xverse()
      // 景观模式
      try {
        await xverse.preload('simple', (progress: number, total: number) => {
          console.log(progress, total)
        })
      } catch (error) {
        console.error(error)
        return
      }

      const urlParam = new window.URLSearchParams(location.search)
      const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
      // 注意 1.0.32 更新了新的 roomId
      const roomId = urlParam.get('roomId') || 'e629ef3e-022d-4e64-8654-703bb96410eb'
      const userId = urlParam.get('userId') || this.userId
      const avatarId = urlParam.get('avatarId') || 'KGe_Girl'
      const appId = (urlParam.get('appId') || import.meta.env.VITE_APPID) as string
      const skinId = (urlParam.get('skinId') || import.meta.env.VITE_SKINID) as string
      this.avatarId = avatarId
      // 注意 1.0.35 更换了测试后台
      const wsServerUrl = urlParam.get('ws')
        ? decodeURIComponent(urlParam.get('ws')!)
        : 'wss://uat-eks.xverse.cn/newarch/ws' // TODO: 测试联调服务，后面上线可以不传

      // 注意 1.0.32 更新了新的数据版本
      const skinDataVersion = urlParam.get('skinDataVersion') || '1005000122'

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
          nickname: userId,
          firends: ['user1'],
          viewMode: 'simple',
        })
        this.bindUserAvatarEvent()
        this.bindConnectionEvent()
        ;(window as any).room = room
      } catch (error) {
        console.error(error)
        alert(error)
        return
      }

      // const viewMode: IViewMode = 'full'
      // 观察者模式
      const viewMode: IViewMode = 'observer'
      console.log('进入' + viewMode + '模式')

      try {
        // 预下载对应阶段的资源
        await xverse.preload(viewMode, (progress: number, total: number) => {
          console.log(progress, total)
        })
        room.setViewMode(viewMode)
        this.viewMode = viewMode
      } catch (error) {
        console.error(error)
        return
      }

      // 禁止行走后自动转向面对镜头
      room.disableAutoTurn = true
      // this.setSkytvVideo()
      this.setMV()
      this.bindClickEvent()
      this.getAvatarComponents()
    },

    /**
     * 获取用户这个 Avatar 类型的所有
     */
    async getAvatarComponents() {
      // 这里只是演示，从非公开接口拿到了所有 Avatar 组件，业务方还是从业务后台读取这个列表
      const avatarTypeList = await room.modelManager.getAvatarModelList()
      const avatarInfo = avatarTypeList.find((avatarType) => avatarType.id === this.avatarId)
      this.components = avatarInfo ? avatarInfo.components : []
    },

    /**
     * 绑定连接相关的事件
     */
    bindConnectionEvent() {
      room.on('repeatLogin', function () {
        toast('该用户已经在其他地点登录', {
          duration: 10000,
        })
      })

      room.on('reconnecting', function ({ count }) {
        toast(`尝试第${count}次重连`)
      })

      room.on('reconnected', function () {
        toast('重连成功')
      })

      room.on('disconnected', function () {
        const toastInstance = toast('连接失败，手动点击重试', {
          duration: 100000,
          onClick() {
            toastInstance.hideToast()
            room.reconnect()
          },
        })
      })
    },

    bindUserAvatarEvent() {
      room.on('userAvatarLoaded', () => {
        if (!room.userAvatar) return
        console.log('Avatar 加载完毕')
        // currentArea
        this.currentArea = room.userAvatar.currentArea
        this.avatarComponents = room.userAvatar.avatarComponents
        room.userAvatar.on('stopMoving', ({ target }) => {
          this.currentArea = target.currentArea
        })
      })
    },

    bindClickEvent() {
      let showButtonsAvatar: Avatar | undefined
      room.on('click', (event) => {
        if (event.target && event.target.name === ClickTargetName.PhotoBooth) {
          this.togglePhotoBooth(event.target.id)
        } else if (event.target && event.target.name === ClickTargetName.ConfessionsWall) {
          console.warn('告白墙输入入口')
        } else if (event.target && event.target.name === ClickTargetName.Avatar) {
          const id = event.target.id
          // 排除自己
          if (id !== this.userId) {
            showButtonsAvatar = room.avatars.find((avatar) => avatar.userId === id)
            showButtonsAvatar?.showButtons()
          }
        } else if (event.target && event.target.name === ClickTargetName.GiftPanel) {
          if (showButtonsAvatar) {
            room.userAvatar.sendGift(showButtonsAvatar, event.target.id)
            showButtonsAvatar.hideButtons()
          }
        } else if (event.target && event.target.name === ClickTargetName.LiveEntrance) {
          console.warn('进入直播间 ID:' + event.target.id)
        } else if (event.target && event.target.name === ClickTargetName.AirshipEntrance) {
          // 进入飞艇
          this.toggleVehicle(VehicleType.Airship)
        } else if (event.target && event.target.name === ClickTargetName.HotAirBalloonEntrance) {
          this.toggleVehicle(VehicleType.HotAirBalloon)
        } else if (
          event.target &&
          (event.target.name === ClickTargetName.DiscoEntrance || event.target.name === ClickTargetName.DiscoExit)
        ) {
          this.toggleDisco()
        } else if (
          event.target &&
          (event.target.name === ClickTargetName.GameCenterEntrance ||
            event.target.name === ClickTargetName.GameCenterExit)
        ) {
          this.toggleGameCenter()
        } else if (
          event.target &&
          (event.target.name === ClickTargetName.LiveHallEntrance || event.target.name === ClickTargetName.LiveHallExit)
        ) {
          this.toggleLiveHall()
        } else if (
          event.target &&
          (event.target.name === ClickTargetName.RightBoxEntrance ||
            event.target.name === ClickTargetName.LeftBoxEntrance)
        ) {
          this.toggleBox(event.target.name === ClickTargetName.LeftBoxEntrance ? 'left' : 'right')
        } else if (
          event.target &&
          (event.target.name === ClickTargetName.WatchTowerEntrance ||
            event.target.name === ClickTargetName.WatchTowerExit)
        ) {
          this.toggleTower()
        } else {
          room.avatars.forEach((avatar) => {
            avatar.hideButtons()
          })
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

    switchObserver() {
      const targetArea = this.observerArea === 'inDisco' ? 'birthSquare' : 'inDisco'
      room.switchObserver(targetArea).then(() => {
        this.observerArea = targetArea
        if (this.observerArea === 'inDisco') {
          this.afterDiscoAccessed()
        }
      })
    },

    async toggleTower() {
      if (!this.isOverTower) {
        try {
          await room.watchTower.access()
          console.info('transfer')
          this.isOverTower = true
        } catch (error) {
          console.error(`前往暸望塔失败, msg: ${error}`)
        }
      } else {
        if (room.watchTower.telescope.actived) {
          console.error('请退出望远镜模式后再退出')
          return
        }
        try {
          await room.watchTower.exit()
          this.isOverTower = false
        } catch (error) {
          console.error(`离开暸望塔失败, msg: ${error}`)
        }
      }
    },

    toggleGameCenter() {
      if (this.isInGameCenter) {
        room.gameCenter
          .exit()
          .then(() => {
            this.isInGameCenter = false
          })
          .catch((e) => {
            console.error(`离开游戏厅失败, msg: ${e}`)
          })
      } else {
        room.gameCenter
          .access()
          .then(() => {
            this.isInGameCenter = true
          })
          .catch(() => {
            console.error('进入游戏厅失败')
          })
      }
    },

    async toggleBooking(vehicle: VehicleType) {
      try {
        this.isShowBooking = false
        await room.vehicle.getReserveSeat(vehicle)
        this.isBooking = true
        room.vehicle.on('goOnVehicleReady', () => {
          this.isBooking = false
          const goToShip = setTimeout(() => {
            this.isTimeToGo = false
            clearTimeout(goToShip)
          }, 10000)
        })
      } catch (error) {
        toast('预约失败' + error)
      }
    },
    async toggleVehicle(vehicle: VehicleType) {
      if (!this.isOnVehicle) {
        try {
          await room.vehicle.access(vehicle)
          this.vehicle = vehicle
          this.isTimeToGo = false
          this.clickVehicle = vehicle
          this.isOnVehicle = true
        } catch (error: any) {
          console.warn(error)
          if (error.code === Codes.GetOnVehicle) {
            this.isShowBooking = true
            this.clickVehicle = vehicle
            toast('抱歉目前已满员')
          } else {
            toast(`上${vehicle === VehicleType.HotAirBalloon ? '热气球' : '飞艇'}失败, msg: ${error}`)
          }
        }
      } else {
        try {
          await room.vehicle.exit()
          this.isOnVehicle = false
          this.vehicle = ''
        } catch (error) {
          this.status = 'normal'
          toast(`下${vehicle === VehicleType.HotAirBalloon ? '热气球' : '飞艇'}失败, msg: ${error}`)
        }
      }
    },

    /**
     * 设置广场的 MV
     */
    setMV() {
      const src = 'https://cctvtxyh5ca.liveplay.myqcloud.com/live/cctv1_2_hd.m3u8'
      const videoElement = document.querySelector('#tv') as HTMLVideoElement
      videoElement.src = src
      if (src.includes('.m3u8')) {
        if (Hls.isSupported()) {
          const hls = new Hls()
          hls.loadSource(src)
          hls.attachMedia(videoElement)
        } else {
          videoElement.src = src
        }
      } else {
        videoElement.src = src
      }

      room.tvs[0].setVideo(videoElement).then(() => {
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
        room.userAvatar?.moveToArea(id)
      }
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

    /**
     * 进出迪厅
     */
    toggleDisco() {
      if (this.isInDisco) {
        room.disco.exit().then(() => {
          this.isInDisco = !this.isInDisco
        })
      } else {
        room.disco.access().then(() => {
          this.afterDiscoAccessed()
        })
      }
    },

    afterDiscoAccessed() {
      room.disco.setConfessionsWallTexts(['2022新年快乐', '告白墙xxx', '2023新年快乐', '2024新年快乐'])
      this.isInDisco = !this.isInDisco
    },

    /**
     * 进出迪厅
     */
    toggleLiveHall() {
      if (this.isInLiveHall) {
        room.liveHall.exit().then(() => {
          this.isInLiveHall = !this.isInLiveHall
          // room.skytv?.play()
          // room.skytv?.hide()
        })
      } else {
        room.liveHall.access().then(() => {
          this.isInLiveHall = !this.isInLiveHall
          // room.skytv?.show()
          // room.skytv?.pause()
          const liveInfos: ILiveInfo[] = new Array(4).fill(null).map((item, index) => {
            return {
              id: 'liveBoard' + index,
              hostName: 'Test',
              desc: '正在演唱《X》',
              thumbnailUrl: 'https://static.xverse.cn/music-festival/textures/bubble01.png',
              avatarId: 'KGe_Boy',
            }
          })
          room.liveHall.setLiveInfos(liveInfos)
        })
      }
    },
    /**
     * 开启红包雨
     */
    startPlayRain() {
      room.effectManager.rain.play({
        duration: 10000,
        onEnd(count) {
          console.warn('点中了' + count + '个红包雨')
        },
      })
    },

    /**
     * 进出包厢
     * @param direction
     */
    toggleBox(direction: 'left' | 'right' = 'left') {
      if (!this.isInBox) {
        room.box.access(direction).then(() => {
          this.isInBox = true
        })
      } else {
        room.box.exit().then(() => {
          this.isInBox = false
        })
      }
    },

    /**
     * 换装模式
     */
    toggleComponentsPanel() {
      this.showComponentsPanel = !this.showComponentsPanel
      this.showComponentsPanel
        ? room.userAvatar.startChangeComponentsMode()
        : room.userAvatar.exitChangeComponentsMode()
    },
  },
})
