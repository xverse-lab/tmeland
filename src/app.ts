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
  IViewMode,
  ICurrentArea,
  IBossNames,
  IPosition,
  Skins
} from '@xverse/tmeland'
import Minimap from './components/minimap/minimap.vue'
import ComponentsPanel from './components/components-panel/components-panel.vue'
import Hls from 'hls.js'
import { toast } from './toast'
const bossAvatarIdMap: Record<IBossNames, string> = {
  cussion: 'cussion_12',
  shirley: 'shirley_14',
  ross: 'ross_07',
  tony: 'tony_13',
}
const urlParam = new window.URLSearchParams(location.search)
const appId = (urlParam.get('appId') || import.meta.env.VITE_APPID) as string
// 注意 1.1.2 更新了 appId 的传参位置
const xverse = new Xverse({
  appId: appId,
  releaseId: '2204221608_65dae9'
})
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
      isLiveShowing: false, // 是否在迪厅表演中
    }
  },
  mounted() {
    this.initRoom('full')
  },
  methods: {
    async initRoom(viewMode: IViewMode) {
      // 景观模式
      try {
        // 对应 viewMode 进房就需要预下载对应模式的资源。
        // 另外 serverless 模式需要对应下载 'observer' 模式的资源
        await xverse.preload?.start(viewMode as IViewMode, (progress: number, total: number) => {
          console.log(progress, total)
        })
      } catch (error: any) {
        console.error(error)
        if (error.code === Codes.PreloadCanceled) {
          toast('预加载被取消')
          return
        }
        alert(error)
      }
      
      const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
      // 注意 1.0.41 更新了新的 roomId
      const roomId = urlParam.get('roomId') || 'e629ef3e-022d-4e64-8654-703bb96410eb'
      const userId = urlParam.get('userId') || this.userId
      const avatarId = urlParam.get('avatarId') || 'KGe_Girl'
      const skinId = (urlParam.get('skinId') || Skins.Island) as string
      this.avatarId = avatarId
      // 注意 1.1.5 更换了测试后台
      const wsServerUrl = urlParam.get('ws')
        ? decodeURIComponent(urlParam.get('ws')!)
        : import.meta.env.VITE_SERVER_URL

      const bossName = (urlParam.get('bossName') as IBossNames) || undefined

      const token = await this.getToken(appId as string, userId)
      if (!token) {
        return alert('Token 获取失败')
      }

      try {
        room = await xverse.joinRoom({
          canvas: canvas,
          skinId: skinId,
          avatarId: bossName ? bossAvatarIdMap[bossName] : avatarId,
          roomId: roomId,
          userId,
          wsServerUrl: wsServerUrl,
          appId: appId,
          token: token,
          nickname: userId,
          firends: ['user1'],
          viewMode: viewMode,
          bossName,
        })
        this.viewMode = viewMode
        this.bindUserAvatarEvent()
        this.bindConnectionEvent()
        ;(window as any).room = room
        
      } catch (error: any) {
        console.error(error)
        if (error && error.code) {
          const code = error.code
          // 如果错误码是 2000 开头，代表服务器异常。或者有其他异常都可以丢进去
          if (code >= 2000 && code < 3000) {
            console.log('进入无后端模式进房')
            // 以无后端模式进房，不会与元象后端建立网络连接，表现和 'observer' 模式一样
            this.initRoom('serverless')
            return
          }
        }
        alert(error)
        return
      }

      // 禁止行走后自动转向面对镜头
      room.disableAutoTurn = true
      this.setMV()
      this.bindClickEvent()
      this.getAvatarComponents()
      room.joyStick.init()
      if (skinId === Skins.AdDisco || skinId === Skins.Disco) {
        this.afterDiscoAccessed()
      }
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
        this.initGuiders()
        room.setXiaoNiActived(true)
        // currentArea
        this.currentArea = room.userAvatar.currentArea
        this.avatarComponents = room.userAvatar.avatarComponents
        room.userAvatar.on('stopMoving', ({ target }) => {
          this.currentArea = (target as Avatar).currentArea
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

    async gameCenterExit() {
      return room.gameCenter
        .exit()
        .then(() => {
          this.isInGameCenter = false
        })
        .catch((e) => {
          console.error(`离开游戏厅失败, msg: ${e}`)
        })
    },
    async discoExit() {
      return room.disco.exit().then(() => {
        this.isInDisco = !this.isInDisco
      })
    },
    async liveHallExit() {
      return room.liveHall.exit().then(() => {
        this.isInLiveHall = !this.isInLiveHall
      })
    },
    async exitRoom() {
      if (this.isInDisco) {
        return this.discoExit()
      }
      if (this.isInGameCenter) {
        return this.gameCenterExit()
      }
      // if (this.isInBox) {
      //   return this.boxExit()
      // }
      if (this.isInLiveHall) {
        return this.liveHallExit()
      }
      // if (this.isInTelescopeMode) {
      //   return this.telescopeExit()
      // }
      // if (this.isInScreenShotMode) {
      //   return this.ScreenShotModeExit()
      // }
    },

    async toggleBooking(vehicle: VehicleType) {
      try {
        this.isShowBooking = false
        await room.vehicle.getReserveSeat(vehicle)
        room.vehicle.on('goOnVehicleReady', () => {
          toast('快点登上飞艇')
          this.isTimeToGo = true
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
      this.exitRoom().then(async () => {
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
            toast(`下${vehicle === VehicleType.HotAirBalloon ? '热气球' : '飞艇'}失败, msg: ${error}`)
          }
        }
      })
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
        room.userAvatar?.moveToArea(id as ICurrentArea)
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
    async toggleDisco() {
      if (this.isInDisco) {
        await this.discoExit()
      } else {
        room.disco.access().then(() => {
          this.afterDiscoAccessed()
        })
      }
    },

    /**
     * 迪厅进入后的处理
     */
    async afterDiscoAccessed() {
      this.isInDisco = !this.isInDisco
      if(room.disco.skinId === Skins.AdDisco) {
        // 阿迪 disco 添加走秀 NPC，位置朝向参考配置表
        const npcAvatar2 = await room.avatarManager.addNpc({
          userId: 'npc_ad_disco_model',
          avatarId: 'Adidas_Model',
          avatarPosition: { x: -273.129974, y: 2059.234375, z: 57.375923 },
          avatarRotation: { pitch: 0, yaw: 270, roll: 0 },
          avatarScale: 3,
        })
        // 这里临时调用这两行，后续修复后可去掉
        npcAvatar2.setRayCast(false)
        npcAvatar2.setPosition({ x: -273.129974, y: 2059.234375, z: 57.375923 })
      } else {
        room.disco.setConfessionsWallTexts(['2022新年快乐', '告白墙xxx', '2023新年快乐', '2024新年快乐'])
      }
    },

    /**
     * 阿迪走秀
     */
    async startCatwalks() {
      const model = room.avatars.find((item) => item.userId === 'npc_ad_disco_model')
      if(!model) return
      model.setPosition({ x: -273.129974, y: 2059.234375, z: 57.375923 })
      model.setRotation({ pitch: 0, yaw: -90, roll: 0 })
      model.show()

      console.log('start to move dancer line 1')
      await model.move({
        start: { x: -273.129974, y: 2059.234375, z: 57.375923 },
        end: { x: -273.129974, y: -1370.197998, z: 57.375923 },
        walkSpeed: 500,
      })

      console.log('start to move dancer line 2')
      await model.moveHermite({
        start: { x: -273.129974, y: -1370.197998, z: 57.375923 },
        end: { x: 298.809143, y: -1370.197998, z: 57.375923 },
        duration: 1000 * 10,
        tension: 20,
      })

      console.log('start to move dancer line 3')
      await model.move({
        start: { x: 298.809143, y: -1370.197998, z: 57.375923 },
        end: { x: 298.809143, y: 2059.234375, z: 57.375923 },
        walkSpeed: 500,
        inter: [],
      })
      model.hide()
    },

    /**
     * 阿迪表演
     */
    async toggleShow() {
      const userId = 'Adidas_Live'

      const playNpcAnimation = async (animationName: string, isLoop?: boolean) => {
        const loop = isLoop || false
        const npcAvatar = room.avatars.find((item) => item.userId === userId)
        return npcAvatar?.playAnimation({ animationName, loop })
      }

      const startShowQueue = async () => {
        await room.disco.showEffect({
          name: '62d109b7eb3a187c',
          scale: 3,
          userId: 'Adidas_Live',
        })
        await room.disco.removeEffect('chuchang')
        const AnimationAndEffectList = [
          { animationName: 'Dance01_01', effectName: 'b99d6abc49435cf2', sleepDuration: 1000 },
          { animationName: 'Dance01_02', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_03', effectName: '180adfdb68895693', sleepDuration: 1000 },
          { animationName: 'Dance01_04', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_05', effectName: 'adb6bc525c141f7c', sleepDuration: 1000 },
          { animationName: 'Dance01_06', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_07', effectName: '5c43bbb2d9e5cbb9', sleepDuration: 1000 },
          { animationName: 'Dance01_08', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_09', effectName: 'b99d6abc49435cf2', sleepDuration: 1000 },
          { animationName: 'Dance01_10', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_11', effectName: '180adfdb68895693', sleepDuration: 1000 },
          { animationName: 'Dance01_12', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_13', effectName: 'adb6bc525c141f7c', sleepDuration: 1000 },
          { animationName: 'Dance01_14', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_15', effectName: '5c43bbb2d9e5cbb9', sleepDuration: 1000 },
          { animationName: 'Dance01_16', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_17', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_18', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_19', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance01_20', effectName: '', sleepDuration: 1000 },

          { animationName: 'Dance06_01', effectName: 'b99d6abc49435cf2', sleepDuration: 1000 },
          { animationName: 'Dance06_02', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_03', effectName: '180adfdb68895693', sleepDuration: 1000 },
          { animationName: 'Dance06_04', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_05', effectName: 'adb6bc525c141f7c', sleepDuration: 1000 },
          { animationName: 'Dance06_06', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_07', effectName: '5c43bbb2d9e5cbb9', sleepDuration: 1000 },
          { animationName: 'Dance06_08', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_09', effectName: 'b99d6abc49435cf2', sleepDuration: 1000 },
          { animationName: 'Dance06_10', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_11', effectName: '180adfdb68895693', sleepDuration: 1000 },
          { animationName: 'Dance06_12', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_13', effectName: 'adb6bc525c141f7c', sleepDuration: 1000 },
          { animationName: 'Dance06_14', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_15', effectName: '5c43bbb2d9e5cbb9', sleepDuration: 1000 },
          { animationName: 'Dance06_16', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_17', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_18', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_19', effectName: '', sleepDuration: 1000 },
          { animationName: 'Dance06_20', effectName: '', sleepDuration: 1000 },
        ]
        const index = 0
        const genPromise = async (animationName: string, effectName: string, sleepDuration: number) => {
          if (effectName) {
            console.debug('start to play effect : ', effectName)
            room.disco.showEffect(effectName)
          } else {
            await room.disco.clearEffects()
          }
          console.debug('start to play animation : ', animationName)
          await playNpcAnimation(animationName, false)
          //动作之间的停顿时长
          if (sleepDuration > 0) {
            // console.log('wait some time : ', sleepDuration)
            // await sleep(sleepDuration)
          }
        }

        const loop = async (index: number): Promise<any> => {
          if (!this.isLiveShowing) {
            return Promise.reject(new Error('Canceled'))
          }
          const item = AnimationAndEffectList[index]
          if (!item) return Promise.resolve()
          const promise = genPromise(item.animationName, item.effectName, item.sleepDuration)
          await promise
          index++
          return loop(index)
        }

        await loop(index)
        await room.disco.clearEffects()
      }

      if (this.isLiveShowing) {
        // 停止表演
        this.isLiveShowing = !this.isLiveShowing
        playNpcAnimation('Idle', true)
        room.disco.clearEffects()
      } else {
        // 开始表演
        this.isLiveShowing = !this.isLiveShowing
        try {
        // room.avatarManager.avatars 同 room.avatars 引用相同
        if(!room.avatarManager.avatars.has(userId)) {
          const npcAvatar = await room.avatarManager.addNpc({
            userId: userId,
            avatarId: 'Adidas_Live',
            avatarPosition: { x: 0, y: -750, z: 57 },
            avatarRotation: { pitch: 0, yaw: -90, roll: 0 },
            avatarScale: 3,
          })
          npcAvatar.setRayCast(false)
          npcAvatar.setPosition({ x: 0, y: -750, z: 57 })
        }


          await startShowQueue()
        } catch (error: any) {
          if (error && error.message === 'Canceled') {
            toast('表演取消')
          }
        }
      }
    },

    /**
     * 进出迪厅
     */
    async toggleLiveHall() {
      if (this.isInLiveHall) {
        await this.liveHallExit()
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

    initGuiders() {
      console.log('initGuiders')
      const userAvatar = room.userAvatar
      if(!userAvatar) return
      // 是否处于对话模式
      let isInDialogueMode = false
      // 对话模式下距离范围，进入时面对面
      const DIALOGUE_RANGE = 500
      // 可视距离范围，进入时添加npc
      const IN_VIEW_RANGE = 1000
      // 可视距离范围，超出时移除npc
      const OUT_VIEW_RANGE = 2000
      // 自定义的npc位置、形象等
      const guiders = [
        {
          skinId: Skins.Island,
          userId: 'zhangsan1',
          avatarId: 'KGe_Boy',
          nickname: '新手引导员',
          avatarPosition: { x: 0, y: 60700, z: 0 },
          avatarRotation: { pitch: 0, yaw: 90, roll: 0 },
        },
        {
          skinId: Skins.Island,
          userId: 'zhangsan2',
          avatarId: 'KGe_Boy',
          nickname: '热气球介绍员',
          avatarPosition: { x: -28410, y: -32510, z: 0 },
          avatarRotation: { pitch: 0, yaw: 100, roll: 0 },
        },
        {
          skinId: Skins.Island,
          userId: 'zhangsan3',
          avatarId: 'KGe_Boy',
          nickname: '飞艇介绍员',
          avatarPosition: { x: -500, y: -33100, z: 0 },
          avatarRotation: { pitch: 0, yaw: 110, roll: 0 },
        },
        {
          skinId: Skins.Island,
          userId: 'zhangsan4',
          avatarId: 'KGe_Boy',
          nickname: '游戏大厅介绍员',
          avatarPosition: { x: 42000, y: 9500, z: 0 },
          avatarRotation: { pitch: 0, yaw: 180, roll: 0 },
        },
      ]
      // 更新npcs
      const updateGuiders = () => {
        const position = userAvatar?.position
        if (!position) return
        guiders.forEach((guider) => {
          if (guider.skinId !== room.skinId || distance(position, guider.avatarPosition) > OUT_VIEW_RANGE) {
            // 移除超出可视范围或者非当前皮肤的npc
            room.avatarManager.removeAvatar(guider.userId, true)
          } else if (guider.skinId === room.skinId && distance(position, guider.avatarPosition) < IN_VIEW_RANGE) {
            // 如果用户进入可视范围，则添加该皮肤内的npc
            room.avatarManager.addNpc({ ...guider }).then(() => {
              console.log('addNpc', guider)
            })
          }
        })
      }

      const distance = (point1: IPosition, point2: IPosition) => {
        const x = point1.x - point2.x
        const y = point1.y - point2.y
        const z = point1.z - point2.z
        return Math.sqrt(x * x + y * y + z * z)
      }

      const faceToFace = (dialogueNpc: Avatar, userAvatar: Avatar) => {
        if (!dialogueNpc?.position || !userAvatar?.position) return
        dialogueNpc?.faceTo({ point: { ...userAvatar.position, z: 0 } })
        // 面对npc，并偏移30度，让用户看到npc的脸
        userAvatar?.turnTo({ point: dialogueNpc.position, offset: 30 })
      }

      // 进房成功后初次添加npc
      updateGuiders()

      // 根据皮肤变化来动态更新npc，节省内存
      room.on('skinChanged', updateGuiders)

      // 点击NPC进入对话模式，用户Avatar走近并面朝NPC，同时画面聚焦到人物形象上
      room.on('click', (event) => {
        // 如果点击的不是Avatar
        if (event?.target?.name !== ClickTargetName.Avatar) return
        // 如果点击的不是这一批指引npc
        if (!guiders.find((guider) => guider.userId === event.target?.id)) return
        const avatar = room.avatars.find((avatar) => avatar.userId === event.target?.id)
        if (!avatar?.position || !userAvatar?.position) return
        isInDialogueMode = true
        // 点击的npc与用户距离超过一定值，用户先前往附近后面对面，否则直接面对面
        if (distance(avatar.position, userAvatar.position) < DIALOGUE_RANGE) {
          faceToFace(avatar, userAvatar)
          isInDialogueMode = false
        } else {
          userAvatar?.moveTo({ point: avatar.position })
        }
      })

      userAvatar!.on('stopMoving', () => {
        const position = userAvatar?.position
        if (!position) return
        updateGuiders()
        if (!isInDialogueMode) return
        // 正在对话的npc
        const dialogueNpc = guiders.find((guider) => {
          return guider.skinId === room.skinId && distance(guider.avatarPosition, position) < DIALOGUE_RANGE
        })
        if (!dialogueNpc) return
        const avatar = room.avatars.find((avatar) => avatar.userId === dialogueNpc.userId)
        if (!avatar) {
          const { skinId, ...options } = dialogueNpc
          room.avatarManager.addNpc(options).then((avatar) => {
            faceToFace(avatar!, userAvatar!)
            console.log('addNpc', options)
            isInDialogueMode = false
          })
        } else {
          faceToFace(avatar, userAvatar!)
          isInDialogueMode = false
        }
      })
    },
  },
})
