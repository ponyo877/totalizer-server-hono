import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/cloudflare-workers'
import { Redis } from "@upstash/redis/cloudflare";

type Bindings = {
  MY_NAME: string
  MY_KV: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.json({
    ok: true,
    message: 'Hello World!',
  })
})

type Message = {
  type: string;
  result: number;
};


app.get(
  '/ws',
  upgradeWebSocket((c) => {
    const redis = Redis.fromEnv(c.env!);
    return {
      async onMessage(event, ws) {
        const message = JSON.parse(event.data)
        switch (message.type) {
          case 'join':
            let cnt = await redis.incr("counter");
            ws.send('counter: ' + cnt);
          case 'vote':
            if (message.answer === 'yes') {
              const key = message.roomID+'_'+message.questionID
              const count = c.env.MY_KV.get(key)
              await c.env.MY_KV.put(key, count+1)
            }
            await c.env.MY_KV.put(message.roomID, c.env.MY_KV.get(message.roomID)+1)
            break
          case 'result':
            const key = message.roomID+'_'+message.questionID
            const count = c.env.MY_KV.get(key)
            const res: Message = {
              type: 'result',
              result: count
            };
            ws.send(JSON.stringify(res))
            break
          default:
            ws.send('Unknown message')
        }
        ws.send('Hello from server!')
      },
      onClose: () => {
        console.log('Connection closed')
      },
    }
  })
)

export default app
