import Vue from 'vue'
import { Xverse, XverseRoom } from '@xverse/tmeland'

let room: any

new Vue({
  el: '#app',
  data() {
    return {
      userId: Math.random().toString(16).slice(2),
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
      const skinDataVersion = urlParam.get('skinDataVersion') || '1004700001'

      const xverse = new Xverse()

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
        })
      } catch (error) {
        console.error(error)
        alert(error)
      }

      // 禁止行走后自动转向面对镜头
      room.disableAutoTurn = true
      this.setSkytvVideo()
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
            // 'Content-Type': 'application/x-www-form-urlencoded',
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

    setSkytvVideo() {
      room.skytv.setUrl({
        url: 'https://static.xverse.cn/music-festival/4ke_1.5m_crop.mp4',
        bLoop: true,
        bMuted: true,
      })
    },
  },
})
